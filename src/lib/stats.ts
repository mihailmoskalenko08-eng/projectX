// Подсчёты для экранов: итоги периода, категории, графики, прогноз, регулярные платежи, подсказки.

import { DAY, addDays, daysIn, periodOf, startOfDay, type Period } from './dates'
import { merchantKey } from './ingest'
import { plural } from './money'
import { baseAmount, type Category, type Data, type Tx } from './model'

type S = Data['settings']

export function inPeriod(txs: Tx[], p: Period): Tx[] {
  return txs.filter(t => t.at >= p.start && t.at < p.end)
}

export interface Totals {
  /** Расходы минус возвраты */
  expense: number
  income: number
  refunds: number
  count: number
}

export function totals(txs: Tx[], s: S): Totals {
  let expense = 0, income = 0, refunds = 0, count = 0
  for (const t of txs) {
    const a = baseAmount(t, s)
    if (t.kind === 'expense') { expense += a; count++ }
    else if (t.kind === 'refund') { refunds += a; count++ }
    else if (t.kind === 'income') { income += a; count++ }
  }
  return { expense: Math.max(0, expense - refunds), income, refunds, count }
}

export interface CatSum {
  cat: Category
  amount: number
  count: number
  share: number
}

export function byCategory(txs: Tx[], data: Pick<Data, 'categories' | 'settings'>, kind: 'expense' | 'income' = 'expense'): CatSum[] {
  const map = new Map<string, { amount: number; count: number }>()
  for (const t of txs) {
    let sign = 0
    if (kind === 'expense') sign = t.kind === 'expense' ? 1 : t.kind === 'refund' ? -1 : 0
    else sign = t.kind === 'income' ? 1 : 0
    if (!sign) continue
    const e = map.get(t.category) ?? { amount: 0, count: 0 }
    e.amount += sign * baseAmount(t, data.settings)
    if (sign > 0) e.count++
    map.set(t.category, e)
  }
  const fallback = data.categories.find(c => c.id === (kind === 'expense' ? 'other' : 'other_in'))
  const list: CatSum[] = []
  let total = 0
  for (const [id, v] of map) {
    if (v.amount <= 0) continue
    const cat = data.categories.find(c => c.id === id) ?? fallback ?? { id, name: 'Другое', icon: 'dots', color: '#7C8594', kind }
    list.push({ cat, amount: v.amount, count: v.count, share: 0 })
    total += v.amount
  }
  for (const c of list) c.share = total ? c.amount / total : 0
  return list.sort((a, b) => b.amount - a.amount)
}

/** Расходы по дням периода. */
export function dailySpend(txs: Tx[], p: Period, s: S): number[] {
  const n = daysIn(p)
  const out = new Array<number>(n).fill(0)
  for (const t of txs) {
    if (t.at < p.start || t.at >= p.end) continue
    const i = Math.floor((startOfDay(t.at) - startOfDay(p.start)) / DAY + 0.5)
    if (i < 0 || i >= n) continue
    if (t.kind === 'expense') out[i] += baseAmount(t, s)
    else if (t.kind === 'refund') out[i] -= baseAmount(t, s)
  }
  return out.map(v => Math.max(0, v))
}

export function cumulative(xs: number[]): number[] {
  let acc = 0
  return xs.map(x => (acc += x))
}

export interface Pace {
  spent: number
  /** Прошло дней периода (включая сегодня) */
  elapsed: number
  total: number
  /** Прогноз расходов на весь период */
  forecast: number
  /** Сколько можно тратить в день до конца периода, чтобы уложиться в бюджет */
  perDay?: number
  /** Сколько осталось от бюджета */
  left?: number
}

export function pace(data: Data, now = Date.now()): Pace {
  const s = data.settings
  const p = periodOf(now, s.periodStart)
  const spent = totals(inPeriod(data.txs, p), s).expense
  const total = daysIn(p)
  const elapsed = Math.min(total, Math.max(1, Math.floor((startOfDay(now) - p.start) / DAY + 0.5) + 1))
  const forecast = elapsed >= 3 ? Math.round((spent / elapsed) * total) : spent
  const out: Pace = { spent, elapsed, total, forecast }
  const budget = s.budget ?? data.categories.reduce((a, c) => a + (c.kind === 'expense' && !c.archived && c.budget ? c.budget : 0), 0)
  if (budget > 0) {
    out.left = budget - spent
    const daysLeft = total - elapsed + 1
    out.perDay = Math.max(0, Math.floor(out.left / daysLeft))
  }
  return out
}

export interface Recurring {
  key: string
  merchant: string
  category: string
  amount: number
  months: number
  last: number
  next: number
}

/** Платежи, которые повторяются каждый месяц примерно на одну сумму (подписки, связь, кредит). */
export function recurring(data: Data, now = Date.now()): Recurring[] {
  const since = addDays(now, -130)
  const groups = new Map<string, Tx[]>()
  for (const t of data.txs) {
    if (t.kind !== 'expense' || !t.merchant || t.at < since) continue
    const k = merchantKey(t.merchant)
    const g = groups.get(k)
    if (g) g.push(t)
    else groups.set(k, [t])
  }
  const out: Recurring[] = []
  for (const [k, list] of groups) {
    if (list.length < 2) continue
    const months = new Set(list.map(t => { const d = new Date(t.at); return d.getFullYear() * 12 + d.getMonth() }))
    // Не больше двух платежей в месяц — иначе это обычный магазин, а не подписка
    if (months.size < 2 || list.length > months.size * 2) continue
    const amounts = list.map(t => baseAmount(t, data.settings))
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
    if (amounts.some(a => Math.abs(a - avg) > avg * 0.2 + 100)) continue
    const sorted = [...list].sort((a, b) => a.at - b.at)
    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) gaps.push((sorted[i].at - sorted[i - 1].at) / DAY)
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
    if (avgGap < 20 || avgGap > 40) continue
    const last = sorted[sorted.length - 1]
    if (now - last.at > 50 * DAY) continue
    out.push({
      key: k,
      merchant: k,
      category: last.category,
      amount: Math.round(avg),
      months: months.size,
      last: last.at,
      next: last.at + Math.round(avgGap) * DAY
    })
  }
  return out.sort((a, b) => a.next - b.next)
}

