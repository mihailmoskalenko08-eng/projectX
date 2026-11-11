// Главный экран: сколько денег, как идёт месяц (словами), куда уходят деньги, последние операции.

import { useMemo } from 'preact/hooks'
import { DAY, dayTitle, MONTHS_GEN, MONTHS_PREP, periodLabel, periodOf, relativeTime, shortDate } from '../lib/dates'
import { haptic } from '../lib/haptic'
import { formatMoney, plural } from '../lib/money'
import { prettyMerchant, type Account } from '../lib/model'
import { balanceSeries, byCategory, inPeriod, insights, pace, recurring, totals } from '../lib/stats'
import {
  balances, data, openSheet, pasteSmsFromClipboard, setSettings, statsOffset, syncError, syncNow, syncing, tab, totalBalance
} from '../state'
import { AreaChart, StackBar } from './charts'
import { Icon } from './icons'
import { TxRow } from './tx'
import { CatIcon, CountUp, Money } from './ui'

export function TopBar({ title }: { title?: string }) {
  const d = data.value
  const s = d.settings.sync
  const err = syncError.value
  return (
    <header class="topbar">
      {title ? <h1>{title}</h1> : (
        <span class="wordmark">
          <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width={28} height={28} />
          Копейка
        </span>
      )}
      <div class="topbar-actions">
        <button class="icon-btn" aria-label="Записать SMS из буфера"
          onClick={async () => { haptic(); if (!(await pasteSmsFromClipboard())) openSheet({ type: 'paste' }) }}>
          <Icon name="message" size={20} />
        </button>
        {s && (
          <button class={`icon-btn${syncing.value ? ' is-spin' : ''}`} aria-label="Обновить из SMS"
            onClick={() => { haptic(); void syncNow(true) }}>
            <Icon name="sync" size={20} />
            {err && <span class="icon-btn-dot" />}
          </button>
        )}
        <button class="icon-btn" aria-label={d.settings.hide ? 'Показать суммы' : 'Скрыть суммы'}
          onClick={() => { haptic(); setSettings({ hide: !d.settings.hide }) }}>
          <Icon name={d.settings.hide ? 'eyeOff' : 'eye'} size={20} />
        </button>
      </div>
    </header>
  )
}

function AccountChip({ acc, bal }: { acc: Account; bal: number }) {
  const icon = acc.kind === 'cash' ? 'cash' : acc.kind === 'savings' ? 'savings' : 'card'
  return (
    <button class="acct" onClick={() => { haptic(); openSheet({ type: 'account', id: acc.id }) }}>
      <CatIcon icon={icon} color={acc.color} size={32} />
      <span class="acct-text">
        <span class="acct-name">{acc.name}{acc.last4 && <span class="muted"> ·{acc.last4}</span>}</span>
        <Money value={bal} cur={acc.currency} class="acct-bal" />
      </span>
    </button>
  )
}

/** Линейка бюджета: сколько потрачено и где «должны быть» к сегодняшнему дню. */
function BudgetRuler({ spent, budget, elapsed, total }: { spent: number; budget: number; elapsed: number; total: number }) {
  const p = Math.min(1, spent / budget)
  const expected = Math.min(1, elapsed / total)
  const ahead = spent / budget > expected + 0.03
  return (
    <div class="ruler">
      <div class={`ruler-track${spent > budget ? ' is-over' : ahead ? ' is-ahead' : ''}`}>
        <span class="ruler-fill" style={{ width: `${p * 100}%` }} />
        <i class="ruler-today" style={{ left: `${expected * 100}%` }} />
      </div>
      <div class="ruler-scale">
        <span>0</span>
        <span class="ruler-today-label" style={{ left: `${expected * 100}%` }}>сегодня</span>
        <span>{formatMoney(budget, data.value.settings.base, { cents: 'never' })}</span>
      </div>
    </div>
  )
}

