// Хранение на устройстве. Всё, что приходит снаружи (файл копии, старая версия), проверяется.

import { defaultData, type Account, type Category, type Data, type Kind, type Pending, type Tx } from './model'

export const STORAGE_KEY = 'kopeyka:v1'
const PREV_KEY = 'kopeyka:prev'

const isStr = (v: unknown, max = 500): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.round(v) === v
const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)
const KINDS: Kind[] = ['expense', 'income', 'transfer', 'refund']

export function sanitize(raw: unknown): Data {
  if (!raw || typeof raw !== 'object') throw new Error('Файл не похож на копию «Копейки»')
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.txs) || !Array.isArray(r.accounts)) throw new Error('Файл не похож на копию «Копейки»')
  const base = defaultData()

  const categories: Category[] = []
  const catIds = new Set<string>()
  if (Array.isArray(r.categories)) {
    for (const c of r.categories as Record<string, unknown>[]) {
      if (!c || !isStr(c.id, 64) || !isStr(c.name, 40) || catIds.has(c.id)) continue
      if (c.kind !== 'expense' && c.kind !== 'income') continue
      const cat: Category = {
        id: c.id, name: c.name, kind: c.kind,
        icon: isStr(c.icon, 32) ? c.icon : 'dots',
        color: isColor(c.color) ? c.color : '#7C8594'
      }
      if (isInt(c.budget) && c.budget > 0) cat.budget = c.budget
      if (c.archived === true) cat.archived = true
      categories.push(cat)
      catIds.add(cat.id)
    }
  }
  // Базовые категории нужны всегда
  for (const c of base.categories) if (!catIds.has(c.id)) { categories.push(c); catIds.add(c.id) }

  const accounts: Account[] = []
  const accIds = new Set<string>()
  for (const a of r.accounts as Record<string, unknown>[]) {
    if (!a || !isStr(a.id, 64) || !isStr(a.name, 40) || accIds.has(a.id)) continue
    const kind = a.kind === 'card' || a.kind === 'cash' || a.kind === 'savings' ? a.kind : 'card'
    const acc: Account = {
      id: a.id, name: a.name, kind,
      currency: isStr(a.currency, 3) ? a.currency : base.settings.base,
      color: isColor(a.color) ? a.color : '#D9824A',
      start: isInt(a.start) ? a.start : 0
    }
    if (isStr(a.last4, 4)) acc.last4 = a.last4
    const snap = a.snap as Record<string, unknown> | undefined
    if (snap && isInt(snap.bal) && isInt(snap.at)) acc.snap = { bal: snap.bal, at: snap.at }
    if (a.archived === true) acc.archived = true
    accounts.push(acc)
    accIds.add(acc.id)
  }
  if (!accounts.length) accounts.push(...base.accounts)

  const txs: Tx[] = []
  const txIds = new Set<string>()
  for (const t of r.txs as Record<string, unknown>[]) {
    if (!t || !isStr(t.id, 64) || txIds.has(t.id)) continue
    if (!KINDS.includes(t.kind as Kind) || !isInt(t.amount) || t.amount <= 0 || !isInt(t.at)) continue
    if (!isStr(t.account, 64) || !accIds.has(t.account)) continue
    const kind = t.kind as Kind
    const tx: Tx = {
      id: t.id, kind, amount: t.amount, at: t.at, account: t.account,
      currency: isStr(t.currency, 3) ? t.currency : base.settings.base,
      category: isStr(t.category, 64) && (catIds.has(t.category) || t.category === 'transfer') ? t.category : kind === 'income' ? 'other_in' : kind === 'transfer' ? 'transfer' : 'other'
    }
    if (kind === 'transfer') {
      if (!isStr(t.to, 64) || !accIds.has(t.to)) continue
      tx.to = t.to
    }
    if (isInt(t.base) && t.base > 0) tx.base = t.base
    if (isStr(t.merchant, 120)) tx.merchant = t.merchant
    if (isStr(t.title, 80)) tx.title = t.title
    if (isStr(t.note, 500)) tx.note = t.note
    if (isInt(t.mcc)) tx.mcc = t.mcc
    if (isStr(t.city, 60)) tx.city = t.city
    if (t.src === 'sms' || t.src === 'manual' || t.src === 'import' || t.src === 'demo') tx.src = t.src
    if (isStr(t.sms, 40)) tx.sms = t.sms
    if (isInt(t.bal)) tx.bal = t.bal
    txs.push(tx)
    txIds.add(tx.id)
  }
  txs.sort((a, b) => b.at - a.at)

  const strMap = (v: unknown, valid?: (x: string) => boolean): Record<string, string> => {
    const out: Record<string, string> = {}
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (isStr(k, 120) && isStr(x, 80) && (!valid || valid(x))) out[k] = x
    }
    return out
  }

  const pending: Pending[] = []
  if (Array.isArray(r.pending)) for (const p of r.pending as Record<string, unknown>[]) {
    if (p && isStr(p.id, 40) && isStr(p.text, 2000) && isInt(p.at)) pending.push({ id: p.id, text: p.text, at: p.at, reason: isStr(p.reason, 200) ? p.reason : '' })
  }

  const s = (r.settings && typeof r.settings === 'object' ? r.settings : {}) as Record<string, unknown>
  const rates: Record<string, number> = { ...base.settings.rates }
  if (s.rates && typeof s.rates === 'object') for (const [k, v] of Object.entries(s.rates as Record<string, unknown>)) {
    if (/^[A-Z]{3}$/.test(k) && typeof v === 'number' && v > 0 && Number.isFinite(v)) rates[k] = v
  }
  const settings: Data['settings'] = {
    theme: s.theme === 'dark' || s.theme === 'light' ? s.theme : 'system',
    base: isStr(s.base, 3) ? s.base : base.settings.base,
    rates,
    periodStart: isInt(s.periodStart) && s.periodStart >= 1 && s.periodStart <= 28 ? s.periodStart : 1,
    hide: s.hide === true,
    onboarded: s.onboarded !== false
  }
  if (isInt(s.ratesAt)) settings.ratesAt = s.ratesAt
  if (isInt(s.budget) && s.budget > 0) settings.budget = s.budget
  const sync = s.sync as Record<string, unknown> | undefined
  if (sync && isStr(sync.url, 300) && isStr(sync.key, 100)) {
    settings.sync = { url: sync.url, key: sync.key }
    if (isInt(sync.lastAt)) settings.sync.lastAt = sync.lastAt
  }

  return {
    v: 1, txs, accounts, categories, pending, settings,
    rules: strMap(r.rules, x => catIds.has(x)),
    names: strMap(r.names)
  }
}

