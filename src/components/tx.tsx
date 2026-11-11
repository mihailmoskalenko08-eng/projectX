// Строка операции и список операций по дням.

import { dayTitle, startOfDay, timeLabel } from '../lib/dates'
import { haptic } from '../lib/haptic'
import { txTitle, type Tx } from '../lib/model'
import { categoryOf, data, fresh, inBase, openSheet } from '../state'
import { CatIcon, Money } from './ui'

export function TxRow({ tx, showDate }: { tx: Tx; showDate?: boolean }) {
  const d = data.value
  const cat = categoryOf(tx.category)
  const acc = d.accounts.find(a => a.id === tx.account)
  const title = txTitle(tx, d)
  const isTransfer = tx.kind === 'transfer'
  const icon = isTransfer ? (tx.to && d.accounts.find(a => a.id === tx.to)?.kind === 'cash' ? 'cash' : 'transfer') : cat.icon
  const color = isTransfer ? '#8F9891' : cat.color
  const sign = tx.kind === 'expense' ? -1 : 1
  const meta = [
    isTransfer ? null : tx.kind === 'refund' ? `Возврат · ${cat.name}` : title === cat.name ? null : cat.name,
    showDate ? dayTitle(tx.at) : timeLabel(tx.at),
    acc && d.accounts.filter(a => !a.archived).length > 1 ? acc.name : null
  ].filter(Boolean).join(' · ')
  const foreign = tx.currency !== d.settings.base
  return (
    <button class={`tx${fresh.value.has(tx.id) ? ' is-fresh' : ''}`} onClick={() => { haptic(); openSheet({ type: 'tx', id: tx.id }) }}>
      <CatIcon icon={icon} color={color} size={44} />
      <span class="tx-main">
        <span class="tx-title">{title}{tx.note && <span class="tx-note"> · {tx.note}</span>}</span>
        <span class="tx-meta">{meta}</span>
      </span>
      <span class="tx-right">
        <Money value={sign * (foreign ? tx.amount : inBase(tx))} cur={foreign ? tx.currency : undefined} sign={!isTransfer}
          class={`tx-amt${tx.kind === 'income' || tx.kind === 'refund' ? ' is-in' : ''}${isTransfer ? ' is-tr' : ''}`} />
        {foreign && <Money value={sign * inBase(tx)} class="tx-sub" />}
        {tx.src === 'sms' && <span class="tx-badge" title="Из SMS">SMS</span>}
      </span>
    </button>
  )
}

export function groupByDay(txs: Tx[]): { day: number; items: Tx[]; spent: number; earned: number }[] {
  const groups: { day: number; items: Tx[]; spent: number; earned: number }[] = []
  for (const t of txs) {
    const day = startOfDay(t.at)
    let g = groups[groups.length - 1]
    if (!g || g.day !== day) { g = { day, items: [], spent: 0, earned: 0 }; groups.push(g) }
    g.items.push(t)
    if (t.kind === 'expense') g.spent += inBase(t)
    else if (t.kind === 'refund') g.spent -= inBase(t)
    else if (t.kind === 'income') g.earned += inBase(t)
  }
  return groups
}

export function TxList({ txs }: { txs: Tx[] }) {
  const groups = groupByDay(txs)
  return (
    <div class="txlist">
      {groups.map(g => (
        <section key={g.day} class="txday">
          <header class="txday-head">
            <span>{dayTitle(g.day)}</span>
            <span class="txday-sum">
              {g.earned > 0 && <Money value={g.earned} sign class="is-in" />}
              {g.spent > 0 && <Money value={-g.spent} />}
            </span>
          </header>
          <div class="card txday-card">
            {g.items.map(t => <TxRow key={t.id} tx={t} />)}
          </div>
        </section>
      ))}
    </div>
  )
}
