// Демо-данные: три месяца жизни, собранные из настоящих по формату SMS — заодно проверяют разбор.

import { DAY, startOfDay } from './dates'
import { ingest, type IngestItem } from './ingest'
import { newId, type Data } from './model'

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

function sms(op: string, amount: number, cur: string, at: number, merchant: string, city: string, mcc: number, bal: number): string {
  const d = new Date(at)
  return `${op} ${(amount / 100).toFixed(2)} ${cur}\nKARTA #4417\nDATA ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}\n` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${merchant} >g\n${city}>BY MCC:${mcc}\nOSTATOK ${(bal / 100).toFixed(2)} BYN`
}

export function demoData(base: Data, now = Date.now()): Data {
  const r = rng(42)
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)]
  const between = (a: number, b: number) => Math.round((a + r() * (b - a)) * 100)
  const items: IngestItem[] = []
  let bal = 84_250
  const today = startOfDay(now)
  const startDay = today - 95 * DAY
  const events: { at: number; op: string; amount: number; merchant: string; mcc: number; cur?: string }[] = []

  for (let d = startDay; d <= today; d += DAY) {
    const date = new Date(d)
    const dom = date.getDate()
    const wd = date.getDay()
    const t = (h: number, m = Math.floor(r() * 60)) => d + h * 3600_000 + m * 60_000 + Math.floor(r() * 60) * 1000
    if (dom === 5) events.push({ at: t(10), op: 'ZACHISLENIE', amount: 245_000, merchant: 'ZARPLATA', mcc: 6012 })
    if (dom === 20) events.push({ at: t(10), op: 'ZACHISLENIE', amount: 110_000, merchant: 'AVANS ZARPLATA', mcc: 6012 })
    if (wd >= 1 && wd <= 5) {
      events.push({ at: t(8), op: 'OPLATA', amount: 115, merchant: 'TRANSPORT PAYBYCARD.BY', mcc: 4111 })
      events.push({ at: t(18), op: 'OPLATA', amount: 115, merchant: 'TRANSPORT PAYBYCARD.BY', mcc: 4111 })
    }
    if (r() < 0.55) events.push({ at: t(19), op: 'OPLATA', amount: between(8, 65), merchant: pick(['EVROOPT', 'SANTA', 'GREEN', 'KORONA', 'HIT DISKONT']), mcc: 5411 })
    if (r() < 0.3) events.push({ at: t(13), op: 'OPLATA', amount: between(6, 28), merchant: pick(['COFFEE POINT', 'MAK.BY', 'KFC', 'STARBUCKS', 'DODO PIZZA']), mcc: pick([5812, 5814]) })
    if (r() < 0.08) events.push({ at: t(22), op: 'OPLATA', amount: between(7, 22), merchant: 'YANDEX.GO', mcc: 4121 })
    if (r() < 0.05) events.push({ at: t(16), op: 'OPLATA', amount: between(9, 60), merchant: 'APTEKA BELFARMACIYA', mcc: 5912 })
    if (r() < 0.04) events.push({ at: t(15), op: 'OPLATA', amount: between(40, 180), merchant: pick(['WILDBERRIES', 'OZON', '21VEK.BY']), mcc: 5311 })
    if (r() < 0.025) events.push({ at: t(17), op: 'OPLATA', amount: between(80, 260), merchant: pick(['ZARA', 'H&M', 'SPORTMASTER']), mcc: 5651 })
    if (r() < 0.03) events.push({ at: t(20), op: 'OPLATA', amount: between(15, 45), merchant: 'SILVER SCREEN', mcc: 7832 })
    if (dom === 3) events.push({ at: t(9), op: 'OPLATA', amount: 2590, merchant: 'A1 MOBILE', mcc: 4814 })
    if (dom === 12) events.push({ at: t(9), op: 'OPLATA', amount: 1499, merchant: 'YANDEX.PLUS', mcc: 5815 })
    if (dom === 18) events.push({ at: t(9), op: 'OPLATA', amount: 1099, merchant: 'SPOTIFY', mcc: 5815, cur: 'USD' })
    if (dom === 25) events.push({ at: t(11), op: 'OPLATA', amount: between(150, 190), merchant: 'ERIP KOMMUNALNYE PLATEZHI', mcc: 4900 })
    if (dom === 8) events.push({ at: t(12), op: 'SNYATIE NALICHNYH', amount: 10_000, merchant: 'ATM BELARUSBANK', mcc: 6011 })
    if (dom === 14 && r() < 0.7) events.push({ at: t(18), op: 'OPLATA', amount: 6500, merchant: 'FITNES KLUB ATLETIKA', mcc: 7997 })
  }
  // Возврат за одну из покупок
  events.push({ at: today - 9 * DAY + 14 * 3600_000, op: 'VOZVRAT', amount: 4990, merchant: 'WILDBERRIES', mcc: 5311 })

  events.sort((a, b) => a.at - b.at)
  for (const e of events) {
    if (e.at > now) continue
    const cur = e.cur ?? 'BYN'
    const inByn = cur === 'USD' ? Math.round(e.amount * 3.04) : e.amount
    bal += e.op === 'ZACHISLENIE' || e.op === 'VOZVRAT' ? inByn : -inByn
    items.push({ text: sms(e.op, e.amount, cur, e.at, e.merchant, 'MINSK', e.mcc, bal), at: e.at })
  }

  const { data } = ingest(base, items, now)
  // Немного наличных трат вручную
  const cash = data.accounts.find(a => a.kind === 'cash')
  if (cash) {
    for (let i = 0; i < 6; i++) {
      const at = today - Math.floor(r() * 60) * DAY + 12 * 3600_000
      data.txs.push({ id: newId('t'), kind: 'expense', amount: between(3, 25), currency: 'BYN', category: pick(['food', 'cafe', 'other']), account: cash.id, at, src: 'demo', note: pick(['Рынок', 'Кофе с собой', 'Цветы']) })
    }
  }
  const card = data.accounts.find(a => a.kind === 'card')
  if (card) card.name = 'Беларусбанк'
  data.txs = data.txs.map(t => (t.src === 'sms' ? { ...t, src: 'demo' as const } : t))
  data.txs.sort((a, b) => b.at - a.at)
  data.categories = data.categories.map(c =>
    c.id === 'food' ? { ...c, budget: 60_000 } : c.id === 'cafe' ? { ...c, budget: 20_000 } : c.id === 'shopping' ? { ...c, budget: 25_000 } : c)
  data.settings = { ...data.settings, budget: 220_000 }
  return data
}
