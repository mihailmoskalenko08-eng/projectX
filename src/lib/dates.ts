// Даты и бюджетные периоды.

export const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
export const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре']
export const MONTHS_DAT = ['январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню', 'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю']
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
export const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
export const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

export const DAY = 86_400_000

export function startOfDay(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function dayKey(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(t: number, n: number): number {
  const d = new Date(t)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

export interface Period {
  start: number
  /** не включительно */
  end: number
  /** Месяц, к которому относится период (по дате начала) */
  y: number
  m: number
}

function clampDay(y: number, m: number, day: number): number {
  const last = new Date(y, m + 1, 0).getDate()
  return Math.min(day, last)
}

/** Период, в который попадает момент t, если периоды начинаются с числа startDay. offset сдвигает на N периодов. */
export function periodOf(t: number, startDay = 1, offset = 0): Period {
  const d = new Date(t)
  let y = d.getFullYear()
  let m = d.getMonth()
  if (d.getDate() < clampDay(y, m, startDay)) {
    m -= 1
    if (m < 0) { m = 11; y -= 1 }
  }
  m += offset
  y += Math.floor(m / 12)
  m = ((m % 12) + 12) % 12
  const start = new Date(y, m, clampDay(y, m, startDay)).getTime()
  const ny = m === 11 ? y + 1 : y
  const nm = (m + 1) % 12
  const end = new Date(ny, nm, clampDay(ny, nm, startDay)).getTime()
  return { start, end, y, m }
}

export function periodLabel(p: Period, startDay = 1): string {
  if (startDay === 1) {
    const now = new Date()
    const name = MONTHS[p.m][0].toUpperCase() + MONTHS[p.m].slice(1)
    return p.y === now.getFullYear() ? name : `${name} ${p.y}`
  }
  const s = new Date(p.start)
  const e = new Date(p.end - DAY)
  return `${s.getDate()} ${MONTHS_GEN[s.getMonth()]} — ${e.getDate()} ${MONTHS_GEN[e.getMonth()]}`
}

export function daysIn(p: Period): number {
  return Math.round((p.end - p.start) / DAY)
}

/** «Сегодня», «Вчера», «Пятница, 7 ноября», «7 ноября 2025». */
export function dayTitle(t: number, now = Date.now()): string {
  const d = startOfDay(t)
  const today = startOfDay(now)
  if (d === today) return 'Сегодня'
  if (d === startOfDay(addDays(today, -1))) return 'Вчера'
  const dt = new Date(t)
  const base = `${dt.getDate()} ${MONTHS_GEN[dt.getMonth()]}`
  if (dt.getFullYear() !== new Date(now).getFullYear()) return `${base} ${dt.getFullYear()}`
  if (today - d < 7 * DAY) {
    const w = WEEKDAYS[dt.getDay()]
    return `${w[0].toUpperCase()}${w.slice(1)}, ${base}`
  }
  return base
}

export function timeLabel(t: number): string {
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function shortDate(t: number): string {
  const d = new Date(t)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

/** Значение для <input type="datetime-local"> */
export function toLocalInput(t: number): string {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function fromLocalInput(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime()
}

export function relativeTime(t: number, now = Date.now()): string {
  const s = Math.round((now - t) / 1000)
  if (s < 45) return 'только что'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} мин назад`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} ч назад`
  return dayTitle(t, now).toLowerCase()
}
