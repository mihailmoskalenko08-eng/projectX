// Форматирование и разбор сумм. Внутри всё в копейках.

const SYMBOLS: Record<string, string> = {
  BYN: 'Br', USD: '$', EUR: '€', RUB: '₽', PLN: 'zł', CNY: '¥', GBP: '£', UAH: '₴', KZT: '₸', TRY: '₺', GEL: '₾'
}

export function symbol(cur: string): string {
  return SYMBOLS[cur] ?? cur
}

const NBSP = ' '
const THIN = ' '

/** 123456 → «1 234,56». Без валюты. */
export function formatNumber(minor: number, opts: { cents?: 'auto' | 'always' | 'never' } = {}): string {
  const neg = minor < 0
  const abs = Math.abs(Math.round(minor))
  const whole = Math.floor(abs / 100)
  const frac = abs % 100
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, THIN)
  const mode = opts.cents ?? 'auto'
  const showCents = mode === 'always' || (mode === 'auto' && frac !== 0)
  return (neg ? '−' : '') + grouped + (showCents ? ',' + frac.toString().padStart(2, '0') : '')
}

/** 123456, 'BYN' → «1 234,56 Br». sign: показывать «+» у положительных. */
export function formatMoney(minor: number, cur = 'BYN', opts: { sign?: boolean; cents?: 'auto' | 'always' | 'never' } = {}): string {
  const s = formatNumber(minor, opts)
  const plus = opts.sign && minor > 0 ? '+' : ''
  const sym = symbol(cur)
  if (sym === '$' || sym === '£') return plus + (s.startsWith('−') ? '−' + sym + s.slice(1) : sym + s)
  return plus + s + NBSP + sym
}

/** Короткая запись для осей графиков: 1 250 → «1,3 тыс». */
export function formatShort(minor: number): string {
  const v = Math.abs(minor) / 100
  const sign = minor < 0 ? '−' : ''
  if (v >= 1_000_000) return sign + trim(v / 1_000_000) + ' млн'
  if (v >= 10_000) return sign + Math.round(v / 1000) + ' тыс'
  if (v >= 1000) return sign + trim(v / 1000) + ' тыс'
  return sign + Math.round(v).toString()
}

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '').replace('.', ',')
}

/** «12,5» / «12.50» / «1 234» → копейки. null если не число. */
export function parseAmount(text: string): number | null {
  const t = text.replace(/[\s  ]/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d{0,2})?$/.test(t)) return null
  const v = Math.round(parseFloat(t) * 100)
  return Number.isFinite(v) ? v : null
}

/** Склонение: plural(5, ['операция','операции','операций']) */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}