export interface MerchantSum {
  key: string
  amount: number
  count: number
  category: string
}

export function topMerchants(txs: Tx[], s: S, limit = 5): MerchantSum[] {
  const map = new Map<string, MerchantSum>()
  for (const t of txs) {
    if (t.kind !== 'expense' || !t.merchant) continue
    const k = merchantKey(t.merchant)
    const e = map.get(k) ?? { key: k, amount: 0, count: 0, category: t.category }
    e.amount += baseAmount(t, s)
    e.count++
    map.set(k, e)
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, limit)
}

/** Средние расходы по дням недели (пн…вс). */
export function weekdayPattern(txs: Tx[], s: S): number[] {
  const sum = new Array<number>(7).fill(0)
  const days = new Map<string, number>()
  for (const t of txs) {
    if (t.kind !== 'expense') continue
    const d = new Date(t.at)
    const wd = (d.getDay() + 6) % 7
    sum[wd] += baseAmount(t, s)
    days.set(d.toDateString(), wd)
  }
  const count = new Array<number>(7).fill(0)
  for (const wd of days.values()) count[wd]++
  return sum.map((v, i) => (count[i] ? Math.round(v / count[i]) : 0))
}

export interface Insight {
  icon: string
  tone: 'good' | 'bad' | 'neutral'
  text: string
}

/** Короткие наблюдения о текущем периоде по сравнению с прошлым. */
export function insights(data: Data, now = Date.now()): Insight[] {
  const s = data.settings
  const cur = periodOf(now, s.periodStart)
  const prev = periodOf(now, s.periodStart, -1)
  const curTx = inPeriod(data.txs, cur)
  const prevTx = inPeriod(data.txs, prev)
  if (!curTx.length) return []
  const out: Insight[] = []
  const pc = pace(data, now)

  // Сравнение с тем же днём прошлого периода
  const prevSameDay = totals(prevTx.filter(t => t.at < prev.start + (now - cur.start)), s).expense
  if (prevSameDay > 0 && pc.spent > 0) {
    const diff = (pc.spent - prevSameDay) / prevSameDay
    if (Math.abs(diff) >= 0.08) {
      out.push(diff < 0
        ? { icon: 'trendDown', tone: 'good', text: `Тратите на ${Math.round(-diff * 100)}% меньше, чем к этому дню в прошлом месяце` }
        : { icon: 'trendUp', tone: 'bad', text: `Тратите на ${Math.round(diff * 100)}% больше, чем к этому дню в прошлом месяце` })
    }
  }

  // Категория, которая выросла сильнее всего
  const curCats = byCategory(curTx, data)
  const prevCats = new Map(byCategory(prevTx, data).map(c => [c.cat.id, c.amount]))
  let jump: { name: string; pct: number } | null = null
  for (const c of curCats.slice(0, 6)) {
    const p = prevCats.get(c.cat.id)
    if (!p || p < 1000 || c.amount < 1000) continue
    const pct = (c.amount - p) / p
    if (pct > 0.3 && (!jump || pct > jump.pct)) jump = { name: c.cat.name, pct }
  }
  if (jump) out.push({ icon: 'flame', tone: 'bad', text: `«${jump.name}» уже на ${Math.round(jump.pct * 100)}% больше, чем за весь прошлый месяц` })

  // Самая крупная категория
  if (curCats[0] && curCats[0].share > 0.25) {
    out.push({ icon: 'pie', tone: 'neutral', text: `Больше всего уходит на «${curCats[0].cat.name}» — ${Math.round(curCats[0].share * 100)}% расходов` })
  }

  // Бюджет
  if (pc.left !== undefined) {
    if (pc.left < 0) out.push({ icon: 'alert', tone: 'bad', text: 'Бюджет месяца уже превышен' })
    else if (pc.forecast > pc.spent + pc.left) out.push({ icon: 'alert', tone: 'bad', text: 'В таком темпе бюджет закончится раньше конца месяца' })
    else out.push({ icon: 'check', tone: 'good', text: 'В таком темпе вы укладываетесь в бюджет' })
  }

  // Дни без трат
  const daily = dailySpend(curTx, cur, s).slice(0, pc.elapsed)
  const zero = daily.filter(v => v === 0).length
  if (zero >= 2) out.push({ icon: 'leaf', tone: 'good', text: `${zero} ${plural(zero, ['день', 'дня', 'дней'])} без трат в этом месяце` })

  return out.slice(0, 4)
}

/** Ряд остатков для графика «сколько денег было» за последние N дней (по всем счетам). */
export function balanceSeries(data: Data, totalNow: number, days = 30, now = Date.now()): number[] {
  const s = data.settings
  const out: number[] = []
  let bal = totalNow
  const end = startOfDay(now) + DAY
  const byDay = new Map<number, number>()
  for (const t of data.txs) {
    if (t.kind === 'transfer') continue
    const d = startOfDay(t.at)
    const delta = (t.kind === 'expense' ? -1 : 1) * baseAmount(t, s)
    byDay.set(d, (byDay.get(d) ?? 0) + delta)
  }
  for (let i = 0; i < days; i++) {
    const d = startOfDay(end - DAY * (i + 1))
    out.push(bal)
    bal -= byDay.get(d) ?? 0
  }
  return out.reverse()
}
