// Связь с «почтовым ящиком» на Cloudflare: туда «Команды» на iPhone отправляют SMS банка,
// а приложение при открытии забирает новые и удаляет их с сервера.

import type { IngestItem } from './ingest'
import type { SyncSettings } from './model'

export function normalizeUrl(u: string): string {
  let s = u.trim()
  if (!s) return ''
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  return s.replace(/\/+$/, '')
}

export function generateKey(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(28)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => abc[b % abc.length]).join('')
}

/** Адрес, на который «Команды» отправляют SMS. Ключ в адресе — так проще настроить на iPhone. */
export function inboxUrl(s: SyncSettings): string {
  return `${normalizeUrl(s.url)}/in/${s.key}`
}

async function attempt(url: string, init: RequestInit, timeout: number): Promise<Response> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeout)
  try {
    return await fetch(url, { ...init, signal: ctl.signal, cache: 'no-store' })
  } finally {
    clearTimeout(t)
  }
}

/** Запрос к серверу. На медленном мобильном интернете один сбой — не повод сдаваться: повторяем ещё дважды. */
async function call(url: string, init: RequestInit = {}, timeout = 15000): Promise<Response> {
  let last: unknown
  for (let i = 0; i < 3; i++) {
    try {
      return await attempt(url, init, timeout)
    } catch (e) {
      last = e
      await new Promise(r => setTimeout(r, 800 * (i + 1)))
    }
  }
  const e = last as Error
  if (e?.name === 'AbortError') throw new Error('Сервер не ответил вовремя — проверьте интернет')
  const detail = e?.message ? ` (${e.message})` : ''
  throw new Error(`Нет связи с сервером${detail}. Если адрес открывается в Safari, отключите блокировщики контента для этого сайта`)
}

export interface ServerInfo {
  ok: boolean
  claimed: boolean
  storage: boolean
}

export async function probe(url: string): Promise<ServerInfo> {
  const r = await call(normalizeUrl(url) + '/')
  if (!r.ok) throw new Error(`Сервер ответил ошибкой ${r.status}`)
  const j = await r.json().catch(() => null) as Record<string, unknown> | null
  if (!j || j.app !== 'kopeyka') throw new Error('По этому адресу не сервер «Копейки»')
  return { ok: true, claimed: j.claimed === true, storage: j.storage === true }
}

/** Привязать сервер к этому ключу. Первый, кто привязал, становится владельцем. */
export async function claim(url: string, key: string): Promise<void> {
  const r = await call(normalizeUrl(url) + '/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key })
  })
  if (r.status === 409) throw new Error('Сервер уже привязан к другому ключу. Введите тот ключ или сбросьте сервер (см. инструкцию)')
  if (r.status === 503) throw new Error('У сервера не подключено хранилище KV (переменная INBOX)')
  if (!r.ok) throw new Error(`Не получилось привязать сервер (${r.status})`)
}

export interface Inbox {
  items: (IngestItem & { id: string })[]
}

export async function pull(s: SyncSettings): Promise<Inbox> {
  const r = await call(normalizeUrl(s.url) + '/inbox', { headers: { Authorization: `Bearer ${s.key}` } })
  if (r.status === 401) throw new Error('Ключ не подходит к серверу')
  if (!r.ok) throw new Error(`Сервер ответил ошибкой ${r.status}`)
  const j = await r.json() as { items?: unknown }
  const items = Array.isArray(j.items) ? j.items : []
  return {
    items: items
      .filter((x): x is { id: string; text: string; at: number } =>
        !!x && typeof x === 'object' && typeof (x as Record<string, unknown>).id === 'string' && typeof (x as Record<string, unknown>).text === 'string')
      .map(x => ({ id: x.id, text: x.text, at: typeof x.at === 'number' ? x.at : undefined }))
  }
}

export async function ack(s: SyncSettings, ids: string[]): Promise<void> {
  if (!ids.length) return
  const r = await call(normalizeUrl(s.url) + '/ack', {
    method: 'POST',
    headers: { Authorization: `Bearer ${s.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  })
  if (!r.ok) throw new Error(`Не удалось подтвердить получение (${r.status})`)
}

/** Отправить тестовую SMS — как это сделает «Команда». */
export async function sendTest(s: SyncSettings, text: string): Promise<void> {
  const r = await call(inboxUrl(s), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  })
  if (!r.ok) throw new Error(`Сервер не принял сообщение (${r.status})`)
}
