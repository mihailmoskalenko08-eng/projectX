// Мастер «Записывать траты из SMS»: сервер на Cloudflare → привязка → автоматизация в «Командах» → проверка.

import { useState } from 'preact/hooks'
import workerCode from '../../worker/worker.js?raw'
import { relativeTime } from '../lib/dates'
import { haptic } from '../lib/haptic'
import { claim, generateKey, inboxUrl, normalizeUrl, probe, sendTest } from '../lib/sync'
import { data, removeTestArtifacts, setSettings, showToast, syncError, syncNow, syncing } from '../state'
import { Icon } from './icons'
import { CopyField, SheetHeader } from './ui'

function sampleSms(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `OPLATA 0.01 BYN\nKARTA #0000\nDATA ${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}\n${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} PROVERKA KOPEYKI >g\nMINSK>BY MCC:5999\nOSTATOK 0.00 BYN`
}

function Step({ n, title, done, open, onToggle, children }: {
  n: number; title: string; done?: boolean; open: boolean; onToggle: () => void; children: preact.ComponentChildren
}) {
  return (
    <section class={`step${open ? ' is-open' : ''}${done ? ' is-done' : ''}`}>
      <button class="step-head" onClick={() => { haptic(); onToggle() }}>
        <span class="step-num">{done ? <Icon name="check" size={16} /> : n}</span>
        <span class="step-title">{title}</span>
        <Icon name={open ? 'up' : 'down'} size={16} />
      </button>
      {open && <div class="step-body">{children}</div>}
    </section>
  )
}