export function Home() {
  const d = data.value
  const s = d.settings
  const now = Date.now()
  const period = periodOf(now, s.periodStart)
  const curTx = useMemo(() => inPeriod(d.txs, period), [d.txs, period.start])
  const t = useMemo(() => totals(curTx, s), [curTx, s])
  const pc = useMemo(() => pace(d, now), [d])
  const series = useMemo(() => balanceSeries(d, totalBalance.value, 30, now), [d, totalBalance.value])
  const cats = useMemo(() => byCategory(curTx, d), [curTx, d.categories])
  const tips = useMemo(() => insights(d, now), [d])
  const soon = useMemo(() => recurring(d, now).filter(r => r.next >= now - DAY && r.next - now < 10 * DAY).slice(0, 3), [d])
  const recent = d.txs.slice(0, 8)
  const delta = series.length ? series[series.length - 1] - series[0] : 0
  const accounts = d.accounts.filter(a => !a.archived)
  const budget = s.budget ?? 0
  const lastDay = new Date(period.end - DAY)
  const endLabel = `${lastDay.getDate()} ${MONTHS_GEN[lastDay.getMonth()]}`
  const daysLeft = pc.total - pc.elapsed + 1
  const goStats = () => { haptic(); statsOffset.value = 0; tab.value = 'stats' }

  return (
    <div class="screen home">
      <TopBar />

      {/* Баланс */}
      <section class="balance">
        <span class="label">На всех счетах</span>
        <CountUp value={totalBalance.value} class="balance-amount" />
        {delta !== 0 && (
          <p class="balance-delta">
            <span class={delta > 0 ? 'is-in' : 'is-bad'}>{delta > 0 ? '↑' : '↓'} <Money value={Math.abs(delta)} cents="never" /></span> за 30 дней
          </p>
        )}
        <AreaChart values={series} height={72} class="balance-chart" color="var(--accent)" />
        <div class="axis"><span>{shortDate(now - 29 * DAY)}</span><span>сегодня</span></div>
      </section>

      <div class="accts no-drag">
        {accounts.map(a => <AccountChip key={a.id} acc={a} bal={balances.value.get(a.id) ?? 0} />)}
        <button class="acct acct-add" onClick={() => { haptic(); openSheet({ type: 'account' }) }} aria-label="Добавить счёт">
          <Icon name="plus" size={18} />
        </button>
      </div>

      {d.txs.every(t => t.src !== 'sms') && (
        <button class="callout" onClick={async () => { haptic(); if (!(await pasteSmsFromClipboard())) openSheet({ type: 'paste' }) }}>
          <Icon name="copy" size={22} />
          <span>
            <b>Записать SMS банка</b>
            <small>Скопируйте SMS в «Сообщениях» (долгое нажатие → «Скопировать») и нажмите сюда. Значок сообщения вверху делает то же самое.</small>
          </span>
          <Icon name="right" size={18} />
        </button>
      )}

      {!s.sync && (
        <button class="callout" onClick={() => { haptic(); openSheet({ type: 'sync' }) }}>
          <Icon name="message" size={22} />
          <span>
            <b>Записывать траты из SMS банка</b>
            <small>Оплатили картой — операция появилась сама. Настройка займёт минут десять.</small>
          </span>
          <Icon name="right" size={18} />
        </button>
      )}

      {d.pending.length > 0 && (
        <button class="callout callout-warn" onClick={() => { haptic(); openSheet({ type: 'pending' }) }}>
          <Icon name="alert" size={20} />
          <span><b>{d.pending.length} {plural(d.pending.length, ['SMS ждёт', 'SMS ждут', 'SMS ждут'])} разбора</b></span>
          <Icon name="right" size={18} />
        </button>
      )}

      {/* Месяц — словами */}
      <section class="block">
        <div class="block-head">
          <h2>{periodLabel(period, s.periodStart)}</h2>
          <button class="text-btn" onClick={goStats}>Аналитика <Icon name="right" size={14} /></button>
        </div>
        <div class="spent">
          <Money value={t.expense} big class="spent-amount" />
          <span class="spent-label">потрачено{s.periodStart === 1 ? ` в ${MONTHS_PREP[period.m]}` : ''}</span>
        </div>
        {budget > 0 && <BudgetRuler spent={t.expense} budget={budget} elapsed={pc.elapsed} total={pc.total} />}
        <p class="story">
          {budget > 0 ? (
            pc.left! >= 0 ? (
              <>Осталось <Money value={pc.left!} cents="never" /> — это <Money value={pc.perDay!} cents="never" /> в день на {daysLeft} {plural(daysLeft, ['день', 'дня', 'дней'])}. </>
            ) : (
              <>Бюджет превышен на <Money value={-pc.left!} cents="never" class="is-bad" />. </>
            )
          ) : (
            <>В среднем <Money value={Math.round(t.expense / pc.elapsed)} cents="never" /> в день. </>
          )}
          {pc.elapsed >= 3 && <>В таком темпе к {endLabel} выйдет <Money value={pc.forecast} cents="never" class={budget && pc.forecast > budget ? 'is-bad' : ''} />. </>}
          {t.income > 0 && <>Пришло <Money value={t.income} cents="never" class="is-in" />.</>}
        </p>
        {!budget && (
          <button class="text-btn" onClick={() => { haptic(); openSheet({ type: 'budgets' }) }}>
            <Icon name="target" size={16} /> Задать бюджет на месяц
          </button>
        )}
      </section>

      {tips.length > 0 && (
        <ul class="notes">
          {tips.map((tip, i) => (
            <li key={i} class={`note note-${tip.tone}`}>
              <Icon name={tip.icon} size={18} />
              <span>{tip.text}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Куда уходят деньги */}
      {cats.length > 0 && (
        <section class="block">
          <div class="block-head">
            <h2>Куда уходят деньги</h2>
            <button class="text-btn" onClick={goStats}>Все</button>
          </div>
          <StackBar parts={cats.map(c => ({ id: c.cat.id, value: c.amount, color: c.cat.color }))} />
          <div class="shares">
            {cats.slice(0, 5).map(c => (
              <button key={c.cat.id} class="share" onClick={() => { haptic(); openSheet({ type: 'category', id: c.cat.id, offset: 0 }) }}>
                <i style={{ background: c.cat.color }} />
                <span class="share-name">{c.cat.name}</span>
                <span class="share-pct">{Math.round(c.share * 100)}%</span>
                <Money value={c.amount} cents="never" />
              </button>
            ))}
          </div>
        </section>
      )}

      {soon.length > 0 && (
        <section class="block">
          <div class="block-head">
            <h2>Скоро спишется</h2>
            <button class="text-btn" onClick={() => { haptic(); openSheet({ type: 'recurring' }) }}>Все</button>
          </div>
          <div class="list">
            {soon.map(r => {
              const cat = d.categories.find(c => c.id === r.category)
              return (
                <div key={r.key} class="soon">
                  <CatIcon icon={cat?.icon ?? 'repeat'} color={cat?.color ?? '#9D8FC6'} size={40} />
                  <span class="soon-main">
                    <b>{d.names[r.key] ?? prettyMerchant(r.merchant)}</b>
                    <small>{dayTitle(r.next)}</small>
                  </span>
                  <Money value={-r.amount} />
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section class="block">
        <div class="block-head">
          <h2>Последние операции</h2>
          {d.txs.length > recent.length && <button class="text-btn" onClick={() => { haptic(); tab.value = 'ops' }}>Все</button>}
        </div>
        {recent.length ? (
          <div class="list">{recent.map(tx => <TxRow key={tx.id} tx={tx} showDate />)}</div>
        ) : (
          <p class="story muted">Здесь появятся ваши операции. Нажмите «+», чтобы добавить первую, или включите запись из SMS.</p>
        )}
      </section>

      {s.sync?.lastAt && (
        <p class="footnote">
          SMS проверены {relativeTime(s.sync.lastAt)}
          {syncError.value && <> · <span class="is-bad">{syncError.value}</span></>}
        </p>
      )}
    </div>
  )
}
