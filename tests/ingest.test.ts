import { describe, expect, it } from 'vitest'
import { ingest, resolveCategory } from '../src/lib/ingest'
import { accountBalance, defaultData } from '../src/lib/model'

const A = `OPLATA 1.15 BYN
KARTA #5308
DATA 10.11.2026
14:20:21 TRANSPORT
PAYBYCARD.BY   >g
MINSK>BY MCC:4111
OSTATOK 250.00 BYN`
const B = A.replace('14:20:21', '14:59:52').replace('250.00', '248.85')

describe('запись SMS', () => {
  it('создаёт карту, категорию и остаток', () => {
    const { data, report } = ingest(defaultData(), [{ text: A }, { text: B }])
    expect(report.added).toHaveLength(2)
    expect(report.newAccounts).toHaveLength(1)
    const card = data.accounts.find(a => a.last4 === '5308')!
    expect(card.snap?.bal).toBe(24885)
    expect(data.txs.every(t => t.category === 'transport')).toBe(true)
    expect(accountBalance(card, data.txs, data.settings)).toBe(24885)
    // Новые сверху
    expect(data.txs[0].bal).toBe(24885)
  })

  it('не записывает одну SMS дважды', () => {
    const first = ingest(defaultData(), [{ text: A }])
    const second = ingest(first.data, [{ text: A }, { text: A.replace(/\n/g, ' ') }])
    expect(second.report.added).toHaveLength(0)
    expect(second.report.duplicates).toBe(2)
    expect(second.data.txs).toHaveLength(1)
  })

  it('исходные данные не меняются', () => {
    const base = defaultData()
    const snapshot = JSON.stringify(base)
    ingest(base, [{ text: A }])
    expect(JSON.stringify(base)).toBe(snapshot)
  })

  it('правило пользователя важнее MCC', () => {
    const d = defaultData()
    d.rules['TRANSPORT PAYBYCARD.BY'] = 'fun'
    expect(resolveCategory(d, 'TRANSPORT PAYBYCARD.BY', 4111)).toBe('fun')
    expect(resolveCategory(d, 'SOMETHING', 4111)).toBe('transport')
    expect(resolveCategory(d, 'WILDBERRIES', 5999)).toBe('shopping')
    expect(resolveCategory(d, 'YANDEX.PLUS', 5399)).toBe('subs')
    expect(resolveCategory(d, 'NONAME', undefined)).toBe('other')
  })

  it('снятие наличных переводит деньги в кошелёк', () => {
    const atm = 'SNYATIE NALICHNYH 100.00 BYN KARTA #5308 DATA 05.11.2026 10:01:00 ATM >g MINSK>BY MCC:6011 OSTATOK 50.00 BYN'
    const { data } = ingest(defaultData(), [{ text: atm }])
    const tx = data.txs[0]
    expect(tx.kind).toBe('transfer')
    const cash = data.accounts.find(a => a.kind === 'cash')!
    expect(tx.to).toBe(cash.id)
    expect(accountBalance(cash, data.txs, data.settings)).toBe(10000)
  })

  it('валютная покупка считается в рублях по разнице остатков', () => {
    const before = 'OPLATA 1.00 BYN KARTA #5308 DATA 17.10.2026 09:00:00 SHOP >g MINSK>BY MCC:5411 OSTATOK 500.00 BYN'
    const usd = 'OPLATA 10.99 USD KARTA #5308 DATA 18.10.2026 09:00:00 SPOTIFY >g STOCKHOLM>SE MCC:5815 OSTATOK 466.10 BYN'
    const { data } = ingest(defaultData(), [{ text: usd }, { text: before }])
    const tx = data.txs.find(t => t.currency === 'USD')!
    expect(tx.base).toBe(3390)
    expect(tx.category).toBe('subs')
  })

  it('незнакомая операция ждёт решения', () => {
    const { data, report } = ingest(defaultData(), [{ text: 'BLOKIROVKA 10.00 BYN KARTA #5308 OSTATOK 1.00 BYN', at: 1 }])
    expect(report.pending).toHaveLength(1)
    expect(data.pending).toHaveLength(1)
    expect(data.txs).toHaveLength(0)
  })
})
