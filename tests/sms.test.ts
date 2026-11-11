import { describe, expect, it } from 'vitest'
import { parseSms, smsHash } from '../src/lib/sms'

const REAL = `OPLATA 1.15 BYN
KARTA #6901
DATA 10.11.2026
14:20:21 TRANSPORT
PAYBYCARD.BY   >g
MINSK>BY MCC:4111
OSTATOK 186.00 BYN`

describe('SMS Беларусбанка', () => {
  it('разбирает настоящую SMS об оплате', () => {
    const r = parseSms(REAL)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.op).toMatchObject({
      kind: 'expense', op: 'OPLATA', amount: 115, currency: 'BYN', last4: '6901',
      merchant: 'TRANSPORT PAYBYCARD.BY', city: 'MINSK', country: 'BY', mcc: 4111,
      balance: 18600, balanceCurrency: 'BYN'
    })
    const d = new Date(r.op.at!)
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([2026, 10, 10, 14, 20, 21])
  })

  it('одинаковый текст с другими переносами даёт тот же отпечаток', () => {
    expect(smsHash(REAL)).toBe(smsHash(REAL.replace(/\n/g, ' ')))
    expect(smsHash(REAL)).not.toBe(smsHash(REAL.replace('14:20:21', '14:59:52')))
  })

  it('пополнение — доход', () => {
    const r = parseSms('ZACHISLENIE 1250.00 BYN KARTA #6901 DATA 05.11.2026 10:01:00 ZARPLATA >g MINSK>BY OSTATOK 1436.00 BYN')
    expect(r.ok && r.op.kind).toBe('income')
    expect(r.ok && r.op.amount).toBe(125000)
  })

  it('возврат', () => {
    const r = parseSms('VOZVRAT 49.90 BYN KARTA #6901 DATA 05.11.2026 10:01:00 WILDBERRIES >g MINSK>BY MCC:5311 OSTATOK 100.00 BYN')
    expect(r.ok && r.op.kind).toBe('refund')
  })

  it('снятие наличных — по слову и по MCC', () => {
    const a = parseSms('SNYATIE NALICHNYH 100.00 BYN KARTA #6901 DATA 05.11.2026 10:01:00 ATM BELARUSBANK >g MINSK>BY MCC:6011 OSTATOK 50.00 BYN')
    expect(a.ok && a.op.kind).toBe('cash')
    const b = parseSms('OPLATA 100.00 BYN KARTA #6901 DATA 05.11.2026 10:01:00 ATM 123 >g MINSK>BY MCC:6011 OSTATOK 50.00 BYN')
    expect(b.ok && b.op.kind).toBe('cash')
  })

  it('отказ не записывается', () => {
    const r = parseSms('OTKAZ OPLATA 12.00 BYN KARTA #6901 DATA 05.11.2026 10:01:00 SHOP >g MINSK>BY NEDOSTATOCHNO SREDSTV')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reason).toBe('declined')
  })

  it('коды подтверждения — не операции', () => {
    const r = parseSms('Kod podtverzhdeniya: 123456. Nikomu ne soobshchayte.')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reason).toBe('not-transaction')
  })

  it('незнакомая операция уходит на разбор с подсказкой', () => {
    const r = parseSms('BLOKIROVKA 10.00 BYN KARTA #6901 DATA 05.11.2026 10:01:00 SHOP >g MINSK>BY OSTATOK 50.00 BYN')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reason).toBe('unknown-operation')
    expect(!r.ok && r.hint?.amount).toBe(1000)
  })

  it('валютная покупка и большие суммы с пробелами', () => {
    const r = parseSms('OPLATA 10.99 USD KARTA #6901 DATA 18.10.2026 09:00:00 SPOTIFY >g STOCKHOLM>SE MCC:5815 OSTATOK 1 234.56 BYN')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.op.currency).toBe('USD')
    expect(r.op.amount).toBe(1099)
    expect(r.op.balance).toBe(123456)
    expect(r.op.city).toBe('STOCKHOLM')
    expect(r.op.country).toBe('SE')
  })

  it('отрицательный остаток (овердрафт)', () => {
    const r = parseSms('OPLATA 5.00 BYN KARTA #6901 DATA 05.11.2026 10:01:00 SHOP >g MINSK>BY MCC:5411 OSTATOK -3.50 BYN')
    expect(r.ok && r.op.balance).toBe(-350)
  })

  it('без даты и магазина — всё равно сумма и карта', () => {
    const r = parseSms('OPLATA 3.00 BYN KARTA #1234 OSTATOK 10.00 BYN')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.op.amount).toBe(300)
    expect(r.op.last4).toBe('1234')
    expect(r.op.at).toBeUndefined()
  })
})
