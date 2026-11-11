// Состояние приложения: данные (сохраняются на устройстве), навигация, шторки, уведомления, синхронизация.

import { batch, computed, effect, signal } from '@preact/signals'
import { demoData } from './lib/demo'
import { ingest, merchantKey, type IngestItem, type IngestReport } from './lib/ingest'
import { accountBalance, baseAmount, convert, defaultData, newId, type Category, type Data, type Settings, type Tx } from './lib/model'
import { plural } from './lib/money'
import { parseSms } from './lib/sms'
import { load, save, STORAGE_KEY } from './lib/storage'
import { ack, pull } from './lib/sync'

const initial = load()
export const data = signal<Data>(initial.data)
export const storageAvailable = initial.available
export const saveFailed = signal(false)

let timer: ReturnType<typeof setTimeout> | undefined
effect(() => {
  const d = data.value
  clearTimeout(timer)
  if (!storageAvailable) return
  timer = setTimeout(() => { saveFailed.value = !save(d) }, 120)
})

export function flushSave() {
  clearTimeout(timer)
  if (storageAvailable) saveFailed.value = !save(data.value)
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave() })
  window.addEventListener('pagehide', flushSave)
  window.addEventListener('storage', e => {
    if (e.key !== STORAGE_KEY || !e.newValue) return
    const next = load()
    if (next.available && !next.fresh) { clearTimeout(timer); data.value = next.data }
  })
}

export function update(fn: (d: Data) => Data) {
  data.value = fn(data.value)
}

export function setSettings(patch: Partial<Settings>) {
  update(d => ({ ...d, settings: { ...d.settings, ...patch } }))
}

// ——— Тема ———

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const systemDark = signal(media ? media.matches : true)
media?.addEventListener('change', e => { systemDark.value = e.matches })
export const isDark = computed(() => {
  const t = data.value.settings.theme
  return t === 'dark' || (t === 'system' && systemDark.value)
})
if (typeof document !== 'undefined') {
  effect(() => {
    const dark = isDark.value
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111412' : '#F2F3EF')
  })
}

// ——— Навигация ———

export type Tab = 'home' | 'ops' | 'stats' | 'more'
export const tab = signal<Tab>('home')

export type SheetState =
  | { type: 'add'; kind?: Tx['kind']; category?: string; account?: string; editId?: string }
  | { type: 'tx'; id: string }
  | { type: 'category'; id: string; offset: number }
  | { type: 'sync' }
  | { type: 'paste' }
  | { type: 'account'; id?: string }
  | { type: 'accounts' }
  | { type: 'budgets' }
  | { type: 'categories' }
  | { type: 'editCategory'; id?: string; kind: 'expense' | 'income' }
  | { type: 'pending' }
  | { type: 'rates' }
  | { type: 'merchant'; key: string }
  | { type: 'recurring' }

export const sheets = signal<SheetState[]>([])
export function openSheet(s: SheetState) { sheets.value = [...sheets.value, s] }
export function closeSheet() { sheets.value = sheets.value.slice(0, -1) }
export function closeAllSheets() { sheets.value = [] }
export function replaceSheet(s: SheetState) { sheets.value = [...sheets.value.slice(0, -1), s] }

/** Сдвиг периода на экране аналитики (0 — текущий, -1 — прошлый…) */
export const statsOffset = signal(0)
export const statsKind = signal<'expense' | 'income'>('expense')

/** Фильтры экрана «Операции» */
export const opsQuery = signal('')
export const opsKind = signal<'all' | 'expense' | 'income' | 'transfer'>('all')
export const opsAccount = signal<string | null>(null)
export const opsCategory = signal<string | null>(null)

/** Операции, которые только что пришли — подсвечиваются */
export const fresh = signal<Set<string>>(new Set())

// ——— Уведомления ———

export interface Toast {
  id: number
  text: string
  tone?: 'good' | 'bad'
  action?: { label: string; run: () => void }
}
export const toast = signal<Toast | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined
export function showToast(text: string, opts: { action?: Toast['action']; tone?: Toast['tone']; ms?: number } = {}) {
  clearTimeout(toastTimer)
  toast.value = { id: Date.now(), text, action: opts.action, tone: opts.tone }
  toastTimer = setTimeout(() => { toast.value = null }, opts.ms ?? (opts.action ? 5000 : 2600))
}
export function hideToast() {
  clearTimeout(toastTimer)
  toast.value = null
}

