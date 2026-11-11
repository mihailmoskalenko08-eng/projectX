// Разбор SMS банка. Сделан под Беларусбанк (отправитель asb.by), но понимает и похожие форматы:
//
//   OPLATA 1.15 BYN KARTA #5308 DATA 10.11.2026 14:20:21 TRANSPORT PAYBYCARD.BY >g MINSK>BY MCC:4111 OSTATOK 250.00 BYN
//
// Порядок полей и переносы строк могут отличаться — ищем каждое поле отдельно.

import { CASH_MCC } from './mcc'

export type SmsKind = 'expense' | 'income' | 'refund' | 'cash'

export interface SmsOp {
  kind: SmsKind
  /** Слово операции из SMS: OPLATA, ZACHISLENIE… */
  op: string
  amount: number
  currency: string
  last4?: string
  at?: number
  merchant?: string
  city?: string
  country?: string
  mcc?: number
  balance?: number
  balanceCurrency?: string
}

export type SmsFail = 'empty' | 'not-transaction' | 'declined' | 'unknown-operation'

export type SmsResult =
  | { ok: true; op: SmsOp; hash: string }
  | { ok: false; reason: SmsFail; hash: string; hint?: SmsOp }

export function normalizeSms(text: string): string {
  return text
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Отпечаток SMS (FNV-1a), чтобы одна и та же SMS не записалась дважды. */
export function smsHash(text: string): string {
  const s = normalizeSms(text).toUpperCase()
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0
  }
  return h1.toString(36) + h2.toString(36)
}

const toMinor = (s: string): number => Math.round(parseFloat(s.replace(/\s/g, '').replace(',', '.')) * 100)

const AMOUNT = String.raw`(\d{1,3}(?:[ ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`

const DECLINED = /OTKAZ|OTKLON|DECLIN|NEDOSTATOCHNO|NEUSPESH|ОТКАЗ|ОТКЛОН/
const CASH = /SNYAT|NALICH|CASH|BANKOMAT|\bATM\b|СНЯТИЕ|НАЛИЧН/
const REFUND = /VOZVRAT|OTMENA|REFUND|STORNO|REVERS|ВОЗВРАТ|ОТМЕНА/
const INCOME = /ZACHISL|POPOLN|POSTUPL|ZARPLAT|PRIHOD|PRIKHOD|VZNOS|CREDIT|ЗАЧИСЛ|ПОПОЛН|ПОСТУПЛ/
const EXPENSE = /OPLATA|POKUPKA|SPISAN|PLATEZH|PLATEJ|PEREVOD|P2P|ERIP|SBOR|KOMISS|DEBIT|PAYMENT|PURCHASE|ОПЛАТА|ПОКУПКА|СПИСАН|ПЕРЕВОД|ПЛАТЕЖ/

export function classify(op: string, mcc?: number): SmsKind | 'declined' | null {
  const u = op.toUpperCase()
  if (DECLINED.test(u)) return 'declined'
  if (REFUND.test(u)) return 'refund'
  if (CASH.test(u) || (mcc !== undefined && CASH_MCC.has(mcc))) return 'cash'
  if (INCOME.test(u)) return 'income'
  if (EXPENSE.test(u)) return 'expense'
  return null
}

export function parseSms(text: string): SmsResult {
  const raw = normalizeSms(text)
  const hash = smsHash(raw)
  if (!raw) return { ok: false, reason: 'empty', hash }
  const t = raw.toUpperCase()

  // Остаток ищем первым и вырезаем, чтобы его сумму не принять за сумму операции
  let balance: number | undefined
  let balanceCurrency: string | undefined
  let rest = t
  const bal = new RegExp(String.raw`(?:OSTATOK|DOSTUPNO|BALANS|BALANCE|ОСТАТОК|ДОСТУПНО)[: ]*(-?)` + AMOUNT + String.raw`\s*([A-Z]{3})`).exec(t)
  if (bal) {
    balance = toMinor(bal[2]) * (bal[1] === '-' ? -1 : 1)
    balanceCurrency = bal[3]
    rest = t.slice(0, bal.index) + ' ' + t.slice(bal.index + bal[0].length)
  }

  // Операция и сумма: «OPLATA 1.15 BYN»
  const head = new RegExp(String.raw`([A-ZА-ЯЁ][A-ZА-ЯЁ .\-/]*?)[: ]+` + AMOUNT + String.raw`\s*([A-Z]{3})\b`).exec(rest)
  const card = /(?:KARTA|CARD|КАРТА)[^0-9]{0,4}(\d{4})\b/.exec(t)
  const mccM = /MCC[: ]*(\d{3,4})\b/.exec(t)
  const mcc = mccM ? parseInt(mccM[1], 10) : undefined

  if (!head) {
    if (DECLINED.test(t) && card) return { ok: false, reason: 'declined', hash }
    return { ok: false, reason: 'not-transaction', hash }
  }

  const opWord = head[1].replace(/\s+/g, ' ').trim()
  const amount = toMinor(head[2])
  const currency = head[3]
  if (!(amount > 0)) return { ok: false, reason: 'not-transaction', hash }

  // Дата и время
  let at: number | undefined
  let afterDate = -1
  const dm = /(?:DATA|DATE|ДАТА)?[: ]*(\d{2})\.(\d{2})\.(\d{2,4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(rest)
  if (dm) {
    const y = dm[3].length === 2 ? 2000 + +dm[3] : +dm[3]
    const d = new Date(y, +dm[2] - 1, +dm[1], +dm[4], +dm[5], dm[6] ? +dm[6] : 0)
    if (!isNaN(d.getTime()) && +dm[2] >= 1 && +dm[2] <= 12) at = d.getTime()
    afterDate = dm.index + dm[0].length
  }

  // Магазин: текст после времени до MCC / остатка / конца
  let merchant: string | undefined
  let city: string | undefined
  let country: string | undefined
  if (afterDate >= 0) {
    let tail = rest.slice(afterDate)
    const stop = tail.search(/MCC[: ]*\d|OSTATOK|DOSTUPNO|BALANS|ОСТАТОК/)
    if (stop >= 0) tail = tail.slice(0, stop)
    const parts = tail.split('>').map(s => s.trim()).filter(Boolean)
    if (parts.length) {
      merchant = parts[0].replace(/\s+/g, ' ').trim() || undefined
      if (parts.length >= 2) {
        const c = parts[1].replace(/^(?:G|Г)\.?\s+/, '').trim()
        if (c) city = c
      }
      if (parts.length >= 3 && /^[A-Z]{2,3}$/.test(parts[2])) country = parts[2]
    }
  }

  const op: SmsOp = { kind: 'expense', op: opWord, amount, currency }
  if (card) op.last4 = card[1]
  if (at !== undefined) op.at = at
  if (merchant) op.merchant = merchant
  if (city) op.city = city
  if (country) op.country = country
  if (mcc !== undefined) op.mcc = mcc
  if (balance !== undefined) { op.balance = balance; op.balanceCurrency = balanceCurrency }

  const kind = classify(opWord, mcc)
  if (kind === 'declined') return { ok: false, reason: 'declined', hash, hint: op }
  if (kind === null) return { ok: false, reason: 'unknown-operation', hash, hint: op }
  op.kind = kind
  return { ok: true, op, hash }
}

export const FAIL_TEXT: Record<SmsFail, string> = {
  empty: 'Пустое сообщение',
  'not-transaction': 'Не похоже на операцию по карте',
  declined: 'Операция отклонена банком — деньги не списаны',
  'unknown-operation': 'Незнакомый тип операции'
}
