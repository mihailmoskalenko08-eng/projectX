// Подробности операции: категория (с запоминанием для магазина), название, данные из SMS, правка, удаление.

import type { CSSProperties } from 'preact'
import { useState } from 'preact/hooks'
import { dayTitle, timeLabel } from '../lib/dates'
import { haptic } from '../lib/haptic'
import { merchantKey } from '../lib/ingest'
import { mccLabel } from '../lib/mcc'
import { formatMoney } from '../lib/money'
import { prettyMerchant, txTitle } from '../lib/model'
import { categoryOf, data, deleteTx, inBase, openSheet, recategorize, renameMerchant, replaceSheet } from '../state'
import { Icon } from './icons'
import { CatIcon, Money, SheetHeader, Switch, useCloseSheet } from './ui'

export function TxSheet({ id }: { id: string }) {
  const close = useCloseSheet()
  const d = data.value
  const tx = d.txs.find(t => t.id === id)
  const [learn, setLearn] = useState(true)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [picking, setPicking] = useState(false)
  if (!tx) return <div class="pad"><SheetHeader title="Операция удалена" /></div>

  const cat = categoryOf(tx.category)
  const acc = d.accounts.find(a => a.id === tx.account)
  const to = tx.to ? d.accounts.find(a => a.id === tx.to) : undefined
  const isTransfer = tx.kind === 'transfer'
  const key = tx.merchant ? merchantKey(tx.merchant) : null
  const sameCount = key ? d.txs.filter(t => t.merchant && merchantKey(t.merchant) === key).length : 0
  const sign = tx.kind === 'expense' ? -1 : 1
  const foreign = tx.currency !== d.settings.base
  const catKind = tx.kind === 'income' ? 'income' : 'expense'
  const cats = d.categories.filter(c => c.kind === catKind && !c.archived)

  return (
    <div class="txsheet">
      <SheetHeader title="" />
      <div class="txsheet-hero" style={{ '--c': isTransfer ? '#8F9891' : cat.color } as CSSProperties}>
        <CatIcon icon={isTransfer ? (to?.kind === 'cash' ? 'cash' : 'transfer') : cat.icon} color={isTransfer ? '#8F9891' : cat.color} size={64} />
        {naming && key ? (
          <form class="rename" onSubmit={e => { e.preventDefault(); renameMerchant(key, name); setNaming(false) }}>
            <input autoFocus value={name} placeholder={prettyMerchant(key)} maxLength={60} onInput={e => setName((e.target as HTMLInputElement).value)} />
            <button class="btn btn-soft btn-sm" type="submit">Готово</button>
          </form>
        ) : (
          <button class="txsheet-title" disabled={!key} onClick={() => { haptic(); setName(d.names[key!] ?? ''); setNaming(true) }}>
            {txTitle(tx, d)} {key && <Icon name="edit" size={14} />}
          </button>
        )}
        <Money value={sign * (foreign ? tx.amount : inBase(tx))} cur={foreign ? tx.currency : undefined} sign={!isTransfer} big
          class={`txsheet-amount${tx.kind === 'income' || tx.kind === 'refund' ? ' is-in' : ''}`} />
        {foreign && <span class="muted">≈ {formatMoney(inBase(tx), d.settings.base)}{tx.base ? ' по списанию с карты' : ' по курсу'}</span>}
        <span class="txsheet-when">{dayTitle(tx.at)}, {timeLabel(tx.at)}</span>
      </div>

      {!isTransfer && (
        <section class="card">
          <button class="row row-btn" onClick={() => { haptic(); setPicking(!picking) }}>
            <CatIcon icon={cat.icon} color={cat.color} size={34} />
            <span class="row-main"><span class="row-sub">Категория</span><span class="row-title">{tx.kind === 'refund' ? `Возврат · ${cat.name}` : cat.name}</span></span>
            <Icon name={picking ? 'up' : 'down'} size={16} class="row-chev" />
          </button>
          {picking && (
            <div class="pick">
              {key && (
                <div class="learn">
                  <span>
                    <b>Запомнить для «{d.names[key] ?? prettyMerchant(key)}»</b>
                    <small>{sameCount > 1 ? `Поправлю и прошлые ${sameCount - 1}, и будущие` : 'Следующие покупки там сразу попадут сюда'}</small>
                  </span>
                  <Switch on={learn} onChange={setLearn} label="Запомнить для магазина" />
                </div>
              )}
              <div class="pick-grid">
                {cats.map(c => (
                  <button key={c.id} class={`pick-cell${c.id === tx.category ? ' is-on' : ''}`} style={{ '--c': c.color } as CSSProperties}
                    onClick={() => { haptic(); recategorize(tx.id, c.id, learn && !!key); setPicking(false) }}>
                    <CatIcon icon={c.icon} color={c.color} size={38} />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section class="card details">
        {acc && <div class="detail"><span>{isTransfer ? 'Откуда' : 'Счёт'}</span><b><i class="chip-dot" style={{ background: acc.color }} />{acc.name}</b></div>}
        {to && <div class="detail"><span>Куда</span><b><i class="chip-dot" style={{ background: to.color }} />{to.name}</b></div>}
        {tx.note && <div class="detail"><span>Заметка</span><b>{tx.note}</b></div>}
        {tx.city && <div class="detail"><span>Город</span><b>{prettyMerchant(tx.city)}</b></div>}
        {tx.mcc !== undefined && <div class="detail"><span>Тип точки</span><b>{mccLabel(tx.mcc)} <small class="muted">MCC {tx.mcc}</small></b></div>}
        {tx.bal !== undefined && <div class="detail"><span>Остаток после</span><b><Money value={tx.bal} cur={acc?.currency} /></b></div>}
        {tx.merchant && <div class="detail"><span>В SMS</span><b class="mono small">{tx.merchant}</b></div>}
        <div class="detail"><span>Источник</span><b>{tx.src === 'sms' ? 'SMS банка' : tx.src === 'demo' ? 'Демо' : tx.src === 'import' ? 'Импорт' : 'Вручную'}</b></div>
      </section>

      {key && sameCount > 1 && (
        <button class="card link-card" onClick={() => { haptic(); replaceSheet({ type: 'merchant', key }) }}>
          <Icon name="list" size={20} />
          <span><b>Все покупки здесь</b><small>{sameCount} операций</small></span>
          <Icon name="right" size={16} />
        </button>
      )}

      <div class="btn-row">
        <button class="btn btn-soft" onClick={() => { haptic(); openSheet({ type: 'add', editId: tx.id }) }}><Icon name="edit" size={18} /> Изменить</button>
        <button class="btn btn-danger" onClick={() => { haptic(); close(); setTimeout(() => deleteTx(tx.id), 250) }}><Icon name="trash" size={18} /> Удалить</button>
      </div>
    </div>
  )
}
