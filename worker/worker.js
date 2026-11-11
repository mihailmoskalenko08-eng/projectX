// «Копейка» — почтовый ящик для SMS банка на Cloudflare Workers (бесплатный тариф).
//
// «Команды» на iPhone отправляют сюда текст SMS, приложение при открытии забирает новые и удаляет их.
// Хранилище — Cloudflare KV, привязанное к воркеру под именем INBOX.
//
//   GET  /             — проверка: что это за сервер и привязан ли он
//   POST /setup        — {key} — привязать сервер к ключу (один раз; первый ключ становится владельцем)
//   POST /in/<key>     — {text} или просто текст — положить SMS (так делает «Команда»)
//   GET  /inbox        — Authorization: Bearer <key> — список ждущих SMS
//   POST /ack          — Authorization: Bearer <key>, {ids:[...]} — удалить полученные
//
// Ключ хранится только в виде хэша. Сообщения лежат не дольше 30 дней.

const MAX_TEXT = 2000
const TTL = 60 * 60 * 24 * 30
const MAX_ITEMS = 500

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400'
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors }
  })
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function sameString(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function keyOk(env, key) {
  if (typeof key !== 'string' || key.length < 16 || key.length > 100) return false
  const stored = await env.INBOX.get('owner')
  if (!stored) return false
  return sameString(stored, await sha256(key))
}

function bearer(req) {
  const h = req.headers.get('Authorization') || ''
  const m = /^Bearer\s+(.+)$/i.exec(h)
  return m ? m[1].trim() : ''
}

async function readText(req) {
  const type = req.headers.get('Content-Type') || ''
  const body = await req.text()
  if (body.length > MAX_TEXT * 4) return null
  if (type.includes('json') || /^\s*\{/.test(body)) {
    try {
      const j = JSON.parse(body)
      // «Команды» иногда присылают текст под другим именем поля
      const t = j.text ?? j.message ?? j.sms ?? j.body ?? j.content
      if (typeof t === 'string') return t
      if (t && typeof t === 'object' && typeof t.text === 'string') return t.text
      return null
    } catch {
      return body
    }
  }
  if (type.includes('form')) {
    const p = new URLSearchParams(body)
    return p.get('text') ?? p.get('message') ?? null
  }
  return body
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    if (path === '/' && req.method === 'GET') {
      const storage = !!env.INBOX
      const claimed = storage ? !!(await env.INBOX.get('owner')) : false
      return json({ app: 'kopeyka', version: 1, storage, claimed })
    }

    if (!env.INBOX) return json({ error: 'KV-хранилище INBOX не подключено к воркеру' }, 503)

    if (path === '/setup' && req.method === 'POST') {
      let key
      try { key = (await req.json()).key } catch { /* пусто */ }
      if (typeof key !== 'string' || key.length < 16 || key.length > 100) return json({ error: 'bad key' }, 400)
      const hash = await sha256(key)
      const stored = await env.INBOX.get('owner')
      if (stored && !sameString(stored, hash)) return json({ error: 'already claimed' }, 409)
      if (!stored) await env.INBOX.put('owner', hash)
      return json({ ok: true })
    }

    const inMatch = /^\/in\/([^/]+)$/.exec(path)
    if ((inMatch || path === '/in') && (req.method === 'POST' || req.method === 'PUT')) {
      const key = inMatch ? decodeURIComponent(inMatch[1]) : bearer(req)
      if (!(await keyOk(env, key))) return json({ error: 'unauthorized' }, 401)
      const text = await readText(req)
      if (typeof text !== 'string' || !text.trim()) return json({ error: 'empty' }, 400)
      const now = Date.now()
      const id = `m:${now.toString(36).padStart(9, '0')}:${crypto.randomUUID().slice(0, 8)}`
      await env.INBOX.put(id, JSON.stringify({ text: text.slice(0, MAX_TEXT), at: now }), { expirationTtl: TTL })
      return json({ ok: true, id })
    }

    if (path === '/inbox' && req.method === 'GET') {
      if (!(await keyOk(env, bearer(req)))) return json({ error: 'unauthorized' }, 401)
      const list = await env.INBOX.list({ prefix: 'm:', limit: MAX_ITEMS })
      const items = []
      for (const k of list.keys) {
        const v = await env.INBOX.get(k.name)
        if (!v) continue
        try {
          const j = JSON.parse(v)
          items.push({ id: k.name, text: j.text, at: j.at })
        } catch { /* битая запись — пропускаем */ }
      }
      return json({ items, more: !list.list_complete })
    }

    if (path === '/ack' && req.method === 'POST') {
      if (!(await keyOk(env, bearer(req)))) return json({ error: 'unauthorized' }, 401)
      let ids
      try { ids = (await req.json()).ids } catch { /* пусто */ }
      if (!Array.isArray(ids)) return json({ error: 'bad ids' }, 400)
      const valid = ids.filter(i => typeof i === 'string' && i.startsWith('m:')).slice(0, MAX_ITEMS)
      await Promise.all(valid.map(i => env.INBOX.delete(i)))
      return json({ ok: true, deleted: valid.length })
    }

    return json({ error: 'not found' }, 404)
  }
}
