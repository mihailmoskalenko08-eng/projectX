// Превращаем SMS в операции: находим карту, категорию, курс, остаток.

import { categoryForMcc, categoryForName } from './mcc'
import {
  ACCOUNT_COLORS, TRANSFER_CATEGORY, convert, newId,
  type Account, type Data, type Pending, type Tx
} from './model'
import { parseSms, FAIL_TEXT, type SmsOp } from './sms'

export function merchantKey(m: string): string {
  return m.toUpperCase().replace(/\s+/g, ' ').trim()
}

const GENERIC = new Set(['shopping', 'transfers', 'other'])

/** Категория расхода: правило пользователя → MCC → название магазина → «Другое». */
export function resolveCategory(data: Pick<Data, 'rules' | 'categories'>, merchant?: string, mcc?: number, kind: 'expense' | 'income' = 'expense'): string {
  const usable = (id: string | null | undefined): id is string =>
    !!id && data.categories.some(c => c.id === id && c.kind === kind && !c.archived)
  if (merchant) {
    const r = data.rules[merchantKey(merchant)]
    if (usable(r)) return r
  }
  if (kind === 'income') return 'other_in'
  const byMcc = categoryForMcc(mcc)
  const byName = categoryForName(merchant)
  if (usable(byMcc) && !(GENERIC.has(byMcc) && usable(byName))) return byMcc
  if (usable(byName)) return byName
  if (usable(byMcc)) return byMcc
  return usable('other') ? 'other' : data.categories.find(c => c.kind === 'expense' && !c.archived)?.id ?? 'other'
}

function incomeCategory(data: Pick<Data, 'rules' | 'categories'>, op: SmsOp): string {
  const fromRule = op.merchant ? data.rules[merchantKey(op.merchant)] : undefined
  if (fromRule && data.categories.some(c => c.id === fromRule && c.kind === 'income')) return fromRule
  const u = (op.op + ' ' + (op.merchant ?? '')).toUpperCase()
  const pick = (id: string, fallback = 'other_in') => (data.categories.some(c => c.id === id && !c.archived) ? id : fallback)
  if (/ZARPLAT|ZP\b|AVANS|SALARY/.test(u)) return pick('salary')
  if (/CASHBACK|KESHBEK|KESHB|PROCENT|PROTSENT|BONUS/.test(u)) return pick('cashback')
  if (/PEREVOD|P2P|TRANSFER/.test(u)) return pick('transfer_in')
  return pick('other_in')
}

export interface IngestItem {
  text: string
  /** Когда сообщение пришло (если в самой SMS нет даты) */
  at?: number
}

export interface IngestReport {
  added: Tx[]
  pending: Pending[]
  duplicates: number
  declined: number
  ignored: number
  newAccounts: Account[]
}

function ensureCard(data: Data, op: SmsOp, report: IngestReport): Account {
  const last4 = op.last4 ?? '????'
  let acc = data.accounts.find(a => a.kind === 'card' && a.last4 === last4)
  if (!acc) {
    const used = new Set(data.accounts.map(a => a.color))
    acc = {
      id: 'card-' + last4 + '-' + newId().slice(-4),
      name: op.last4 ? `Карта ·${last4}` : 'Карта',
      kind: 'card',
      last4,
      currency: op.balanceCurrency ?? op.currency,
      color: ACCOUNT_COLORS.find(c => !used.has(c)) ?? ACCOUNT_COLORS[data.accounts.length % ACCOUNT_COLORS.length],
      start: 0
    }
    data.accounts.push(acc)
    report.newAccounts.push(acc)
  }
  return acc
}

function ensureCash(data: Data): Account {
  let cash = data.accounts.find(a => a.kind === 'cash' && !a.archived && a.currency === data.settings.base)
  if (!cash) {
    cash = { id: 'cash-' + newId().slice(-6), name: 'Наличные', kind: 'cash', currency: data.settings.base, color: '#7DB46C', start: 0 }
    data.accounts.push(cash)
  }
  return cash
}

