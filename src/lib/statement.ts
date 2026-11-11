// Загрузка выписки: файл с операциями (переписанными из PDF-выписки банка) добавляется к данным.
// Повторы не записываются: ни с уже загруженной выпиской, ни с операциями из SMS.

import { DAY } from './dates'
import { merchantKey, resolveCategory } from './ingest'
import { ACCOUNT_COLORS, baseAmount, newId, type Account, type Data, type Tx } from './model'

export interface ImportRow {
  /** Местное время операции: «2026-08-11T16:42» */
  at: string
  kind: 'expense' | 'income' | 'refund'
  /** Сумма в валюте операции, копейки */
  amount: number
  currency: string
  /** Сумма в валюте счёта, если валюта другая */
  base?: number
  category?: string
  title?: string
  merchant?: string
  note?: string
  /** Остаток после операции */
  bal?: number
}

export interface ImportFile {
  kopeyka: 'import'
  v: 1
  account: { last4?: string; name?: string; currency?: string }
  rows: ImportRow[]
  /** Актуальный остаток карты, если известен */
  balance?: { bal: number; at: string }
  /** Понятные названия мест: «PT KOFEJNYA N3» → «Кофейня №3». Свои названия пользователя не перезаписываются */
  names?: Record<string, string>
}

export function isImportFile(raw: unknown): raw is ImportFile {
  return !!raw && typeof raw === 'object' && (raw as Record<string, unknown>).kopeyka === 'import' && Array.isArray((raw as Record<string, unknown>).rows)
}

function parseLocal(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0).getTime()
}

/** Отпечаток строки выписки — чтобы повторная загрузка того же файла ничего не задвоила. */
function rowHash(r: ImportRow): string {
  return 'st:' + [r.at, r.kind, r.amount, r.currency, r.bal ?? '', r.merchant ?? r.title ?? ''].join('|')
}

export interface ImportReport {
  added: Tx[]
  duplicates: number
  skipped: number
  account: Account
}

export function applyImport(prev: Data, file: ImportFile): { data: Data; report: ImportReport } {
  const data: Data = { ...prev, txs: [...prev.txs], accounts: prev.accounts.map(a => ({ ...a })) }
  const s = data.settings
  const last4 = file.account.last4 && /^\d{4}$/.test(file.account.last4) ? file.account.last4 : undefined
  let acc = last4 ? data.accounts.find(a => a.kind === 'card' && a.last4 === last4) : undefined
  if (!acc) {
    const used = new Set(data.accounts.map(a => a.color))
    acc = {
      id: 'card-' + (last4 ?? 'x') + '-' + newId().slice(-4),
      name: file.account.name?.slice(0, 40) || (last4 ? `Карта ·${last4}` : 'Карта'),
      kind: 'card',
      currency: file.account.currency ?? s.base,
      color: ACCOUNT_COLORS.find(c => !used.has(c)) ?? ACCOUNT_COLORS[0],
      start: 0
    }
    if (last4) acc.last4 = last4
    data.accounts.push(acc)
  }
  const report: ImportReport = { added: [], duplicates: 0, skipped: 0, account: acc }
  const seen = new Set(data.txs.map(t => t.sms).filter(Boolean))
  const sameAccount = data.txs.filter(t => t.account === acc!.id)

  for (const r of file.rows) {
    const at = parseLocal(r.at)
    if (at === null || !(r.amount > 0) || !/^[A-Z]{3}$/.test(r.currency)) { report.skipped++; continue }
    const hash = rowHash(r)
    if (seen.has(hash)) { report.duplicates++; continue }
    const tx: Tx = {
      id: newId('t'),
      kind: r.kind,
      amount: r.amount,
      currency: r.currency,
      category: 'other',
      account: acc.id,
      at,
      src: 'import',
      sms: hash
    }
    if (r.base && r.currency !== s.base) tx.base = r.base
    if (r.merchant) tx.merchant = merchantKey(r.merchant)
    if (r.title) tx.title = r.title.slice(0, 80)
    if (r.note) tx.note = r.note.slice(0, 200)
    if (typeof r.bal === 'number') tx.bal = r.bal
    const catKind = r.kind === 'income' ? 'income' : 'expense'
    tx.category = r.category && data.categories.some(c => c.id === r.category && c.kind === catKind)
      ? r.category
      : resolveCategory(data, r.merchant, undefined, catKind)

    // Уже записано из SMS? Та же сумма и тип; время совпадает до 10 минут
    // (в выписке у части покупок время 00:00 — тогда ищем в пределах суток)
    const window = /T00:00/.test(r.at) ? 1.5 * DAY : 10 * 60_000
    const amountBase = baseAmount(tx, s)
    const dup = sameAccount.find(t =>
      t.kind === tx.kind && Math.abs(t.at - at) <= window && baseAmount(t, s) === amountBase && t.src !== 'import')
    if (dup) { report.duplicates++; seen.add(hash); continue }

    seen.add(hash)
    data.txs.push(tx)
    report.added.push(tx)
  }

  // Остаток карты: из файла, а если его нет — из последней строки выписки (банк пишет строки в порядке проведения)
  let snap: { bal: number; at: number } | null = null
  if (file.balance) {
    const at = parseLocal(file.balance.at)
    if (at !== null) snap = { bal: file.balance.bal, at }
  } else {
    const lastWithBal = [...file.rows].reverse().find(r => typeof r.bal === 'number')
    const times = file.rows.map(r => parseLocal(r.at)).filter((x): x is number => x !== null)
    if (lastWithBal && times.length) snap = { bal: lastWithBal.bal!, at: Math.max(...times) }
  }
  if (snap && (!acc.snap || snap.at >= acc.snap.at)) acc.snap = snap
  if (file.names) {
    const names = { ...data.names }
    for (const [k, v] of Object.entries(file.names)) {
      const key = merchantKey(k)
      if (typeof v === 'string' && v.trim() && !names[key]) names[key] = v.trim().slice(0, 60)
    }
    data.names = names
  }
  data.txs.sort((a, b) => b.at - a.at)
  return { data, report }
}
