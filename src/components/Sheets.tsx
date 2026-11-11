// Остальные шторки: категория, магазин, регулярные платежи, разбор SMS, вставка SMS, счёт, бюджеты, категории, курсы.

import type { CSSProperties } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import { dayTitle, periodLabel, periodOf, timeLabel } from '../lib/dates'
import { haptic } from '../lib/haptic'
import { merchantKey } from '../lib/ingest'
import { formatMoney, parseAmount, plural, symbol } from '../lib/money'
import { ACCOUNT_COLORS, newId, prettyMerchant, type Account, type AccountKind, type Category } from '../lib/model'
import { FAIL_TEXT, parseSms } from '../lib/sms'
import { inPeriod, recurring, totals } from '../lib/stats'
import {
  balances, categoryOf, closeSheet, data, ingestItems, openSheet, opsCategory, reportText, resolvePending,
  setSettings, showToast, tab, update, closeAllSheets
} from '../state'
import { CATEGORY_ICONS, Icon } from './icons'
import { TxList } from './tx'
import { CatIcon, Empty, Money, ProgressBar, Row, Segmented, SheetHeader, useCloseSheet } from './ui'

const PALETTE = ['#7DB46C', '#E0A458', '#6A97C4', '#D8C15E', '#8E89CC', '#B98AC9', '#6DB3B8', '#5E9FA8', '#D97C7C', '#D891B1', '#B9997C', '#CF9D70', '#8FA0BC', '#DA6E5E', '#9D8FC6', '#5DAE9C', '#93BF63', '#CBA65E', '#B79675', '#CF7E9C', '#8F9891', '#7F857E']

// ——— Категория за период ———

export function CategorySheet({ id, offset }: { id: string; offset: number }) {
  const d = data.value
  const cat = categoryOf(id)
  const p = periodOf(Date.now(), d.settings.periodStart, offset)
  const txs = useMemo(() => inPeriod(d.txs, p).filter(t => t.category === id && t.kind !== 'transfer'), [d.txs, id, p.start])
  const t = totals(txs, d.settings)
  const total = cat.kind === 'income' ? t.income : t.expense
  const prev = totals(inPeriod(d.txs, periodOf(Date.now(), d.settings.periodStart, offset - 1)).filter(x => x.category === id), d.settings)
  const prevTotal = cat.kind === 'income' ? prev.income : prev.expense
  return (
    <div>
      <SheetHeader title={cat.name} sub={periodLabel(p, d.settings.periodStart)} />
      <div class="cat-hero" style={{ '--c': cat.color } as CSSProperties}>
        <CatIcon icon={cat.icon} color={cat.color} size={56} />
        <div>
          <Money value={total} big class="cat-hero-amt" />
          <span class="muted">{txs.length} {plural(txs.length, ['операция', 'операции', 'операций'])} · в прошлом {formatMoney(prevTotal, d.settings.base, { cents: 'never' })}</span>
        </div>
      </div>
      {cat.kind === 'expense' && cat.budget ? (
        <section class="card">
          <div class="month-budget"><span>Бюджет</span><span><Money value={total} cents="never" /> из {formatMoney(cat.budget, d.settings.base, { cents: 'never' })}</span></div>
          <ProgressBar value={total} max={cat.budget} color={cat.color} />
        </section>
      ) : null}
      <div class="btn-row">
        <button class="btn btn-soft" onClick={() => { haptic(); openSheet({ type: 'editCategory', id, kind: cat.kind }) }}><Icon name="edit" size={16} /> Настроить</button>
        <button class="btn btn-soft" onClick={() => { haptic(); opsCategory.value = id; tab.value = 'ops'; closeAllSheets() }}><Icon name="list" size={16} /> Все операции</button>
      </div>
      {txs.length ? <TxList txs={txs} /> : <Empty icon={cat.icon} title="Пусто" text="В этом периоде здесь ничего нет" />}
    </div>
  )
}

// ——— Магазин ———