/** Сумма в основной валюте для валютной операции: по разнице остатков, если она правдоподобна. */
function baseFromBalance(data: Data, acc: Account, op: SmsOp, at: number): number | undefined {
  const s = data.settings
  if (op.currency === s.base || op.balance === undefined || op.balanceCurrency !== s.base || acc.currency !== s.base) return undefined
  let prev: Tx | undefined
  for (const t of data.txs) {
    if (t.account !== acc.id || t.bal === undefined || t.at >= at) continue
    if (!prev || t.at > prev.at) prev = t
  }
  if (!prev || prev.bal === undefined) return undefined
  const delta = op.kind === 'expense' || op.kind === 'cash' ? prev.bal - op.balance : op.balance - prev.bal
  const estimate = convert(op.amount, op.currency, s)
  if (delta > 0 && delta >= estimate * 0.7 && delta <= estimate * 1.4) return delta
  return undefined
}

export function txFromOp(data: Data, op: SmsOp, hash: string, fallbackAt: number, report: IngestReport): Tx {
  const acc = ensureCard(data, op, report)
  const at = op.at ?? fallbackAt
  const tx: Tx = {
    id: newId('t'),
    kind: 'expense',
    amount: op.amount,
    currency: op.currency,
    category: 'other',
    account: acc.id,
    at,
    src: 'sms',
    sms: hash
  }
  if (op.merchant) tx.merchant = merchantKey(op.merchant)
  if (op.mcc !== undefined) tx.mcc = op.mcc
  if (op.city) tx.city = op.city
  if (op.kind === 'cash') {
    tx.kind = 'transfer'
    tx.category = TRANSFER_CATEGORY
    tx.to = ensureCash(data).id
    tx.title = 'Снятие наличных'
  } else if (op.kind === 'income') {
    tx.kind = 'income'
    tx.category = incomeCategory(data, op)
  } else {
    tx.kind = op.kind
    tx.category = resolveCategory(data, op.merchant, op.mcc, 'expense')
  }
  const base = baseFromBalance(data, acc, op, at)
  if (base !== undefined) tx.base = base
  if (op.balance !== undefined && op.balanceCurrency === acc.currency) {
    tx.bal = op.balance
    if (!acc.snap || at >= acc.snap.at) acc.snap = { bal: op.balance, at }
  }
  return tx
}

/** Добавить SMS в данные. Возвращает НОВЫЙ объект данных и отчёт. Повторы и отказы пропускаются. */
export function ingest(prev: Data, items: IngestItem[], now = Date.now()): { data: Data; report: IngestReport } {
  const data: Data = {
    ...prev,
    txs: [...prev.txs],
    accounts: prev.accounts.map(a => ({ ...a })),
    pending: [...prev.pending]
  }
  const report: IngestReport = { added: [], pending: [], duplicates: 0, declined: 0, ignored: 0, newAccounts: [] }
  const seen = new Set<string>()
  for (const t of data.txs) if (t.sms) seen.add(t.sms)
  for (const p of data.pending) seen.add(p.id)

  // Старые SMS первыми — так остаток карты и разница остатков считаются по порядку
  const parsed = items
    .map(it => ({ it, r: parseSms(it.text) }))
    .sort((a, b) => ((a.r.ok ? a.r.op.at : undefined) ?? a.it.at ?? now) - ((b.r.ok ? b.r.op.at : undefined) ?? b.it.at ?? now))

  for (const { it, r } of parsed) {
    if (seen.has(r.hash)) { report.duplicates++; continue }
    seen.add(r.hash)
    if (!r.ok) {
      if (r.reason === 'declined') { report.declined++; continue }
      if (r.reason === 'unknown-operation') {
        const p: Pending = { id: r.hash, text: it.text.trim(), at: r.hint?.at ?? it.at ?? now, reason: FAIL_TEXT[r.reason] }
        data.pending.push(p)
        report.pending.push(p)
        continue
      }
      report.ignored++
      continue
    }
    const tx = txFromOp(data, r.op, r.hash, it.at ?? now, report)
    data.txs.push(tx)
    report.added.push(tx)
  }
  data.txs.sort((a, b) => b.at - a.at)
  return { data, report }
}
