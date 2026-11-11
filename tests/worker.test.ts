import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../worker/worker.js'
import { ack, claim, probe, pull, sendTest } from '../src/lib/sync'
import { ingest } from '../src/lib/ingest'
import { defaultData } from '../src/lib/model'

function memoryKV() {
  const m = new Map<string, string>()
  return {
    m,
    async get(k: string) { return m.get(k) ?? null },
    async put(k: string, v: string) { m.set(k, v) },
    async delete(k: string) { m.delete(k) },
    async list({ prefix = '', limit = 1000 }: { prefix?: string; limit?: number } = {}) {
      const keys = [...m.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit).map(name => ({ name }))
      return { keys, list_complete: true }
    }
  }
}

const URL_ = 'https://kopeyka.example.workers.dev'
const KEY = 'TestKey1234567890abcdefXYZ'
const SMS = 'OPLATA 1.15 BYN\nKARTA #5308\nDATA 10.11.2026\n14:20:21 TRANSPORT\nPAYBYCARD.BY   >g\nMINSK>BY MCC:4111\nOSTATOK 250.00 BYN'

function wire(env: Record<string, unknown>) {
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
    const { signal: _s, cache: _c, ...rest } = init ?? {}
    return worker.fetch(new Request(input, rest), env)
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('сервер-почтовый ящик', () => {
  it('полный цикл: привязка → SMS от «Команды» → приложение забирает → удаляет', async () => {
    const kv = memoryKV()
    wire({ INBOX: kv })
    expect(await probe(URL_)).toMatchObject({ claimed: false, storage: true })
    await claim(URL_, KEY)
    expect(await probe(URL_)).toMatchObject({ claimed: true })
    // Повторная привязка тем же ключом — можно, чужим — нельзя
    await claim(URL_, KEY)
    await expect(claim(URL_, 'AnotherKey1234567890abcdef')).rejects.toThrow(/другому ключу/)

    const s = { url: URL_, key: KEY }
    await sendTest(s, SMS)
    // «Команды» могут прислать и просто текст
    const raw = await fetch(`${URL_}/in/${KEY}`, { method: 'POST', body: SMS.replace('14:20:21', '14:59:52'), headers: { 'Content-Type': 'text/plain' } })
    expect(raw.status).toBe(200)

    const inbox = await pull(s)
    expect(inbox.items).toHaveLength(2)
    expect(inbox.items[0].text).toBe(SMS)

    const { report } = ingest(defaultData(), inbox.items)
    expect(report.added).toHaveLength(2)

    await ack(s, inbox.items.map(i => i.id))
    expect((await pull(s)).items).toHaveLength(0)
    // Ключ хранится только хэшем
    expect([...kv.m.values()].join()).not.toContain(KEY)
  })

  it('без ключа ничего не отдаёт и не принимает', async () => {
    const kv = memoryKV()
    wire({ INBOX: kv })
    await claim(URL_, KEY)
    const bad = { url: URL_, key: 'WrongKey1234567890abcdefg' }
    await expect(pull(bad)).rejects.toThrow(/Ключ не подходит/)
    await expect(sendTest(bad, SMS)).rejects.toThrow(/401/)
    const r = await fetch(`${URL_}/ack`, { method: 'POST', body: '{"ids":["m:1"]}' })
    expect(r.status).toBe(401)
  })

  it('понимает JSON с разными именами поля', async () => {
    const kv = memoryKV()
    wire({ INBOX: kv })
    await claim(URL_, KEY)
    for (const body of [{ message: 'a' }, { content: 'b' }, { text: { text: 'c' } }]) {
      const r = await fetch(`${URL_}/in/${KEY}`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
      expect(r.status).toBe(200)
    }
    expect((await pull({ url: URL_, key: KEY })).items.map(i => i.text).sort()).toEqual(['a', 'b', 'c'])
  })

  it('без хранилища честно говорит, что его нет', async () => {
    wire({})
    expect(await probe(URL_)).toMatchObject({ storage: false })
    await expect(claim(URL_, KEY)).rejects.toThrow(/KV/)
  })

  it('CORS для приложения на другом домене', async () => {
    const r = await worker.fetch(new Request(URL_ + '/inbox', { method: 'OPTIONS' }), { INBOX: memoryKV() })
    expect(r.status).toBe(204)
    expect(r.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
  })
})
