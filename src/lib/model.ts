// Модель данных «Копейки». Все суммы — целые числа в копейках (минимальных единицах валюты).

export type Kind = 'expense' | 'income' | 'transfer' | 'refund'

export interface Tx {
  id: string
  kind: Kind
  /** Сумма в валюте операции, в копейках, всегда > 0 */
  amount: number
  currency: string
  /** Сумма в основной валюте, если валюта операции другая */
  base?: number
  /** Категория. У переводов — 'transfer' */
  category: string
  account: string
  /** Счёт-получатель у перевода */
  to?: string
  /** Время операции, мс */
  at: number
  /** Название магазина как в SMS (нормализованное, ВЕРХНИЙ РЕГИСТР) */
  merchant?: string
  /** Человеческое название, если задано вручную */
  title?: string
  note?: string
  mcc?: number
  city?: string
  src?: 'sms' | 'manual' | 'import' | 'demo'
  /** Отпечаток SMS для защиты от повторов */
  sms?: string
  /** Остаток на карте после операции (из SMS) */
  bal?: number
}

export type AccountKind = 'card' | 'cash' | 'savings'

export interface Account {
  id: string
  name: string
  kind: AccountKind
  last4?: string
  currency: string
  color: string
  /** Начальный остаток (если нет данных из банка) */
  start: number
  /** Последний известный остаток из SMS */
  snap?: { bal: number; at: number }
  archived?: boolean
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  kind: 'expense' | 'income'
  /** Бюджет на период, копейки */
  budget?: number
  archived?: boolean
}

export type Theme = 'system' | 'dark' | 'light'

export interface SyncSettings {
  url: string
  key: string
  lastAt?: number
  lastError?: string
}

export interface Settings {
  theme: Theme
  base: string
  /** Сколько основной валюты стоит 1 единица другой валюты */
  rates: Record<string, number>
  ratesAt?: number
  /** День месяца, с которого считается бюджетный период (1 — календарный месяц) */
  periodStart: number
  /** Общий бюджет расходов на период, копейки */
  budget?: number
  sync?: SyncSettings
  /** Скрывать суммы на главном экране */
  hide: boolean
  /** Учитывать операции только с этих карт (пусто — все) */
  onboarded: boolean
}

/** SMS, которую не удалось уверенно разобрать — ждёт решения пользователя */
export interface Pending {
  id: string
  text: string
  at: number
  reason: string
}

export interface Data {
  v: 1
  txs: Tx[]
  accounts: Account[]
  categories: Category[]
  /** Магазин (ВЕРХНИЙ РЕГИСТР) → категория. Учится на правках пользователя */
  rules: Record<string, string>
  /** Магазин → своё название */
  names: Record<string, string>
  pending: Pending[]
  settings: Settings
}

export const BASE_CURRENCY = 'BYN'

export const DEFAULT_RATES: Record<string, number> = {
  USD: 3.0,
  EUR: 3.4,
  RUB: 0.036,
  PLN: 0.8,
  CNY: 0.42
}

export const EXPENSE_CATEGORIES: Category[] = [
  { id: 'food', name: 'Продукты', icon: 'cart', color: '#7DB46C', kind: 'expense' },
  { id: 'cafe', name: 'Кафе и еда', icon: 'coffee', color: '#E0A458', kind: 'expense' },
  { id: 'transport', name: 'Транспорт', icon: 'bus', color: '#6A97C4', kind: 'expense' },
  { id: 'taxi', name: 'Такси', icon: 'taxi', color: '#D8C15E', kind: 'expense' },
  { id: 'auto', name: 'Авто', icon: 'fuel', color: '#8E89CC', kind: 'expense' },
  { id: 'home', name: 'Дом', icon: 'home', color: '#B98AC9', kind: 'expense' },
  { id: 'utilities', name: 'Коммуналка', icon: 'bolt', color: '#6DB3B8', kind: 'expense' },
  { id: 'telecom', name: 'Связь', icon: 'wifi', color: '#5E9FA8', kind: 'expense' },
  { id: 'health', name: 'Здоровье', icon: 'heart', color: '#D97C7C', kind: 'expense' },
  { id: 'beauty', name: 'Красота', icon: 'sparkle', color: '#D891B1', kind: 'expense' },
  { id: 'clothes', name: 'Одежда', icon: 'shirt', color: '#B9997C', kind: 'expense' },
  { id: 'shopping', name: 'Покупки', icon: 'bag', color: '#CF9D70', kind: 'expense' },
  { id: 'tech', name: 'Техника', icon: 'device', color: '#8FA0BC', kind: 'expense' },
  { id: 'fun', name: 'Развлечения', icon: 'ticket', color: '#DA6E5E', kind: 'expense' },
  { id: 'subs', name: 'Подписки', icon: 'repeat', color: '#9D8FC6', kind: 'expense' },
  { id: 'travel', name: 'Путешествия', icon: 'plane', color: '#5DAE9C', kind: 'expense' },
  { id: 'sport', name: 'Спорт', icon: 'dumbbell', color: '#93BF63', kind: 'expense' },
  { id: 'edu', name: 'Образование', icon: 'book', color: '#CBA65E', kind: 'expense' },
  { id: 'pets', name: 'Питомцы', icon: 'paw', color: '#B79675', kind: 'expense' },
  { id: 'gifts', name: 'Подарки', icon: 'gift', color: '#CF7E9C', kind: 'expense' },
  { id: 'transfers', name: 'Переводы людям', icon: 'send', color: '#8F9891', kind: 'expense' },
  { id: 'fees', name: 'Налоги и сборы', icon: 'receipt', color: '#9C9C92', kind: 'expense' },
  { id: 'other', name: 'Другое', icon: 'dots', color: '#7F857E', kind: 'expense' }
]

