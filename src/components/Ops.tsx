// Все операции: поиск, фильтры, список по дням с подгрузкой.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { haptic } from '../lib/haptic'
import { plural } from '../lib/money'
import { txTitle } from '../lib/model'
import { totals } from '../lib/stats'
import { categoryOf, data, opsAccount, opsCategory, opsKind, opsQuery, openSheet } from '../state'
import { TopBar } from './Home'
import { Icon } from './icons'
import { TxList } from './tx'
import { Empty, Money } from './ui'

const STEP = 60

export function Ops() {
  const d = data.value
  const q = opsQuery.value.trim().toLowerCase()
  const kind = opsKind.value
  const acc = opsAccount.value
  const cat = opsCategory.value
  const [limit, setLimit] = useState(STEP)
  const sentinel = useRef<HTMLDivElement>(null)

  const list = useMemo(() => d.txs.filter(t => {
    if (kind === 'expense' && t.kind !== 'expense' && t.kind !== 'refund') return false
    if (kind === 'income' && t.kind !== 'income') return false
    if (kind === 'transfer' && t.kind !== 'transfer') return false
    if (acc && t.account !== acc && t.to !== acc) return false
    if (cat && t.category !== cat) return false
    if (q) {
      const hay = [txTitle(t, d), t.merchant ?? '', t.note ?? '', categoryOf(t.category).name, (t.amount / 100).toFixed(2), t.city ?? ''].join(' ').toLowerCase()
      if (!q.split(/\s+/).every(w => hay.includes(w.replace(',', '.')))) return false
    }
    return true
  }), [d, q, kind, acc, cat])

  useEffect(() => setLimit(STEP), [q, kind, acc, cat])

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) setLimit(l => l + STEP) }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [list.length > limit])

  const sum = useMemo(() => totals(list, d.settings), [list])
  const filtered = !!(q || kind !== 'all' || acc || cat)
  const chips: { id: typeof kind; label: string }[] = [
    { id: 'all', label: 'Все' }, { id: 'expense', label: 'Расходы' }, { id: 'income', label: 'Доходы' }, { id: 'transfer', label: 'Переводы' }
  ]
  const accName = acc ? d.accounts.find(a => a.id === acc)?.name : null
  const catObj = cat ? categoryOf(cat) : null

  return (
    <div class="screen ops">
      <TopBar title="Операции" />

      <div class="ops-tools">
        <label class="search">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Магазин, сумма, заметка" value={opsQuery.value}
            onInput={e => { opsQuery.value = (e.target as HTMLInputElement).value }} enterKeyHint="search" />
          {opsQuery.value && <button class="search-clear" onClick={() => { opsQuery.value = '' }} aria-label="Очистить"><Icon name="close" size={14} /></button>}
        </label>
        <div class="chips no-drag">
          {chips.map(c => (
            <button key={c.id} class={`chip-btn${kind === c.id ? ' is-on' : ''}`} onClick={() => { haptic(); opsKind.value = c.id }}>{c.label}</button>
          ))}
          {d.accounts.filter(a => !a.archived).length > 1 && d.accounts.filter(a => !a.archived).map(a => (
            <button key={a.id} class={`chip-btn${acc === a.id ? ' is-on' : ''}`} onClick={() => { haptic(); opsAccount.value = acc === a.id ? null : a.id }}>
              <span class="chip-dot" style={{ background: a.color }} />{a.name}
            </button>
          ))}
        </div>
        {(catObj || accName) && (
          <div class="active-filters">
            {catObj && <button class="chip-btn is-on" onClick={() => { opsCategory.value = null }}>{catObj.name} <Icon name="close" size={12} /></button>}
          </div>
        )}
      </div>

      {filtered && list.length > 0 && (
        <div class="ops-sum">
          <span>{list.length} {plural(list.length, ['операция', 'операции', 'операций'])}</span>
          {sum.expense > 0 && <span>расходы <Money value={-sum.expense} /></span>}
          {sum.income > 0 && <span>доходы <Money value={sum.income} sign class="is-in" /></span>}
        </div>
      )}

      {list.length ? (
        <>
          <TxList txs={list.slice(0, limit)} />
          {list.length > limit && <div ref={sentinel} class="sentinel" />}
        </>
      ) : filtered ? (
        <Empty icon="search" title="Ничего не нашлось" text="Попробуйте другой запрос или снимите фильтры">
          <button class="btn btn-soft" onClick={() => { opsQuery.value = ''; opsKind.value = 'all'; opsAccount.value = null; opsCategory.value = null }}>Сбросить фильтры</button>
        </Empty>
      ) : (
        <Empty icon="list" title="Операций пока нет" text="Добавьте первую вручную или подключите запись из SMS — тогда траты по карте будут появляться сами">
          <button class="btn btn-primary" onClick={() => { haptic(); openSheet({ type: 'add' }) }}><Icon name="plus" size={18} /> Добавить</button>
        </Empty>
      )}
    </div>
  )
}