export function MerchantSheet({ k }: { k: string }) {
  const d = data.value
  const txs = d.txs.filter(t => t.merchant && merchantKey(t.merchant) === k)
  const t = totals(txs, d.settings)
  const name = d.names[k] ?? prettyMerchant(k)
  const cat = txs[0] ? categoryOf(txs[0].category) : null
  const avg = txs.length ? Math.round(t.expense / Math.max(1, txs.filter(x => x.kind === 'expense').length)) : 0
  return (
    <div>
      <SheetHeader title={name} sub={k} />
      <div class="summary-grid">
        <div class="card stat-tile"><span class="label">Всего</span><Money value={t.expense} cents="never" /></div>
        <div class="card stat-tile"><span class="label">Средний чек</span><Money value={avg} /></div>
        <div class="card stat-tile"><span class="label">Покупок</span><b class="stat-num">{txs.length}</b></div>
        <div class="card stat-tile"><span class="label">Категория</span><b class="stat-cat">{cat?.name ?? '—'}</b></div>
      </div>
      <TxList txs={txs} />
    </div>
  )
}

// ——— Регулярные ———

export function RecurringSheet() {
  const d = data.value
  const list = recurring(d)
  const sum = list.reduce((a, r) => a + r.amount, 0)
  return (
    <div>
      <SheetHeader title="Регулярные платежи" sub="Находятся сами по истории операций" />
      {list.length ? (
        <>
          <div class="card rec-total">
            <span class="label">Примерно в месяц</span>
            <Money value={sum} big />
            <span class="muted">{list.length} {plural(list.length, ['платёж', 'платежа', 'платежей'])} · {formatMoney(sum * 12, d.settings.base, { cents: 'never' })} в год</span>
          </div>
          <div class="card">
            {list.map(r => {
              const c = categoryOf(r.category)
              return (
                <Row key={r.key} icon={c.icon} color={c.color} title={d.names[r.key] ?? prettyMerchant(r.merchant)}
                  sub={`следующий ≈ ${dayTitle(r.next).toLowerCase()} · ${r.months} мес. подряд`}
                  right={<Money value={-r.amount} />} onClick={() => openSheet({ type: 'merchant', key: r.key })} chevron={false} />
              )
            })}
          </div>
        </>
      ) : (
        <Empty icon="repeat" title="Пока не нашлось" text="Когда один и тот же платёж повторится хотя бы два месяца подряд, он появится здесь" />
      )}
    </div>
  )
}

// ——— SMS на разбор ———

export function PendingSheet() {
  const d = data.value
  return (
    <div>
      <SheetHeader title="SMS на разбор" sub="Эти сообщения похожи на операции, но я не уверен в типе" />
      {d.pending.length ? d.pending.map(p => {
        const r = parseSms(p.text)
        const hint = r.ok ? r.op : r.hint
        return (
          <section key={p.id} class="card pending">
            <div class="pending-head">
              <span class="muted small">{dayTitle(p.at)}, {timeLabel(p.at)}</span>
              {hint && <b>{formatMoney(hint.amount, hint.currency)}</b>}
            </div>
            <pre class="sms">{p.text}</pre>
            <div class="btn-row">
              <button class="btn btn-soft" onClick={() => { haptic(); resolvePending(p.id, 'expense') }}><Icon name="minus" size={16} /> Расход</button>
              <button class="btn btn-soft" onClick={() => { haptic(); resolvePending(p.id, 'income') }}><Icon name="plus" size={16} /> Доход</button>
              <button class="btn btn-ghost" onClick={() => { haptic(); resolvePending(p.id, 'ignore') }}>Пропустить</button>
            </div>
          </section>
        )
      }) : <Empty icon="check" title="Всё разобрано" />}
    </div>
  )
}

// ——— Вставить SMS вручную ———