export interface Loaded {
  data: Data
  available: boolean
  fresh: boolean
}

export function load(): Loaded {
  let ls: Storage
  try {
    ls = window.localStorage
    ls.getItem('x')
  } catch {
    return { data: defaultData(), available: false, fresh: true }
  }
  const raw = ls.getItem(STORAGE_KEY)
  if (!raw) return { data: defaultData(), available: true, fresh: true }
  try {
    return { data: sanitize(JSON.parse(raw)), available: true, fresh: false }
  } catch {
    // Основная копия повреждена — пробуем предыдущую
    try {
      const prev = ls.getItem(PREV_KEY)
      if (prev) return { data: sanitize(JSON.parse(prev)), available: true, fresh: false }
    } catch { /* нет */ }
    try { ls.setItem(STORAGE_KEY + ':broken:' + Date.now(), raw) } catch { /* место кончилось */ }
    return { data: defaultData(), available: true, fresh: true }
  }
}

let lastSaved = ''
export function save(d: Data): boolean {
  try {
    const json = JSON.stringify(d)
    if (json === lastSaved) return true
    const ls = window.localStorage
    const cur = ls.getItem(STORAGE_KEY)
    if (cur) ls.setItem(PREV_KEY, cur)
    ls.setItem(STORAGE_KEY, json)
    lastSaved = json
    return true
  } catch {
    return false
  }
}
