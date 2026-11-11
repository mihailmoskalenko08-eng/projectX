// Добавление и правка операции: своя клавиатура, категории по частоте, счета, дата, заметка.

import type { CSSProperties } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import { addDays, fromLocalInput, startOfDay, toLocalInput } from '../lib/dates'
import { haptic } from '../lib/haptic'
import { symbol } from '../lib/money'
import { TRANSFER_CATEGORY, type Kind, type Tx } from '../lib/model'
import { addTx, data, openSheet, saveTx, showToast } from '../state'
import { Icon } from './icons'
import { CatIcon, Segmented, SheetHeader, useCloseSheet } from './ui'

type Mode = 'expense' | 'income' | 'transfer'

function toText(minor: number): string {
  const s = (minor / 100).toFixed(2).replace(/\.?0+$/, '')
  return s.replace('.', ',')
}

export function AddSheet({ kind: initKind, category: initCat, account: initAcc, editId }: {
  kind?: Kind
  category?: string
  account?: string
  editId?: string
}) {
  const close = useCloseSheet()
  const d = data.value
  const editing = editId ? d.txs.find(t => t.id === editId) : undefined
  const accounts = d.accounts.filter(a => !a.archived)
  const startMode: Mode = editing ? (editing.kind === 'refund' ? 'expense' : editing.kind) : initKind === 'income' ? 'income' : initKind === 'transfer' ? 'transfer' : 'expense'

  const [mode, setMode] = useState<Mode>(startMode)
  const [text, setText] = useState(editing ? toText(editing.amount) : '')
  const [currency, setCurrency] = useState(editing?.currency ?? d.settings.base)
  const [category, setCategory] = useState<string>(editing?.category ?? initCat ?? '')
  const [account, setAccount] = useState(editing?.account ?? initAcc ?? accounts.find(a => a.kind === 'cash')?.id ?? accounts[0]?.id)
  const [to, setTo] = useState(editing?.to ?? accounts.find(a => a.id !== account)?.id ?? '')
  const [at, setAt] = useState(editing?.at ?? Date.now())
  const [note, setNote] = useState(editing?.note ?? '')
  const [noteOpen, setNoteOpen] = useState(!!editing?.note)
  const [shake, setShake] = useState(0)
  const [refund, setRefund] = useState(editing?.kind === 'refund')

  // Категории: чаще используемые — первыми
  const cats = useMemo(() => {
    const kind = mode === 'income' ? 'income' : 'expense'
    const usage = new Map<string, number>()
    for (const t of d.txs.slice(0, 400)) usage.set(t.category, (usage.get(t.category) ?? 0) + 1)
    return d.categories
      .filter(c => c.kind === kind && !c.archived)
      .map((c, i) => ({ c, score: (usage.get(c.id) ?? 0) * 100 - i }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.c)
  }, [mode, d.categories])

  const amount = Math.round(parseFloat((text || '0').replace(',', '.')) * 100)
  const currencies = [d.settings.base, ...Object.keys(d.settings.rates).filter(c => c !== d.settings.base)]

  const press = (k: string) => {
    haptic()
    setText(cur => {
      if (k === 'back') return cur.slice(0, -1)
      if (k === ',') {
        if (cur.includes(',')) return cur
        return (cur || '0') + ','
      }
      if (cur === '0') return k
      const [w, f] = cur.split(',')
      if (f !== undefined && f.length >= 2) return cur
      if (f === undefined && w.length >= 8) return cur
      return cur + k
    })
  }

  const submit = () => {
    if (!(amount > 0)) { haptic(); setShake(x => x + 1); return }
    if (mode === 'transfer' && (!to || to === account)) { showToast('Выберите, куда перевести', { tone: 'bad' }); return }
    const cat = mode === 'transfer' ? TRANSFER_CATEGORY : (category && cats.some(c => c.id === category) ? category : (mode === 'income' ? 'other_in' : 'other'))
    const kind: Kind = mode === 'expense' && refund ? 'refund' : mode
    const base: Omit<Tx, 'id'> = {
      ...(editing ?? {}),
      kind, amount, currency, category: cat, account: account!, at,
      src: editing?.src ?? 'manual'
    }
    if (mode === 'transfer') base.to = to
    else delete base.to
    if (note.trim()) base.note = note.trim().slice(0, 200)
    else delete base.note
    // Сумма в основной валюте пересчитается по курсу, если поменяли сумму или валюту
    if (editing && (editing.amount !== amount || editing.currency !== currency)) delete base.base
    if (editing) {
      saveTx({ ...base, id: editing.id } as Tx)
      showToast('Сохранено', { tone: 'good' })
    } else {
      addTx(base)
      showToast(mode === 'expense' ? 'Расход записан' : mode === 'income' ? 'Доход записан' : 'Перевод записан', { tone: 'good' })
    }
    close()
  }

  const today = startOfDay(Date.now())
  const dayChoice = startOfDay(at) === today ? 'today' : startOfDay(at) === addDays(today, -1) ? 'yesterday' : 'other'
  const setDay = (dayStart: number) => {
    const t = new Date(at)
    const n = new Date(dayStart)
    n.setHours(t.getHours(), t.getMinutes())
    setAt(n.getTime())
  }

  const accColor = (id?: string) => d.accounts.find(a => a.id === id)?.color ?? '#D9824A'
  const tone = mode === 'income' ? 'var(--good)' : mode === 'transfer' ? '#8F9891' : 'var(--ink)'

  return (
    <div class="add">
      <SheetHeader title={editing ? 'Правка операции' : 'Новая операция'} />
      <Segmented value={mode} onChange={v => { setMode(v); setCategory('') }}
        options={[{ value: 'expense', label: 'Расход' }, { value: 'income', label: 'Доход' }, { value: 'transfer', label: 'Перевод' }]} />

      <div class={`amount-display${shake ? ' is-shake' : ''}`} key={shake} style={{ '--tone': tone } as CSSProperties}>
        <span class={`amount-text${text ? '' : ' is-empty'}`}>
          {mode === 'expense' && text ? '−' : mode === 'income' && text ? '+' : ''}{text || '0'}<i class="caret" />
        </span>
        <button class="cur-pill" onClick={() => { haptic(); setCurrency(currencies[(currencies.indexOf(currency) + 1) % currencies.length]) }}>
          {symbol(currency)}
          {currency !== d.settings.base && <small>{currency}</small>}
        </button>
      </div>

      {mode !== 'transfer' ? (
        <div class="cat-row no-drag">
          {cats.map(c => (
            <button key={c.id} class={`cat-cell${category === c.id ? ' is-on' : ''}`} style={{ '--c': c.color } as CSSProperties}
              onClick={() => { haptic(); setCategory(c.id) }}>
              <CatIcon icon={c.icon} color={c.color} size={42} />
              <span>{c.name}</span>
            </button>
          ))}
          <button class="cat-cell cat-more" onClick={() => { haptic(); openSheet({ type: 'editCategory', kind: mode === 'income' ? 'income' : 'expense' }) }}>
            <span class="cat-icon cat-icon-more"><Icon name="plus" size={20} /></span>
            <span>Своя</span>
          </button>
        </div>
      ) : (
        <div class="transfer-pick">
          <div>
            <span class="label">Откуда</span>
            <div class="chips no-drag">
              {accounts.map(a => (
                <button key={a.id} class={`chip-btn${account === a.id ? ' is-on' : ''}`} onClick={() => { haptic(); setAccount(a.id); if (to === a.id) setTo(accounts.find(x => x.id !== a.id)?.id ?? '') }}>
                  <span class="chip-dot" style={{ background: a.color }} />{a.name}
                </button>
              ))}
            </div>
          </div>
          <div class="transfer-arrow"><Icon name="down" size={18} /></div>
          <div>
            <span class="label">Куда</span>
            <div class="chips no-drag">
              {accounts.filter(a => a.id !== account).map(a => (
                <button key={a.id} class={`chip-btn${to === a.id ? ' is-on' : ''}`} onClick={() => { haptic(); setTo(a.id) }}>
                  <span class="chip-dot" style={{ background: a.color }} />{a.name}
                </button>
              ))}
              {accounts.length < 2 && <button class="chip-btn" onClick={() => openSheet({ type: 'account' })}><Icon name="plus" size={14} /> Новый счёт</button>}
            </div>
          </div>
        </div>
      )}

      <div class="add-meta no-drag">
        {mode !== 'transfer' && accounts.length > 1 && accounts.map(a => (
          <button key={a.id} class={`chip-btn${account === a.id ? ' is-on' : ''}`} onClick={() => { haptic(); setAccount(a.id) }}>
            <span class="chip-dot" style={{ background: accColor(a.id) }} />{a.name}
          </button>
        ))}
        <button class={`chip-btn${dayChoice === 'today' ? ' is-on' : ''}`} onClick={() => { haptic(); setDay(today) }}>Сегодня</button>
        <button class={`chip-btn${dayChoice === 'yesterday' ? ' is-on' : ''}`} onClick={() => { haptic(); setDay(addDays(today, -1)) }}>Вчера</button>
        <label class={`chip-btn chip-date${dayChoice === 'other' ? ' is-on' : ''}`}>
          <Icon name="calendar" size={14} />
          {dayChoice === 'other' ? new Date(at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : 'Дата'}
          <input type="datetime-local" value={toLocalInput(at)} onChange={e => { const v = fromLocalInput((e.target as HTMLInputElement).value); if (v) setAt(v) }} />
        </label>
        {!noteOpen && <button class="chip-btn" onClick={() => { haptic(); setNoteOpen(true) }}><Icon name="note" size={14} /> Заметка</button>}
        {mode === 'expense' && (
          <button class={`chip-btn${refund ? ' is-on' : ''}`} onClick={() => { haptic(); setRefund(!refund) }}>
            <Icon name="download" size={14} /> Возврат
          </button>
        )}
      </div>

      {noteOpen && (
        <label class="note-field">
          <Icon name="note" size={18} />
          <input type="text" placeholder="Заметка" value={note} maxLength={200} autoFocus={!editing} onInput={e => setNote((e.target as HTMLInputElement).value)} enterKeyHint="done" />
        </label>
      )}

      <div class="keypad no-drag">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back'].map(k => (
          <button key={k} class={`key${k === 'back' ? ' key-back' : ''}`} onClick={() => press(k)} aria-label={k === 'back' ? 'Стереть' : k}>
            {k === 'back' ? <Icon name="backspace" size={24} /> : k}
          </button>
        ))}
      </div>

      <button class={`btn btn-primary btn-block btn-big${amount > 0 ? '' : ' is-idle'}`} onClick={submit}>
        <Icon name="check" size={20} /> {editing ? 'Сохранить' : 'Готово'}
      </button>
    </div>
  )
}