// ——— Производные данные ———

export const activeAccounts = computed(() => data.value.accounts.filter(a => !a.archived))

export const balances = computed(() => {
  const d = data.value
  const map = new Map<string, number>()
  for (const a of d.accounts) map.set(a.id, accountBalance(a, d.txs, d.settings))
  return map
})

export const totalBalance = computed(() => {
  const d = data.value
  let sum = 0
  for (const a of d.accounts) {
    if (a.archived) continue
    sum += convert(balances.value.get(a.id) ?? 0, a.currency, d.settings)
  }
  return sum
})

export const catMap = computed(() => new Map(data.value.categories.map(c => [c.id, c])))

export function categoryOf(id: string): Category {
  return catMap.value.get(id) ?? { id, name: id === 'transfer' ? 'Перевод' : 'Другое', icon: id === 'transfer' ? 'transfer' : 'dots', color: '#8F9891', kind: 'expense' }
}

// ——— Операции ———

export function saveTx(tx: Tx) {
  update(d => {
    const exists = d.txs.some(t => t.id === tx.id)
    const txs = exists ? d.txs.map(t => (t.id === tx.id ? tx : t)) : [tx, ...d.txs]
    txs.sort((a, b) => b.at - a.at)
    return { ...d, txs }
  })
}

export function addTx(tx: Omit<Tx, 'id'>) {
  const full = { ...tx, id: newId('t') }
  saveTx(full)
  markFresh([full.id])
  return full
}

export function deleteTx(id: string) {
  const d = data.value
  const tx = d.txs.find(t => t.id === id)
  if (!tx) return
  update(x => ({ ...x, txs: x.txs.filter(t => t.id !== id) }))
  showToast('Операция удалена', { action: { label: 'Вернуть', run: () => { saveTx(tx); hideToast() } } })
}

/** Сменить категорию; если learn — запомнить для магазина и поправить его прошлые операции. */
export function recategorize(txId: string, category: string, learn: boolean) {
  update(d => {
    const tx = d.txs.find(t => t.id === txId)
    if (!tx) return d
    const key = tx.merchant ? merchantKey(tx.merchant) : null
    const isExpense = (t: Tx) => t.kind === 'expense' || t.kind === 'refund'
    const same = (t: Tx) => t.id === txId || (learn && key && t.merchant && merchantKey(t.merchant) === key && isExpense(t) === isExpense(tx) && t.kind !== 'transfer')
    const txs = d.txs.map(t => (same(t) ? { ...t, category } : t))
    const rules = learn && key ? { ...d.rules, [key]: category } : d.rules
    return { ...d, txs, rules }
  })
}

export function renameMerchant(key: string, name: string) {
  update(d => {
    const names = { ...d.names }
    if (name.trim()) names[key] = name.trim().slice(0, 60)
    else delete names[key]
    return { ...d, names }
  })
}

function markFresh(ids: string[]) {
  if (!ids.length) return
  fresh.value = new Set([...fresh.value, ...ids])
  setTimeout(() => {
    const next = new Set(fresh.value)
    ids.forEach(i => next.delete(i))
    fresh.value = next
  }, 6000)
}

export function reportText(r: IngestReport): string {
  const parts: string[] = []
  if (r.added.length) parts.push(`Записано ${r.added.length} ${plural(r.added.length, ['операция', 'операции', 'операций'])}`)
  if (r.pending.length) parts.push(`${r.pending.length} на разбор`)
  if (r.declined) parts.push(`${r.declined} ${plural(r.declined, ['отказ', 'отказа', 'отказов'])} пропущено`)
  if (!parts.length && r.duplicates) return 'Эти SMS уже записаны'
  if (!parts.length) return 'Новых операций нет'
  return parts.join(' · ')
}

export function ingestItems(items: IngestItem[]): IngestReport {
  const { data: next, report } = ingest(data.value, items)
  data.value = next
  markFresh(report.added.map(t => t.id))
  return report
}

/** Решить судьбу SMS, которую не удалось разобрать. */
export function resolvePending(id: string, as: 'expense' | 'income' | 'ignore') {
  const d = data.value
  const p = d.pending.find(x => x.id === id)
  if (!p) return
  const rest = d.pending.filter(x => x.id !== id)
  if (as === 'ignore') {
    data.value = { ...d, pending: rest }
    return
  }
  const r = parseSms(p.text)
  const hint = r.ok ? r.op : r.hint
  if (!hint) { data.value = { ...d, pending: rest }; return }
  const word = as === 'income' ? 'ZACHISLENIE' : 'OPLATA'
  const text = p.text.replace(hint.op, word)
  const { data: next, report } = ingest({ ...d, pending: rest }, [{ text, at: p.at }])
  data.value = next
  markFresh(report.added.map(t => t.id))
}