export function PasteSheet() {
  const close = useCloseSheet()
  const [text, setText] = useState('')
  // Несколько SMS подряд разделяются пустой строкой
  const parts = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)
  const parsed = parts.map(p => parseSms(p))
  const ok = parsed.filter(r => r.ok).length
  const paste = async () => {
    try { setText(await navigator.clipboard.readText()) } catch { showToast('Не удалось прочитать буфер — вставьте вручную') }
  }
  const add = () => {
    haptic()
    const r = ingestItems(parts.map(p => ({ text: p })))
    showToast(reportText(r), { tone: r.added.length ? 'good' : undefined })
    if (r.added.length || r.pending.length) close()
  }
  return (
    <div>
      <SheetHeader title="Вставить SMS" sub="Скопируйте SMS банка в «Сообщениях» и вставьте сюда. Можно несколько — через пустую строку" />
      <textarea class="textarea mono" rows={7} value={text} placeholder={'OPLATA 1.15 BYN\nKARTA #5308\nDATA 10.11.2026\n14:20:21 TRANSPORT…'}
        onInput={e => setText((e.target as HTMLTextAreaElement).value)} />
      {!text && <button class="btn btn-soft btn-block" onClick={paste}><Icon name="copy" size={16} /> Вставить из буфера</button>}
      {parsed.length > 0 && (
        <div class="card">
          {parsed.map((r, i) => (
            <div key={i} class="parse-row">
              <Icon name={r.ok ? 'check' : 'alert'} size={18} class={r.ok ? 'is-in' : 'is-bad'} />
              {r.ok ? (
                <span>
                  <b>{r.op.kind === 'income' ? 'Доход' : r.op.kind === 'refund' ? 'Возврат' : r.op.kind === 'cash' ? 'Снятие наличных' : 'Расход'} {formatMoney(r.op.amount, r.op.currency)}</b>
                  <small>{[r.op.merchant && prettyMerchant(r.op.merchant), r.op.last4 && `карта ·${r.op.last4}`, r.op.at && dayTitle(r.op.at)].filter(Boolean).join(' · ')}</small>
                </span>
              ) : <span><b>{FAIL_TEXT[r.reason]}</b></span>}
            </div>
          ))}
        </div>
      )}
      <button class="btn btn-primary btn-block" disabled={!parts.length} onClick={add}>
        <Icon name="download" size={18} /> {ok ? `Записать ${ok} ${plural(ok, ['операцию', 'операции', 'операций'])}` : 'Записать'}
      </button>
    </div>
  )
}

// ——— Счёт ———