export function SyncSheet() {
  const d = data.value
  const sync = d.settings.sync
  const [open, setOpen] = useState<number>(sync ? 3 : 1)
  const [url, setUrl] = useState(sync?.url ?? '')
  const [ownKey, setOwnKey] = useState('')
  const [useOwn, setUseOwn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [testState, setTestState] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle')

  const connect = async () => {
    haptic()
    setErr(null)
    const u = normalizeUrl(url)
    if (!/^https:\/\/[^/]+\.[^/]+/.test(u)) { setErr('Вставьте адрес вида https://kopeyka.ваше-имя.workers.dev'); return }
    setBusy(true)
    try {
      const info = await probe(u)
      if (!info.storage) throw new Error('К воркеру не подключено хранилище. Шаг 1, пункт 5: Bindings → KV namespace → INBOX')
      const key = useOwn ? ownKey.trim() : generateKey()
      if (useOwn && key.length < 16) throw new Error('Ключ слишком короткий')
      if (info.claimed && !useOwn) throw new Error('Этот сервер уже привязан. Если ключ у вас есть — нажмите «У меня уже есть ключ»')
      await claim(u, key)
      setSettings({ sync: { url: u, key } })
      showToast('Сервер подключён', { tone: 'good' })
      setOpen(3)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    if (!sync) return
    haptic()
    setTestState('sending')
    try {
      await sendTest(sync, sampleSms())
      const r = await syncNow(true)
      const ok = !!r && r.added.some(t => t.merchant === 'PROVERKA KOPEYKI')
      removeTestArtifacts()
      setTestState(ok ? 'ok' : 'fail')
    } catch (e) {
      setTestState('fail')
      showToast((e as Error).message, { tone: 'bad' })
    }
  }

  const disconnect = () => {
    haptic()
    if (!confirm('Отключить автозапись? Записанные операции останутся. Ключ удалится с этого устройства.')) return
    setSettings({ sync: undefined })
    syncError.value = null
    setOpen(1)
  }

  return (
    <div class="sync">
      <SheetHeader title="Траты из SMS" sub="Оплатили картой — операция записалась сама" />

      <div class="flow">
        <div class="flow-node"><Icon name="message" size={20} /><span>SMS от asb.by</span></div>
        <span class="flow-line" />
        <div class="flow-node"><Icon name="sparkles" size={20} /><span>«Команды» на iPhone</span></div>
        <span class="flow-line" />
        <div class="flow-node"><Icon name="cloud" size={20} /><span>Ваш сервер</span></div>
        <span class="flow-line" />
        <div class="flow-node is-accent"><Icon name="coin" size={20} /><span>Копейка</span></div>
      </div>

      {sync && (
        <section class="card sync-status">
          <div class="sync-status-head">
            <span class={`pulse${syncError.value ? ' is-bad' : ''}`} />
            <div>
              <b>{syncError.value ? 'Есть проблема' : 'Подключено'}</b>
              <small>{syncError.value ?? (sync.lastAt ? `Проверено ${relativeTime(sync.lastAt)}` : 'Ещё не проверялось')}</small>
            </div>
            <button class={`icon-btn glass${syncing.value ? ' is-spin' : ''}`} onClick={() => { haptic(); void syncNow(true) }} aria-label="Проверить"><Icon name="sync" size={18} /></button>
          </div>
          <small class="muted mono break">{sync.url}</small>
        </section>
      )}

      <Step n={1} title="Бесплатный сервер на Cloudflare" done={!!sync} open={open === 1} onToggle={() => setOpen(open === 1 ? 0 : 1)}>
        <p>Сервер — это почтовый ящик для ваших SMS. Работает бесплатно, без карты. Доступ только по вашему секретному ключу, а сообщения удаляются сразу после загрузки в приложение.</p>
        <ol class="howto">
          <li>Зарегистрируйтесь на <b>dash.cloudflare.com</b> — подойдёт любая почта.</li>
          <li>Слева <b>Storage & Databases → KV</b> → <b>Create</b>. Название: <code>kopeyka</code>.</li>
          <li>Слева <b>Compute → Workers & Pages</b> → <b>Create</b> → <b>Start with Hello World</b>. Название: <code>kopeyka</code> → <b>Deploy</b>.</li>
          <li>Нажмите <b>Edit code</b>, удалите всё и вставьте код ниже → <b>Deploy</b>.</li>
          <li>В воркере: <b>Settings → Bindings → Add → KV namespace</b>. Variable name: <code>INBOX</code>, namespace: <code>kopeyka</code> → <b>Add Binding</b>.</li>
          <li>Скопируйте адрес воркера сверху: <span class="mono">https://kopeyka.…workers.dev</span></li>
        </ol>
        <CopyField value={workerCode} label="Код сервера — нажмите, чтобы скопировать" />
        <button class="btn btn-soft btn-block" onClick={() => setOpen(2)}>Готово, дальше <Icon name="right" size={16} /></button>
      </Step>

      <Step n={2} title="Подключить сервер" done={!!sync} open={open === 2} onToggle={() => setOpen(open === 2 ? 0 : 2)}>
        <label class="field">
          <span>Адрес сервера</span>
          <input type="url" inputMode="url" autoCapitalize="off" autoCorrect="off" spellcheck={false} placeholder="https://kopeyka.имя.workers.dev"
            value={url} onInput={e => setUrl((e.target as HTMLInputElement).value)} />
        </label>
        {useOwn && (
          <label class="field">
            <span>Ваш ключ (из старого устройства: Ещё → Траты из SMS)</span>
            <input type="text" autoCapitalize="off" autoCorrect="off" spellcheck={false} value={ownKey} onInput={e => setOwnKey((e.target as HTMLInputElement).value)} />
          </label>
        )}
        {err && <p class="error"><Icon name="alert" size={16} /> {err}</p>}
        <button class="btn btn-primary btn-block" disabled={busy} onClick={connect}>
          {busy ? <span class="spinner" /> : <Icon name="link" size={18} />} {sync ? 'Подключить заново' : 'Проверить и подключить'}
        </button>
        <button class="link center" onClick={() => setUseOwn(!useOwn)}>{useOwn ? 'Создать новый ключ' : 'У меня уже есть ключ'}</button>
      </Step>

      <Step n={3} title="Автоматизация в «Командах»" open={open === 3} onToggle={() => setOpen(open === 3 ? 0 : 3)}>
        {!sync ? <p class="muted">Сначала подключите сервер — здесь появится ваш личный адрес.</p> : (
          <>
            <ol class="howto">
              <li>Откройте приложение <b>Команды</b> → вкладка <b>Автоматизация</b> → <b>+</b>.</li>
              <li>Выберите <b>Сообщение</b>. В поле <b>Сообщение содержит</b> введите <code>OSTATOK</code>. Отправителя выбирать не нужно.</li>
              <li>Отметьте <b>Запускать сразу</b> и выключите «Уведомлять при запуске» → <b>Далее</b>.</li>
              <li>Нажмите <b>Новая пустая автоматизация</b> → <b>Добавить действие</b> → найдите <b>Получить содержимое URL</b>.</li>
              <li>Вместо «URL» вставьте адрес ниже.</li>
              <li>Нажмите стрелку <b>›</b> у действия: <b>Метод — POST</b>, <b>Текст запроса — JSON</b>.</li>
              <li><b>Добавить новое поле → Текст</b>. Ключ: <code>text</code>. В значение вставьте переменную <b>Ввод команды</b>, нажмите на неё и выберите <b>Содержимое</b>.</li>
              <li>Готово. Теперь каждая SMS с остатком уходит в ваш ящик, а «Копейка» забирает её при открытии.</li>
            </ol>
            <CopyField value={inboxUrl(sync)} label="Ваш адрес для «Команд»" />
            <div class="note-card">
              <Icon name="shield" size={18} />
              <span>В адресе — ваш секретный ключ. Не публикуйте его. Если он утёк — подключите сервер заново с новым ключом (см. инструкцию в README).</span>
            </div>
            <button class="btn btn-soft btn-block" onClick={() => setOpen(4)}>Настроил, проверить <Icon name="right" size={16} /></button>
          </>
        )}
      </Step>

      <Step n={4} title="Проверка" done={testState === 'ok'} open={open === 4} onToggle={() => setOpen(open === 4 ? 0 : 4)}>
        {!sync ? <p class="muted">Сначала подключите сервер.</p> : (
          <>
            <p>Отправлю на сервер тестовую SMS на 0,01 Br — так же, как это сделает «Команда», — и заберу её обратно. Тестовая операция сразу удалится.</p>
            <button class="btn btn-primary btn-block" disabled={testState === 'sending'} onClick={test}>
              {testState === 'sending' ? <span class="spinner" /> : <Icon name="sync" size={18} />} Проверить сервер
            </button>
            {testState === 'ok' && <p class="success"><Icon name="check" size={16} /> Сервер работает. Теперь оплатите что-нибудь картой — через пару секунд после SMS операция будет здесь.</p>}
            {testState === 'fail' && <p class="error"><Icon name="alert" size={16} /> Не получилось. Проверьте шаги 1–2.</p>}
            <p class="muted small">Совет: чтобы проверить саму «Команду», перешлите себе любую старую SMS банка через «Сообщения» — или просто дождитесь следующей покупки.</p>
          </>
        )}
      </Step>

      {sync && (
        <section class="card">
          <CopyField value={sync.key} label="Ключ — нужен, чтобы подключить второе устройство" />
          <button class="btn btn-ghost-danger btn-block" onClick={disconnect}>Отключить автозапись</button>
        </section>
      )}

      <p class="footnote">Бесплатного тарифа Cloudflare хватает с запасом: до 1000 SMS в день.</p>
    </div>
  )
}