// ——— Синхронизация ———

export const syncing = signal(false)
export const syncError = signal<string | null>(null)
let lastSync = 0

export async function syncNow(manual = false): Promise<IngestReport | null> {
  const s = data.value.settings.sync
  if (!s || syncing.value) return null
  if (!manual && Date.now() - lastSync < 15_000) return null
  lastSync = Date.now()
  syncing.value = true
  try {
    const inbox = await pull(s)
    let report: IngestReport | null = null
    if (inbox.items.length) {
      report = ingestItems(inbox.items)
      flushSave()
      await ack(s, inbox.items.map(i => i.id))
    }
    batch(() => {
      syncError.value = null
      setSettings({ sync: { ...data.value.settings.sync!, lastAt: Date.now() } })
    })
    if (report && (report.added.length || report.pending.length)) showToast(reportText(report), { tone: 'good' })
    else if (manual) showToast('Новых операций нет')
    return report
  } catch (e) {
    syncError.value = (e as Error).message
    if (manual) showToast((e as Error).message, { tone: 'bad' })
    return null
  } finally {
    syncing.value = false
  }
}

if (typeof window !== 'undefined') {
  const tick = () => { if (document.visibilityState === 'visible') void syncNow() }
  document.addEventListener('visibilitychange', tick)
  window.addEventListener('online', tick)
  setInterval(tick, 60_000)
  setTimeout(tick, 400)
}

// ——— Демо ———

export function loadDemo() {
  const base = data.value
  const demo = demoData({ ...base, txs: base.txs.filter(t => t.src !== 'demo') })
  data.value = { ...demo, settings: { ...demo.settings, onboarded: true } }
}

export function clearDemo() {
  update(d => {
    const txs = d.txs.filter(t => t.src !== 'demo')
    const used = new Set(txs.flatMap(t => [t.account, t.to ?? '']))
    // Демо-карта (·4417) уходит вместе с демо-операциями, если на неё не пришло ничего настоящего
    const accounts = d.accounts.filter(a => !(a.kind === 'card' && a.last4 === '4417' && !used.has(a.id)))
    const categories = d.categories.map(c => ({ ...c, budget: undefined }))
    return { ...d, txs, accounts, categories, settings: { ...d.settings, budget: undefined } }
  })
}

export const hasDemo = computed(() => data.value.txs.some(t => t.src === 'demo'))

/** Сумма в основной валюте — удобный короткий вызов для компонентов. */
export function inBase(tx: Tx): number {
  return baseAmount(tx, data.value.settings)
}

export { defaultData }

/** Убрать следы проверки сервера: тестовую операцию и карту ·0000. */
export function removeTestArtifacts() {
  update(d => {
    const txs = d.txs.filter(t => t.merchant !== 'PROVERKA KOPEYKI')
    const used = new Set(txs.flatMap(t => [t.account, t.to ?? '']))
    const accounts = d.accounts.filter(a => !(a.kind === 'card' && a.last4 === '0000' && !used.has(a.id)))
    return { ...d, txs, accounts }
  })
}

/** Записать SMS из буфера обмена одной кнопкой. Возвращает false, если буфер прочитать не удалось. */
export async function pasteSmsFromClipboard(): Promise<boolean> {
  let text = ''
  try {
    text = await navigator.clipboard.readText()
  } catch {
    return false
  }
  const parts = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)
  if (!parts.length || !parts.some(p => parseSms(p).ok || /KARTA|OSTATOK/i.test(p))) {
    showToast('В буфере нет SMS банка. Скопируйте её в «Сообщениях»: долгое нажатие → «Скопировать»')
    return true
  }
  const report = ingestItems(parts.map(p => ({ text: p })))
  const ids = new Set(report.added.map(t => t.id))
  showToast(reportText(report), {
    tone: report.added.length ? 'good' : undefined,
    action: ids.size ? { label: 'Отменить', run: () => { update(d => ({ ...d, txs: d.txs.filter(t => !ids.has(t.id)) })); hideToast() } } : undefined
  })
  return true
}