export function AccountSheet({ id }: { id?: string }) {
  const close = useCloseSheet()
  const d = data.value
  const acc = id ? d.accounts.find(a => a.id === id) : undefined
  const bal = acc ? balances.value.get(acc.id) ?? 0 : 0
  const [name, setName] = useState(acc?.name ?? '')
  const [kind, setKind] = useState<AccountKind>(acc?.kind ?? 'card')
  const [color, setColor] = useState(acc?.color ?? ACCOUNT_COLORS.find(c => !d.accounts.some(a => a.color === c)) ?? ACCOUNT_COLORS[0])
  const [last4, setLast4] = useState(acc?.last4 ?? '')
  const [currency, setCurrency] = useState(acc?.currency ?? d.settings.base)
  const [balText, setBalText] = useState(acc ? (bal / 100).toFixed(2).replace('.', ',') : '')
  const txCount = acc ? d.txs.filter(t => t.account === acc.id || t.to === acc.id).length : 0

  const save = () => {
    haptic()
    const n = name.trim() || (kind === 'cash' ? 'Наличные' : kind === 'savings' ? 'Копилка' : last4 ? `Карта ·${last4}` : 'Карта')
    const target = parseAmount(balText || '0') ?? 0
    update(dd => {
      const accounts = [...dd.accounts]
      if (acc) {
        const i = accounts.findIndex(a => a.id === acc.id)
        const next: Account = { ...accounts[i], name: n.slice(0, 40), kind, color, currency }
        if (kind === 'card' && /^\d{4}$/.test(last4)) next.last4 = last4
        else delete next.last4
        // Остаток поправили вручную — сдвигаем стартовый так, чтобы текущий совпал
        if (target !== bal) {
          if (next.snap) next.snap = { bal: next.snap.bal + (target - bal), at: next.snap.at }
          else next.start = next.start + (target - bal)
        }
        accounts[i] = next
      } else {
        const a: Account = { id: 'a' + newId(), name: n.slice(0, 40), kind, color, currency, start: target }
        if (kind === 'card' && /^\d{4}$/.test(last4)) a.last4 = last4
        accounts.push(a)
      }
      return { ...dd, accounts }
    })
    showToast(acc ? 'Счёт сохранён' : 'Счёт добавлен', { tone: 'good' })
    close()
  }

  const archive = () => {
    if (!acc) return
    haptic()
    if (txCount === 0) update(dd => ({ ...dd, accounts: dd.accounts.filter(a => a.id !== acc.id) }))
    else update(dd => ({ ...dd, accounts: dd.accounts.map(a => (a.id === acc.id ? { ...a, archived: !a.archived } : a)) }))
    close()
  }

  return (
    <div>
      <SheetHeader title={acc ? acc.name : 'Новый счёт'} />
      <div class="acc-preview" style={{ '--c': color } as CSSProperties}>
        <span class="acc-preview-shine" />
        <span class="acc-tile-top"><Icon name={kind === 'cash' ? 'cash' : kind === 'savings' ? 'savings' : 'card'} size={20} />{kind === 'card' && last4 && <span class="acc-last4">•• {last4}</span>}</span>
        <span class="acc-preview-name">{name || (kind === 'cash' ? 'Наличные' : kind === 'savings' ? 'Копилка' : 'Карта')}</span>
        <span class="acc-preview-bal">{balText || '0'} {symbol(currency)}</span>
      </div>
      <Segmented value={kind} onChange={setKind} options={[{ value: 'card', label: 'Карта' }, { value: 'cash', label: 'Наличные' }, { value: 'savings', label: 'Копилка' }]} />
      <label class="field"><span>Название</span><input value={name} maxLength={40} placeholder="Например, Беларусбанк" onInput={e => setName((e.target as HTMLInputElement).value)} /></label>
      {kind === 'card' && (
        <label class="field"><span>Последние 4 цифры — по ним SMS попадают на этот счёт</span>
          <input inputMode="numeric" maxLength={4} value={last4} placeholder="5308" onInput={e => setLast4((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4))} />
        </label>
      )}
      <div class="field-row">
        <label class="field"><span>{acc ? 'Остаток сейчас' : 'Сколько сейчас'}</span>
          <input inputMode="decimal" value={balText} placeholder="0" onInput={e => setBalText((e.target as HTMLInputElement).value)} />
        </label>
        <label class="field field-sm"><span>Валюта</span>
          <select value={currency} onChange={e => setCurrency((e.target as HTMLSelectElement).value)}>
            {[d.settings.base, ...Object.keys(d.settings.rates)].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      {acc?.snap && <p class="muted small">Остаток приходит из SMS банка: последний — {formatMoney(acc.snap.bal, acc.currency)}, {dayTitle(acc.snap.at).toLowerCase()}.</p>}
      <div class="swatches">
        {ACCOUNT_COLORS.map(c => <button key={c} class={`swatch${c === color ? ' is-on' : ''}`} style={{ background: c }} onClick={() => { haptic(); setColor(c) }} aria-label="Цвет" />)}
      </div>
      <button class="btn btn-primary btn-block" onClick={save}><Icon name="check" size={18} /> Сохранить</button>
      {acc && (
        <button class="btn btn-ghost-danger btn-block" onClick={archive}>
          {txCount === 0 ? 'Удалить счёт' : acc.archived ? 'Вернуть из архива' : 'Убрать в архив'}
        </button>
      )}
    </div>
  )
}

// ——— Бюджеты ———

export function BudgetsSheet() {
  const d = data.value
  const p = periodOf(Date.now(), d.settings.periodStart)
  const spent = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of inPeriod(d.txs, p)) {
      if (t.kind !== 'expense' && t.kind !== 'refund') continue
      const v = (t.kind === 'expense' ? 1 : -1) * (t.currency === d.settings.base ? t.amount : t.base ?? t.amount)
      m.set(t.category, (m.get(t.category) ?? 0) + v)
    }
    return m
  }, [d.txs])
  const total = totals(inPeriod(d.txs, p), d.settings).expense
  const [overall, setOverall] = useState(d.settings.budget ? String(d.settings.budget / 100) : '')
  const setCat = (id: string, v: string) => {
    const n = parseAmount(v)
    update(dd => ({ ...dd, categories: dd.categories.map(c => (c.id === id ? { ...c, budget: n && n > 0 ? n : undefined } : c)) }))
  }
  const cats = d.categories.filter(c => c.kind === 'expense' && !c.archived)
    .sort((a, b) => (spent.get(b.id) ?? 0) - (spent.get(a.id) ?? 0))
  const sumCats = cats.reduce((a, c) => a + (c.budget ?? 0), 0)
  return (
    <div>
      <SheetHeader title="Бюджеты" sub={`На ${periodLabel(p, d.settings.periodStart).toLowerCase()} и каждый следующий период`} />
      <section class="card">
        <label class="field">
          <span>Общий бюджет на месяц</span>
          <div class="input-money">
            <input inputMode="decimal" placeholder={sumCats ? String(sumCats / 100) : 'Без ограничения'} value={overall}
              onInput={e => setOverall((e.target as HTMLInputElement).value)}
              onBlur={() => { const n = parseAmount(overall); setSettings({ budget: n && n > 0 ? n : undefined }) }} />
            <span>{symbol(d.settings.base)}</span>
          </div>
        </label>
        {(d.settings.budget || sumCats) ? <ProgressBar value={total} max={d.settings.budget ?? sumCats} /> : null}
        <p class="muted small">Потрачено {formatMoney(total, d.settings.base)}. {!d.settings.budget && sumCats ? 'Сейчас общий бюджет — сумма бюджетов категорий.' : ''}</p>
      </section>
      <h4 class="section-title">По категориям</h4>
      <section class="card">
        {cats.map(c => {
          const s = Math.max(0, spent.get(c.id) ?? 0)
          return (
            <div key={c.id} class="budget-row">
              <CatIcon icon={c.icon} color={c.color} size={34} />
              <div class="budget-main">
                <div class="budget-top">
                  <span>{c.name}</span>
                  <small class={c.budget && s > c.budget ? 'is-bad' : 'muted'}>{formatMoney(s, d.settings.base, { cents: 'never' })}</small>
                </div>
                {c.budget ? <ProgressBar value={s} max={c.budget} color={c.color} /> : null}
              </div>
              <div class="input-money input-money-sm">
                <input inputMode="decimal" placeholder="—" value={c.budget ? String(c.budget / 100) : ''}
                  onBlur={e => setCat(c.id, (e.target as HTMLInputElement).value)} />
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}

// ——— Категории ———

export function CategoriesSheet() {
  const d = data.value
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const list = d.categories.filter(c => c.kind === kind)
  const count = (id: string) => d.txs.filter(t => t.category === id).length
  return (
    <div>
      <SheetHeader title="Категории" />
      <Segmented value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Расходы' }, { value: 'income', label: 'Доходы' }]} />
      <section class="card">
        {list.map(c => (
          <Row key={c.id} icon={c.icon} color={c.archived ? '#555' : c.color} title={<>{c.name}{c.archived && <small class="muted"> · скрыта</small>}</>}
            sub={`${count(c.id)} ${plural(count(c.id), ['операция', 'операции', 'операций'])}`}
            onClick={() => openSheet({ type: 'editCategory', id: c.id, kind })} />
        ))}
      </section>
      <button class="btn btn-soft btn-block" onClick={() => { haptic(); openSheet({ type: 'editCategory', kind }) }}><Icon name="plus" size={18} /> Новая категория</button>
      <section class="card">
        <Row icon="tag" title="Запомненные магазины" sub={`${Object.keys(d.rules).length} правил — какие покупки в какую категорию`} chevron={false} />
        {Object.entries(d.rules).slice(0, 50).map(([k, cid]) => {
          const c = categoryOf(cid)
          return (
            <div key={k} class="rule">
              <span>{d.names[k] ?? prettyMerchant(k)}</span>
              <span class="rule-cat"><i class="chip-dot" style={{ background: c.color }} />{c.name}</span>
              <button class="icon-btn" aria-label="Забыть" onClick={() => update(dd => { const rules = { ...dd.rules }; delete rules[k]; return { ...dd, rules } })}><Icon name="close" size={14} /></button>
            </div>
          )
        })}
      </section>
    </div>
  )
}

export function EditCategorySheet({ id, kind }: { id?: string; kind: 'expense' | 'income' }) {
  const d = data.value
  const cat = id ? d.categories.find(c => c.id === id) : undefined
  const [name, setName] = useState(cat?.name ?? '')
  const [icon, setIcon] = useState(cat?.icon ?? 'tag')
  const [color, setColor] = useState(cat?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)])
  const save = () => {
    haptic()
    const n = name.trim()
    if (!n) { showToast('Введите название', { tone: 'bad' }); return }
    update(dd => {
      if (cat) return { ...dd, categories: dd.categories.map(c => (c.id === cat.id ? { ...c, name: n.slice(0, 40), icon, color } : c)) }
      const c: Category = { id: 'c' + newId(), name: n.slice(0, 40), icon, color, kind }
      return { ...dd, categories: [...dd.categories, c] }
    })
    closeSheet()
  }
  const toggleArchive = () => {
    if (!cat) return
    haptic()
    update(dd => ({ ...dd, categories: dd.categories.map(c => (c.id === cat.id ? { ...c, archived: !c.archived } : c)) }))
    closeSheet()
  }
  return (
    <div>
      <SheetHeader title={cat ? 'Категория' : 'Новая категория'} />
      <div class="cat-edit-preview"><CatIcon icon={icon} color={color} size={72} /><b>{name || 'Название'}</b></div>
      <label class="field"><span>Название</span><input value={name} maxLength={40} onInput={e => setName((e.target as HTMLInputElement).value)} /></label>
      <div class="swatches">
        {PALETTE.map(c => <button key={c} class={`swatch${c === color ? ' is-on' : ''}`} style={{ background: c }} onClick={() => { haptic(); setColor(c) }} aria-label="Цвет" />)}
      </div>
      <div class="icon-grid">
        {CATEGORY_ICONS.map(i => (
          <button key={i} class={`icon-cell${i === icon ? ' is-on' : ''}`} style={{ '--c': color } as CSSProperties} onClick={() => { haptic(); setIcon(i) }}>
            <Icon name={i} size={22} />
          </button>
        ))}
      </div>
      <button class="btn btn-primary btn-block" onClick={save}><Icon name="check" size={18} /> Сохранить</button>
      {cat && <button class="btn btn-ghost btn-block" onClick={toggleArchive}>{cat.archived ? 'Показывать снова' : 'Скрыть категорию'}</button>}
    </div>
  )
}

// ——— Курсы валют ———

export function RatesSheet() {
  const d = data.value
  const [rates, setRates] = useState<Record<string, string>>(Object.fromEntries(Object.entries(d.settings.rates).map(([k, v]) => [k, String(v)])))
  const [busy, setBusy] = useState(false)
  const [add, setAdd] = useState('')
  const commit = (next: Record<string, string>) => {
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(next)) {
      const n = parseFloat(v.replace(',', '.'))
      if (n > 0) out[k] = n
    }
    setSettings({ rates: out })
  }
  // Официальные курсы Нацбанка Беларуси
  const fetchNbrb = async () => {
    haptic()
    setBusy(true)
    try {
      const r = await fetch('https://api.nbrb.by/exrates/rates?periodicity=0')
      const list = await r.json() as { Cur_Abbreviation: string; Cur_Scale: number; Cur_OfficialRate: number }[]
      const next = { ...rates }
      for (const k of Object.keys(next)) {
        const x = list.find(l => l.Cur_Abbreviation === k)
        if (x) next[k] = String(+(x.Cur_OfficialRate / x.Cur_Scale).toFixed(5))
      }
      setRates(next)
      commit(next)
      setSettings({ ratesAt: Date.now() })
      showToast('Курсы обновлены по Нацбанку', { tone: 'good' })
    } catch {
      showToast('Не удалось получить курсы — проверьте интернет', { tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <SheetHeader title="Курсы валют" sub={`Сколько ${d.settings.base} за 1 единицу. Нужны для покупок в валюте и итогов`} />
      <button class="btn btn-soft btn-block" disabled={busy} onClick={fetchNbrb}>
        {busy ? <span class="spinner" /> : <Icon name="sync" size={16} />} Взять курсы Нацбанка
      </button>
      {d.settings.ratesAt && <p class="muted small center">Обновлено {dayTitle(d.settings.ratesAt).toLowerCase()}</p>}
      <section class="card">
        {Object.keys(rates).map(k => (
          <div key={k} class="rate-row">
            <b>{symbol(k)} <small class="muted">{k}</small></b>
            <div class="input-money input-money-sm">
              <input inputMode="decimal" value={rates[k]} onInput={e => setRates({ ...rates, [k]: (e.target as HTMLInputElement).value })} onBlur={() => commit(rates)} />
              <span>{symbol(d.settings.base)}</span>
            </div>
            <button class="icon-btn" aria-label="Убрать" onClick={() => { const n = { ...rates }; delete n[k]; setRates(n); commit(n) }}><Icon name="close" size={14} /></button>
          </div>
        ))}
        <form class="rate-row" onSubmit={e => {
          e.preventDefault()
          const c = add.trim().toUpperCase()
          if (!/^[A-Z]{3}$/.test(c) || c === d.settings.base) return
          const n = { ...rates, [c]: rates[c] ?? '1' }
          setRates(n); commit(n); setAdd('')
        }}>
          <input class="plain" placeholder="Код валюты, например GEL" maxLength={3} value={add} onInput={e => setAdd((e.target as HTMLInputElement).value)} />
          <button class="btn btn-soft btn-sm" type="submit">Добавить</button>
        </form>
      </section>
    </div>
  )
}
