import { describe, expect, it } from 'vitest'
import { ingest } from '../src/lib/ingest'
import { accountBalance, defaultData } from '../src/lib/model'
import { applyImport, isImportFile, type ImportFile } from '../src/lib/statement'

const file: ImportFile = {
  kopeyka: 'import', v: 1,
  account: { last4: '5308', name: 'Беларусбанк' },
  rows: [
    { at: '2026-08-11T16:42', kind: 'income', amount: 1500, currency: 'BYN', category: 'transfer_in', title: 'Перевод на карту', bal: 2355 },
    { at: '2026-08-12T22:33', kind: 'expense', amount: 38968, currency: 'RUB', base: 1437, merchant: 'FUNPAY', category: 'fun', bal: 2468 },
    { at: '2026-09-06T00:00', kind: 'expense', amount: 2178, currency: 'BYN', merchant: 'SHOP EVROOPT', bal: 11382 },
    { at: '2026-11-10T14:20', kind: 'expense', amount: 115, currency: 'BYN', merchant: 'TRANSPORT PAYBYCARD.BY', bal: 25000 }
  ]
}

describe('загрузка выписки', () => {
  it('узнаёт файл', () => {
    expect(isImportFile(file)).toBe(true)
    expect(isImportFile({ txs: [] })).toBe(false)
  })

  it('добавляет операции, категории и остаток', () => {
    const { data, report } = applyImport(defaultData(), file)
    expect(report.added).toHaveLength(4)
    const card = data.accounts.find(a => a.last4 === '5308')!
    expect(card.name).toBe('Беларусбанк')
    const rub = data.txs.find(t => t.currency === 'RUB')!
    expect(rub.base).toBe(1437)
    expect(rub.category).toBe('fun')
    // Категория по названию магазина, если не задана
    expect(data.txs.find(t => t.merchant === 'SHOP EVROOPT')!.category).toBe('food')
    expect(accountBalance(card, data.txs, data.settings)).toBe(25000)
  })

  it('повторная загрузка ничего не задваивает', () => {
    const first = applyImport(defaultData(), file)
    const second = applyImport(first.data, file)
    expect(second.report.added).toHaveLength(0)
    expect(second.report.duplicates).toBe(4)
  })

  it('не дублирует операции, уже пришедшие из SMS', () => {
    const sms = 'OPLATA 1.15 BYN KARTA #5308 DATA 10.11.2026 14:20:21 TRANSPORT PAYBYCARD.BY >g MINSK>BY MCC:4111 OSTATOK 248.85 BYN'
    const withSms = ingest(defaultData(), [{ text: sms }]).data
    const { data, report } = applyImport(withSms, file)
    expect(report.duplicates).toBe(1)
    expect(report.added).toHaveLength(3)
    // Остаток из SMS свежее — он и остаётся
    const card = data.accounts.find(a => a.last4 === '5308')!
    expect(card.snap!.bal).toBe(24885)
  })
})

describe('названия мест из выписки', () => {
  it('добавляются, но не перезаписывают свои', () => {
    const base = defaultData()
    base.names['SHOP EVROOPT'] = 'Мой Евроопт'
    const { data } = applyImport(base, { ...file, names: { 'SHOP EVROOPT': 'Евроопт', 'FUNPAY': 'FunPay' } })
    expect(data.names['SHOP EVROOPT']).toBe('Мой Евроопт')
    expect(data.names['FUNPAY']).toBe('FunPay')
  })
})
