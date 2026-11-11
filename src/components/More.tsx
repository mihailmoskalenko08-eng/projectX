// «Ещё»: счета, автозапись, бюджеты, категории, вид, данные.

import { useRef } from 'preact/hooks'
import { download, exportCsv, exportJson, importJson } from '../lib/backup'
import { dayKey, relativeTime } from '../lib/dates'
import { haptic } from '../lib/haptic'
import { plural } from '../lib/money'
import { defaultData, type Theme } from '../lib/model'
import { recurring } from '../lib/stats'
import { balances, clearDemo, data, flushSave, hasDemo, loadDemo, openSheet, setSettings, showToast, syncError } from '../state'
import { TopBar } from './Home'
import { Money, Row, Segmented, Switch } from './ui'

export function More() {
  const d = data.value
  const s = d.settings
  const file = useRef<HTMLInputElement>(null)
  const recCount = recurring(d).length
  const since = d.txs.length ? d.txs[d.txs.length - 1].at : null
  const rulesCount = Object.keys(d.rules).length

  const onFile = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const f = input.files?.[0]
    input.value = ''
    if (!f) return
    try {
      const next = importJson(await f.text())
      if (!confirm(`Заменить данные копией? В ней ${next.txs.length} ${plural(next.txs.length, ['операция', 'операции', 'операций'])}. Текущие данные будут заменены.`)) return
      // Подключение к серверу оставляем текущее, если в копии его нет
      data.value = { ...next, settings: { ...next.settings, sync: next.settings.sync ?? s.sync, onboarded: true } }
      flushSave()
      showToast('Копия загружена', { tone: 'good' })
    } catch (err) {
      showToast((err as Error).message, { tone: 'bad' })
    }
  }

  const wipe = () => {
    haptic()
    if (!confirm('Удалить все операции, счета и настройки на этом устройстве? Это нельзя отменить. Сначала лучше сохранить копию.')) return
    data.value = { ...defaultData(), settings: { ...defaultData().settings, onboarded: false } }
    flushSave()
  }

  return (
    <div class="screen more">
      <TopBar title="Ещё" />

      <section class="card brand-card">
        <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width={56} height={56} />
        <div>
          <b>Копейка</b>
          <small>{d.txs.length} {plural(d.txs.length, ['операция', 'операции', 'операций'])}{since ? ` · с ${new Date(since).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}</small>
        </div>
      </section>

      <h4 class="section-title">Автозапись</h4>
      <section class="card">
        <Row icon="message" title="Траты из SMS"
          sub={s.sync ? (syncError.value ? syncError.value : s.sync.lastAt ? `Работает · проверено ${relativeTime(s.sync.lastAt)}` : 'Подключено') : 'Не настроено — займёт 10 минут'}
          right={s.sync ? <span class={`status-dot${syncError.value ? ' is-bad' : ''}`} /> : undefined}
          onClick={() => openSheet({ type: 'sync' })} />
        <Row icon="copy" title="Вставить SMS вручную" sub="Скопировали SMS банка — вставили — готово" onClick={() => openSheet({ type: 'paste' })} />
        {d.pending.length > 0 && <Row icon="alert" title="SMS на разбор" right={<span class="badge">{d.pending.length}</span>} onClick={() => openSheet({ type: 'pending' })} />}
      </section>

      <h4 class="section-title">Счета</h4>
      <section class="card">
        {d.accounts.map(a => (
          <Row key={a.id} icon={a.kind === 'cash' ? 'cash' : a.kind === 'savings' ? 'savings' : 'card'} color={a.archived ? '#555' : a.color}
            title={<>{a.name}{a.archived && <small class="muted"> · архив</small>}</>}
            sub={a.last4 ? `•• ${a.last4}${a.snap ? ' · остаток из SMS' : ''}` : a.kind === 'cash' ? 'Наличные' : a.kind === 'savings' ? 'Копилка' : 'Карта'}
            right={<Money value={balances.value.get(a.id) ?? 0} cur={a.currency} />}
            onClick={() => openSheet({ type: 'account', id: a.id })} />
        ))}
        <Row icon="plus" title="Добавить счёт" onClick={() => openSheet({ type: 'account' })} />
      </section>

      <h4 class="section-title">Планирование</h4>
      <section class="card">
        <Row icon="target" title="Бюджеты" sub={s.budget ? 'Общий бюджет задан' : 'Лимиты на месяц и по категориям'} onClick={() => openSheet({ type: 'budgets' })} />
        <Row icon="tag" title="Категории" sub={rulesCount ? `${rulesCount} ${plural(rulesCount, ['магазин запомнен', 'магазина запомнено', 'магазинов запомнено'])}` : 'Названия, цвета и иконки'} onClick={() => openSheet({ type: 'categories' })} />
        <Row icon="repeat" title="Регулярные платежи" sub={recCount ? `Найдено: ${recCount}` : 'Находятся сами'} onClick={() => openSheet({ type: 'recurring' })} />
        <Row icon="globe" title="Курсы валют" sub="Для покупок в долларах, евро и других" onClick={() => openSheet({ type: 'rates' })} />
      </section>

      <h4 class="section-title">Вид</h4>
      <section class="card">
        <div class="setting">
          <span>Тема</span>
          <Segmented<Theme> small value={s.theme} onChange={v => setSettings({ theme: v })}
            options={[{ value: 'system', label: 'Авто' }, { value: 'dark', label: 'Тёмная' }, { value: 'light', label: 'Светлая' }]} />
        </div>
        <div class="setting">
          <span>
            Месяц начинается с
            <small>Удобно считать от зарплаты до зарплаты</small>
          </span>
          <select class="select" value={s.periodStart} onChange={e => setSettings({ periodStart: +(e.target as HTMLSelectElement).value })}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n === 1 ? '1-го (календарный)' : `${n}-го числа`}</option>)}
          </select>
        </div>
        <div class="setting">
          <span>
            Скрывать суммы
            <small>Размытие на экране — при людях</small>
          </span>
          <Switch on={s.hide} onChange={v => setSettings({ hide: v })} label="Скрывать суммы" />
        </div>
      </section>

      <h4 class="section-title">Данные</h4>
      <section class="card">
        <Row icon="upload" title="Сохранить копию" sub="Файл со всеми данными — на случай смены телефона"
          onClick={() => { download(`kopeyka-${dayKey(Date.now())}.json`, exportJson(d), 'application/json'); setSettings({}) }} />
        <Row icon="download" title="Загрузить копию" onClick={() => file.current?.click()} />
        <Row icon="receipt" title="Выгрузить в таблицу" sub="CSV для Excel и Numbers" onClick={() => download(`kopeyka-${dayKey(Date.now())}.csv`, exportCsv(d), 'text/csv')} />
        {hasDemo.value
          ? <Row icon="sparkles" title="Убрать демо-данные" sub="Настоящие операции останутся" onClick={() => { clearDemo(); showToast('Демо-данные убраны') }} />
          : <Row icon="sparkles" title="Показать на демо-данных" sub="Три месяца примерной жизни — посмотреть, как всё выглядит" onClick={() => { loadDemo(); showToast('Демо-данные загружены', { tone: 'good' }) }} />}
        <Row icon="trash" title="Удалить всё" danger onClick={wipe} />
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={onFile} />
      </section>

      <p class="footnote">
        Все данные хранятся только на этом устройстве.<br />
        Версия {__APP_VERSION__}
      </p>
    </div>
  )
}
