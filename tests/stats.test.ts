import { describe, expect, it } from 'vitest'
import { periodOf } from '../src/lib/dates'
import { demoData } from '../src/lib/demo'
import { formatMoney, parseAmount, plural } from '../src/lib/money'
import { accountBalance, defaultData, prettyMerchant, type Tx } from '../src/lib/model'
import { sanitize } from '../src/lib/storage'
import { byCategory, dailySpend, inPeriod, insights, pace, recurring, totals } from '../src/lib/stats'
import { exportCsv, importJson, exportJson } from '../src/lib/backup'

const NOW = new Date(2026, 10, 11, 12, 0).getTime()

describe('деньги', () => {
  it('формат', () => {
    expect(formatMoney(123456)).toBe('1 234,56 Br')
    expect(formatMoney(100)).toBe('1 Br')
    expect(formatMoney(-500, 'USD')).toBe('−$5')
    expect(formatMoney(1500, 'BYN', { sign: true })).toBe('+15 Br')
  })
  it('ввод', () => {
    expect(parseAmount('12,5')).toBe(1250)
    expect(parseAmount('1 234.56')).toBe(123456)
    expect(parseAmount('abc')).toBeNull()
  })
  it('склонение', () => {
    expect(plural(1, ['операция', 'операции', 'операций'])).toBe('операция')
    expect(plural(3, ['операция', 'операции', 'операций'])).toBe('операции')
    expect(plural(11, ['операция', 'операции', 'операций'])).toBe('операций')
    expect(plural(22, ['операция', 'операции', 'операций'])).toBe('операции')
  })
  it('названия магазинов', () => {
    expect(prettyMerchant('TRANSPORT PAYBYCARD.BY')).toBe('Проезд')
    expect(prettyMerchant('SILVER SCREEN')).toBe('Silver Screen')
    expect(prettyMerchant('OOO "ROMASHKA"')).toBe('Romashka')
  })
})

describe('периоды', () => {
  it('календарный месяц', () => {
    const p = periodOf(NOW)
    expect(new Date(p.start).getDate()).toBe(1)
    expect(new Date(p.end).getMonth()).toBe(11)
  })
  it('с дня зарплаты', () => {
    const p = periodOf(new Date(2026, 10, 3).getTime(), 5)
    expect(new Date(p.start).getMonth()).toBe(9)
    expect(new Date(p.start).getDate()).toBe(5)
    const q = periodOf(new Date(2026, 10, 3).getTime(), 5, 1)
    expect(new Date(q.start).getMonth()).toBe(10)
  })
  it('через год', () => {
    const p = periodOf(new Date(2026, 11, 15).getTime(), 1, 1)
    expect([new Date(p.start).getFullYear(), new Date(p.start).getMonth()]).toEqual([2027, 0])
  })
})

describe('итоги', () => {
  const d = defaultData()
  const mk = (kind: Tx['kind'], amount: number, category: string, at = NOW): Tx =>
    ({ id: Math.random().toString(), kind, amount, currency: 'BYN', category, account: 'cash', at })
  d.txs = [mk('expense', 1000, 'food'), mk('expense', 3000, 'cafe'), mk('refund', 500, 'cafe'), mk('income', 10000, 'salary')]

  it('возвраты уменьшают расходы', () => {
    const t = totals(d.txs, d.settings)
    expect(t.expense).toBe(3500)
    expect(t.income).toBe(10000)
    const cats = byCategory(d.txs, d)
    expect(cats.map(c => [c.cat.id, c.amount])).toEqual([['cafe', 2500], ['food', 1000]])
  })
  it('остаток наличных', () => {
    expect(accountBalance(d.accounts[0], d.txs, d.settings)).toBe(10000 - 4000 + 500)
  })
  it('по дням', () => {
    const p = periodOf(NOW)
    const daily = dailySpend(d.txs, p, d.settings)
    expect(daily[10]).toBe(3500)
    expect(daily.reduce((a, b) => a + b, 0)).toBe(3500)
  })
  it('бюджет и прогноз', () => {
    const dd = { ...d, settings: { ...d.settings, budget: 30000 } }
    const pc = pace(dd, NOW)
    expect(pc.spent).toBe(3500)
    expect(pc.elapsed).toBe(11)
    expect(pc.left).toBe(26500)
    expect(pc.perDay).toBe(Math.floor(26500 / 20))
  })
})

describe('демо-данные', () => {
  const demo = demoData(defaultData(), NOW)
  it('собираются из SMS и выглядят правдоподобно', () => {
    expect(demo.txs.length).toBeGreaterThan(150)
    const card = demo.accounts.find(a => a.kind === 'card')!
    expect(card.snap).toBeDefined()
    const cur = inPeriod(demo.txs, periodOf(NOW))
    expect(totals(cur, demo.settings).expense).toBeGreaterThan(0)
  })
  it('находит регулярные платежи', () => {
    const rec = recurring(demo, NOW).map(r => r.key)
    expect(rec).toContain('A1 MOBILE')
    expect(rec).toContain('YANDEX.PLUS')
    expect(rec).not.toContain('TRANSPORT PAYBYCARD.BY')
  })
  it('подсказки', () => {
    expect(insights(demo, NOW).length).toBeGreaterThan(0)
  })
  it('копия сохраняется и читается без потерь', () => {
    const back = importJson(exportJson(demo))
    expect(back.txs).toHaveLength(demo.txs.length)
    expect(back.accounts).toEqual(demo.accounts)
    expect(sanitize(JSON.parse(JSON.stringify(demo)))).toEqual(demo)
  })
  it('CSV', () => {
    const csv = exportCsv(demo)
    expect(csv.split('\r\n')).toHaveLength(demo.txs.length + 1)
    expect(csv).toContain('Проезд')
  })
  it('чужой файл не принимается', () => {
    expect(() => importJson('{"hello":1}')).toThrow()
    expect(() => importJson('not json')).toThrow()
  })
})
