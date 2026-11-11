// Аналитика: кольцо категорий, темп трат, дни, дни недели, магазины.

import { useMemo, useState } from 'preact/hooks'
import { MONTHS_DAT, MONTHS_GEN, periodLabel, periodOf, shortDate, startOfDay, DAY } from '../lib/dates'
import { haptic } from '../lib/haptic'
import { formatMoney, plural } from '../lib/money'
import { prettyMerchant } from '../lib/model'
import { byCategory, cumulative, dailySpend, inPeriod, topMerchants, totals, weekdayPattern } from '../lib/stats'
import { categoryOf, data, openSheet, statsKind, statsOffset } from '../state'
import { DayBars, Donut, groupSmall, PaceChart, REST_ID, WeekBars } from './charts'
import { TopBar } from './Home'
import { Icon } from './icons'
import { CatIcon, CountUp, Empty, Money, Segmented } from './ui'

export function Stats() {
  const d = data.value
  const s = d.settings
  const off = statsOffset.value
  const kind = statsKind.value
  const now = Date.now()
  const p = periodOf(now, s.periodStart, off)
  const prev = periodOf(now, s.periodStart, off - 1)
  const [sel, setSel] = useState<string | null>(null)
  const [pickedDay, setPickedDay] = useState<number | null>(null)

  const txs = useMemo(() => inPeriod(d.txs, p), [d.txs, p.start])
  const prevTxs = useMemo(() => inPeriod(d.txs, prev), [d.txs, prev.start])
  const t = useMemo(() => totals(txs, s), [txs, s])
  const pt = useMemo(() => totals(prevTxs, s), [prevTxs, s])
  const cats = useMemo(() => byCategory(txs, d, kind), [txs, d.categories, kind])
  const daily = useMemo(() => dailySpend(txs, p, s), [txs, p.start])
  const prevDaily = useMemo(() => dailySpend(prevTxs, prev, s), [prevTxs, prev.start])
  const week = useMemo(() => weekdayPattern(txs, s), [txs])
  const merchants = useMemo(() => topMerchants(txs, s, 6), [txs])
  const isCurrent = off === 0
  const todayIdx = isCurrent ? Math.floor((startOfDay(now) - p.start) / DAY + 0.5) : daily.length - 1
  const total = kind === 'expense' ? t.expense : t.income
  // В текущем месяце сравниваем с тем же днём прошлого, иначе 11 дней против целого месяца
  const ptSame = useMemo(() => (off === 0 ? totals(prevTxs.filter(x => x.at < prev.start + (now - p.start)), s) : pt), [prevTxs, off, pt])
  const prevTotal = kind === 'expense' ? ptSame.expense : ptSame.income
  const diff = prevTotal > 0 ? (total - prevTotal) / prevTotal : null
  const selCat = sel ? cats.find(c => c.cat.id === sel) : null
  const budget = s.budget ?? 0
  const canNext = off < 0
  const oldest = d.txs.length ? d.txs[d.txs.length - 1].at : now
  const canPrev = p.start > oldest

  const go = (delta: number) => { haptic(); setSel(null); setPickedDay(null); statsOffset.value = off + delta }

  return (
    <div class="screen stats">
      <TopBar title="Аналитика" />

      <div class="period-nav">
        <button class="icon-btn glass" onClick={() => go(-1)} disabled={!canPrev} aria-label="Предыдущий период"><Icon name="left" size={18} /></button>
        <div class="period-nav-label">
          <b>{periodLabel(p, s.periodStart)}</b>
          {!isCurrent && <button class="link" onClick={() => go(-off)}>к текущему</button>}
        </div>
        <button class="icon-btn glass" onClick={() => go(1)} disabled={!canNext} aria-label="Следующий период"><Icon name="right" size={18} /></button>
      </div>

      <Segmented value={kind} onChange={v => { setSel(null); statsKind.value = v }}
        options={[{ value: 'expense', label: 'Расходы' }, { value: 'income', label: 'Доходы' }]} />

      {cats.length ? (
        <section class="block donut-block">
          <Donut parts={groupSmall(cats.map(c => ({ id: c.cat.id, value: c.amount, color: c.cat.color })))} selected={sel} onSelect={setSel}>
            {sel === REST_ID ? (() => {
              const rest = cats.filter(c => c.share < 0.03)
              const sum = rest.reduce((a, c) => a + c.amount, 0)
              return (
                <>
                  <span class="donut-label">Остальное</span>
                  <Money value={sum} big class="donut-value" cents="never" />
                  <span class="donut-sub">{rest.length} {plural(rest.length, ['категория', 'категории', 'категорий'])} · {Math.round((sum / total) * 100)}%</span>
                </>
              )
            })() : selCat ? (
              <>
                <span class="donut-label">{selCat.cat.name}</span>
                <Money value={selCat.amount} big class="donut-value" cents="never" />
                <span class="donut-sub">{Math.round(selCat.share * 100)}% · {selCat.count} {plural(selCat.count, ['операция', 'операции', 'операций'])}</span>
              </>
            ) : (
              <>
                <span class="donut-label">{kind === 'expense' ? 'Потрачено' : 'Получено'}</span>
                <CountUp value={total} class="donut-value" />
                {diff !== null && Math.abs(diff) >= 0.01 && (
                  <span class={`donut-sub ${(kind === 'expense' ? diff <= 0 : diff >= 0) ? 'is-in' : 'is-bad'}`}>
                    {diff < 0 ? '↓' : '↑'} {Math.abs(Math.round(diff * 100))}% {off === 0 ? `к этому дню ${MONTHS_GEN[prev.m]}` : `к ${MONTHS_DAT[prev.m]}`}
                  </span>
                )}
              </>
            )}
          </Donut>
          <div class="legend">
            {cats.map(c => (
              <button key={c.cat.id} class={`legend-row${sel === c.cat.id || (sel === REST_ID && c.share < 0.03) ? ' is-sel' : ''}`}
                onClick={() => { haptic(); openSheet({ type: 'category', id: c.cat.id, offset: off }) }}>
                <CatIcon icon={c.cat.icon} color={c.cat.color} size={38} />
                <span class="legend-main">
                  <span class="legend-top">
                    <span class="legend-name">{c.cat.name}</span>
                    <Money value={c.amount} />
                  </span>
                  <span class="legend-bottom">
                    <span class="minibar">
                      <span style={{ width: `${(c.amount / cats[0].amount) * 100}%`, background: c.cat.color }} />
                      {c.cat.budget && kind === 'expense' ? <i class="minibar-mark" style={{ left: `${Math.min(100, (c.cat.budget / Math.max(cats[0].amount, c.cat.budget)) * 100)}%` }} /> : null}
                    </span>
                    <span class="legend-pct">{Math.round(c.share * 100)}%</span>
                  </span>
                  {c.cat.budget && kind === 'expense' ? (
                    <span class={`legend-budget${c.amount > c.cat.budget ? ' is-bad' : ''}`}>
                      {c.amount > c.cat.budget ? `перерасход ${formatMoney(c.amount - c.cat.budget, s.base, { cents: 'never' })}` : `ещё ${formatMoney(c.cat.budget - c.amount, s.base, { cents: 'never' })} из ${formatMoney(c.cat.budget, s.base, { cents: 'never' })}`}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <Empty icon="chart" title={kind === 'expense' ? 'Расходов нет' : 'Доходов нет'} text="За этот период ничего не записано" />
      )}

      {kind === 'expense' && t.expense > 0 && (
        <>
          <section class="block">
            <div class="card-head">
              <h3>Темп трат</h3>
              <span class="muted small">накопленно за период</span>
            </div>
            <PaceChart current={cumulative(daily)} previous={cumulative(prevDaily)} budget={budget || undefined} total={daily.length} today={Math.min(todayIdx, daily.length - 1)} />
            <div class="pace-legend">
              <span><i class="lg lg-cur" />{isCurrent ? 'Этот месяц' : periodLabel(p, s.periodStart)}</span>
              <span><i class="lg lg-prev" />Прошлый: {formatMoney(pt.expense, s.base, { cents: 'never' })}</span>
              {budget > 0 && <span><i class="lg lg-budget" />Бюджет</span>}
              {isCurrent && <span><i class="lg lg-fc" />Прогноз</span>}
            </div>
          </section>

          <section class="block">
            <div class="card-head">
              <h3>По дням</h3>
              {pickedDay !== null ? (
                <span class="picked">{shortDate(p.start + pickedDay * DAY)} · <Money value={daily[pickedDay]} /></span>
              ) : <span class="muted small">нажмите на столбик</span>}
            </div>
            <DayBars values={daily} today={isCurrent ? todayIdx : undefined} picked={pickedDay} onPick={setPickedDay}
              labels={i => String(new Date(p.start + i * DAY + DAY / 2).getDate())} />
          </section>

          <section class="block">
            <div class="card-head">
              <h3>Дни недели</h3>
              <span class="muted small">в среднем за день</span>
            </div>
            <WeekBars values={week} />
          </section>

          {merchants.length > 0 && (
            <section class="block">
              <div class="card-head">
                <h3>Где тратите больше всего</h3>
              </div>
              {merchants.map((m, i) => {
                const c = categoryOf(m.category)
                return (
                  <button key={m.key} class="merchant-row" onClick={() => { haptic(); openSheet({ type: 'merchant', key: m.key }) }}>
                    <span class="rank">{i + 1}</span>
                    <CatIcon icon={c.icon} color={c.color} size={34} />
                    <span class="merchant-main">
                      <b>{d.names[m.key] ?? prettyMerchant(m.key)}</b>
                      <small>{m.count} {plural(m.count, ['покупка', 'покупки', 'покупок'])}</small>
                    </span>
                    <Money value={m.amount} cents="never" />
                  </button>
                )
              })}
            </section>
          )}

          <button class="callout" onClick={() => { haptic(); openSheet({ type: 'recurring' }) }}>
            <Icon name="repeat" size={22} />
            <span><b>Регулярные платежи</b><small>Подписки, связь и всё, что списывается каждый месяц</small></span>
            <Icon name="right" size={16} />
          </button>
        </>
      )}

      <div class="facts">
        <div class="fact">
          <span class="label">Доходы</span>
          <Money value={t.income} class="is-in" cents="never" />
        </div>
        <div class="fact">
          <span class="label">Расходы</span>
          <Money value={t.expense} cents="never" />
        </div>
        <div class="fact">
          <span class="label">Разница</span>
          <Money value={t.income - t.expense} sign cents="never" class={t.income - t.expense >= 0 ? 'is-in' : 'is-bad'} />
        </div>
        <div class="fact">
          <span class="label">Операций</span>
          <b class="stat-num">{t.count}</b>
        </div>
      </div>
    </div>
  )
}