export const INCOME_CATEGORIES: Category[] = [
  { id: 'salary', name: 'Зарплата', icon: 'briefcase', color: '#7DB46C', kind: 'income' },
  { id: 'side', name: 'Подработка', icon: 'rocket', color: '#6DB3B8', kind: 'income' },
  { id: 'gift_in', name: 'Подарили', icon: 'gift', color: '#D891B1', kind: 'income' },
  { id: 'cashback', name: 'Кэшбэк и проценты', icon: 'percent', color: '#D8C15E', kind: 'income' },
  { id: 'transfer_in', name: 'Переводы мне', icon: 'download', color: '#8F9891', kind: 'income' },
  { id: 'other_in', name: 'Другое', icon: 'dots', color: '#7F857E', kind: 'income' }
]

export const TRANSFER_CATEGORY = 'transfer'

export const ACCOUNT_COLORS = ['#D9824A', '#7DB46C', '#6A97C4', '#B98AC9', '#D8C15E', '#5DAE9C', '#DA6E5E', '#8F9891']

export function defaultData(): Data {
  return {
    v: 1,
    txs: [],
    accounts: [
      { id: 'cash', name: 'Наличные', kind: 'cash', currency: BASE_CURRENCY, color: '#7DB46C', start: 0 }
    ],
    categories: [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map(c => ({ ...c })),
    rules: {},
    names: {},
    pending: [],
    settings: {
      theme: 'system',
      base: BASE_CURRENCY,
      rates: { ...DEFAULT_RATES },
      periodStart: 1,
      hide: false,
      onboarded: false
    }
  }
}

let counter = 0
export function newId(prefix = ''): string {
  counter = (counter + 1) % 1e6
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + counter.toString(36)
}

/** Сумма операции в основной валюте (копейки). */
export function baseAmount(tx: Tx, s: Pick<Settings, 'base' | 'rates'>): number {
  if (tx.currency === s.base) return tx.amount
  if (typeof tx.base === 'number') return tx.base
  return convert(tx.amount, tx.currency, s)
}

export function convert(amount: number, from: string, s: Pick<Settings, 'base' | 'rates'>, to = s.base): number {
  if (from === to) return amount
  const toBase = (a: number, cur: string) => (cur === s.base ? a : a * (s.rates[cur] ?? 1))
  const inBase = toBase(amount, from)
  if (to === s.base) return Math.round(inBase)
  const r = s.rates[to]
  return Math.round(r ? inBase / r : inBase)
}

/** Влияние операции на остаток конкретного счёта (в валюте счёта, копейки, со знаком). */
export function effectOn(tx: Tx, acc: Account, s: Pick<Settings, 'base' | 'rates'>): number {
  const inAcc = (): number => {
    if (tx.currency === acc.currency) return tx.amount
    if (acc.currency === s.base && typeof tx.base === 'number') return tx.base
    return convert(tx.amount, tx.currency, s, acc.currency)
  }
  if (tx.kind === 'transfer') {
    let e = 0
    if (tx.account === acc.id) e -= inAcc()
    if (tx.to === acc.id) e += inAcc()
    return e
  }
  if (tx.account !== acc.id) return 0
  return tx.kind === 'expense' ? -inAcc() : inAcc()
}

/** Текущий остаток счёта. Если банк присылал остаток — берём его и добавляем ручные операции после него. */
export function accountBalance(acc: Account, txs: Tx[], s: Pick<Settings, 'base' | 'rates'>): number {
  let bal = acc.snap ? acc.snap.bal : acc.start
  for (const tx of txs) {
    if (tx.account !== acc.id && tx.to !== acc.id) continue
    // Остаток из банка уже учитывает всё, что было до него
    if (acc.snap && tx.at <= acc.snap.at) continue
    bal += effectOn(tx, acc, s)
  }
  return bal
}

/** Знак операции для общего потока денег: расход «−», доход/возврат «+», перевод «0». */
export function flowSign(kind: Kind): -1 | 0 | 1 {
  return kind === 'expense' ? -1 : kind === 'transfer' ? 0 : 1
}

/** Человеческое название операции. */
export function txTitle(tx: Tx, data: Pick<Data, 'names' | 'categories' | 'accounts'>): string {
  if (tx.title) return tx.title
  if (tx.merchant) return data.names[tx.merchant] ?? prettyMerchant(tx.merchant)
  if (tx.kind === 'transfer') {
    const to = data.accounts.find(a => a.id === tx.to)
    return to ? `Перевод → ${to.name}` : 'Перевод'
  }
  return data.categories.find(c => c.id === tx.category)?.name ?? 'Операция'
}

const KNOWN: [RegExp, string][] = [
  [/PAYBYCARD|TRANSPORT|METRO|MINSKTRANS|AVTOBUS|TROLL/, 'Проезд'],
  [/EVROOPT|EUROOPT|ЕВРООПТ/, 'Евроопт'],
  [/HIT!?\s*DISKONT|HIT DISCOUNT/, 'Хит! Дискаунтер'],
  [/GRIN|GREEN/, 'Green'],
  [/SANTA/, 'Санта'],
  [/KORONA/, 'Корона'],
  [/GIPPO/, 'Гиппо'],
  [/ALMI/, 'Алми'],
  [/VIKTORIYA|VIKTORIA/, 'Виктория'],
  [/BELMARKET/, 'Белмаркет'],
  [/MILA\b/, 'Мила'],
  [/SOSEDI/, 'Соседи'],
  [/DOBROTSEN|DOBROCEN/, 'Доброцен'],
  [/MAKDONALDS|MCDONALDS|MAK\.BY|MAKBY/, 'Mak.by'],
  [/KFC/, 'KFC'],
  [/BURGER KING/, 'Burger King'],
  [/STARBUCKS/, 'Starbucks'],
  [/YANDEX\s*\.?\s*GO|YANDEX\s*\.?\s*TAXI|YANDEX TAXI/, 'Яндекс Go'],
  [/YANDEX\s*\.?\s*EDA|YANDEX EATS/, 'Яндекс Еда'],
  [/YANDEX\s*\.?\s*PLUS/, 'Яндекс Плюс'],
  [/UBER/, 'Uber'],
  [/WILDBERRIES|WB\.BY/, 'Wildberries'],
  [/OZON/, 'Ozon'],
  [/21VEK/, '21vek.by'],
  [/BELARUSBANK|BELARUSBANK/, 'Беларусбанк'],
  [/A1\b|VELCOM/, 'A1'],
  [/\bMTS\b/, 'МТС'],
  [/\bLIFE\b/, 'life:)'],
  [/BELTELECOM|BYFLY/, 'Белтелеком'],
  [/ERIP|RASCHET/, 'ЕРИП'],
  [/APPLE\.COM|ITUNES/, 'Apple'],
  [/GOOGLE/, 'Google'],
  [/SPOTIFY/, 'Spotify'],
  [/NETFLIX/, 'Netflix'],
  [/BELAVIA/, 'Белавиа'],
  [/AZS|BELORUSNEFT|BELNEFT|A-100|LUKOIL|GAZPROMNEFT/, 'АЗС'],
  [/APTEKA|PHARMACY|BELFARMACIYA|BELFARMATSIYA/, 'Аптека'],
  [/ZOOMAGAZIN|ZOO/, 'Зоомагазин'],
  [/OSTROV CHISTOTY|OSTROV/, 'Остров чистоты'],
  [/MILE\b/, 'Mile'],
  [/OMA\b/, 'ОМА']
]

/** Красивое имя магазина из строки SMS: «TRANSPORT PAYBYCARD.BY» → «Проезд». */
export function prettyMerchant(raw: string): string {
  const up = raw.toUpperCase()
  for (const [re, name] of KNOWN) if (re.test(up)) return name
  const cleaned = raw
    .replace(/\s+/g, ' ')
    .replace(/\b(OOO|ООО|ODO|ОДО|ZAO|ЗАО|OAO|ОАО|IP|ИП|CHUP|ЧУП|UP|УП|CHTUP|ЧТУП)\b\.?/gi, '')
    .replace(/["«»]/g, '')
    .trim()
  if (!cleaned) return raw
  return cleaned
    .toLowerCase()
    .replace(/(^|[\s\-.(/])([\p{L}])/gu, (_m, p: string, c: string) => p + c.toUpperCase())
    .replace(/\.(By|Ru|Com|Net|Org|Io)\b/g, (m: string) => m.toLowerCase())
}
