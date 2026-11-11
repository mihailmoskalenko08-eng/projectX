// Графики на чистом SVG: кольцо категорий, кривая баланса, столбики по дням, сравнение месяцев.

import type { CSSProperties } from 'preact'
import { useEffect, useId, useState } from 'preact/hooks'
import { haptic } from '../lib/haptic'
import { formatShort } from '../lib/money'

function useMounted(): boolean {
  const [m, setM] = useState(false)
  useEffect(() => { const r = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(r) }, [])
  return m
}

/** Ширина контейнера в пикселях — графики рисуются в настоящих пикселях, без растягивания. */
export function useWidth(): [(el: HTMLElement | null) => void, number] {
  const [w, setW] = useState(0)
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, w]
}

/** Ломаная по точкам — для денег честнее плавной кривой: не рисует изгибов, которых не было. */
export function linePath(pts: [number, number][]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
}

// ——— Кольцо ———

export interface DonutPart {
  id: string
  value: number
  color: string
}

/** Мелкие доли (меньше min) объединяются в одну — иначе на кольце получается россыпь точек. */
export function groupSmall(parts: DonutPart[], min = 0.03, color = 'var(--faint)'): DonutPart[] {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0)
  if (!total) return []
  const big = parts.filter(p => p.value / total >= min)
  const small = parts.filter(p => p.value / total < min && p.value > 0)
  if (small.length <= 1) return parts.filter(p => p.value > 0)
  return [...big, { id: REST_ID, value: small.reduce((a, p) => a + p.value, 0), color }]
}
export const REST_ID = '__rest'

function polar(c: number, r: number, deg: number): [number, number] {
  const a = (deg - 90) * Math.PI / 180
  return [c + r * Math.cos(a), c + r * Math.sin(a)]
}

/** Дуга от a0 до a1 (градусы, 0 — сверху, по часовой). */
export function arcPath(c: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(c, r, a0)
  const [x1, y1] = polar(c, r, a1)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`
}

export function Donut({ parts, size = 220, thickness = 20, selected, onSelect, children }: {
  parts: DonutPart[]
  size?: number
  thickness?: number
  selected?: string | null
  onSelect?: (id: string | null) => void
  children?: preact.ComponentChildren
}) {
  const mounted = useMounted()
  const c = size / 2
  const r = c - thickness / 2 - 4
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0)
  const shown = parts.filter(p => p.value > 0)
  // Одинаковый зазор между сегментами; у крошечных долей — минимальная видимая длина
  const gap = shown.length > 1 ? 2.2 : 0
  const minSweep = 3
  const free = 360 - gap * shown.length
  const raw = shown.map(p => (p.value / (total || 1)) * free)
  const deficit = raw.reduce((a, v) => a + Math.max(0, minSweep - v), 0)
  const bigSum = raw.reduce((a, v) => a + (v > minSweep ? v : 0), 0) || 1
  const sweeps = raw.map(v => (v < minSweep ? minSweep : v - (deficit * v) / bigSum))
  let at = gap / 2
  return (
    <div class="donut" style={{ width: size + 'px', height: size + 'px' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={c} cy={c} r={r} fill="none" class="donut-track" stroke-width={thickness} />
        {total > 0 && shown.length === 1 && (
          <circle cx={c} cy={c} r={r} fill="none" stroke={shown[0].color} stroke-width={thickness}
            class={`donut-seg${mounted ? ' is-in' : ''}`} pathLength={1} transform={`rotate(-90 ${c} ${c})`}
            onClick={() => { haptic(); onSelect?.(selected === shown[0].id ? null : shown[0].id) }} />
        )}
        {total > 0 && shown.length > 1 && shown.map((p, i) => {
          const a0 = at
          const a1 = at + sweeps[i]
          at = a1 + gap
          const sel = selected === p.id
          const dim = !!selected && !sel
          return (
            <path key={p.id} d={arcPath(c, r, a0, a1)} fill="none" stroke={p.color}
              stroke-width={sel ? thickness + 6 : thickness} stroke-linecap="butt" pathLength={1}
              class={`donut-seg${mounted ? ' is-in' : ''}${sel ? ' is-sel' : ''}${dim ? ' is-dim' : ''}`}
              style={{ transitionDelay: `${i * 40}ms` }}
              onClick={() => { haptic(); onSelect?.(sel ? null : p.id) }} />
          )
        })}
      </svg>
      <div class="donut-center">{children}</div>
    </div>
  )
}

// ——— Кривая баланса ———

export function AreaChart({ values, height = 96, color = 'var(--accent)', class: cls }: {
  values: number[]
  height?: number
  color?: string
  class?: string
}) {
  const id = useId().replace(/:/g, '')
  const mounted = useMounted()
  const [ref, W] = useWidth()
  const H = height
  const pad = 5
  if (values.length < 2) return <div style={{ height: H + 'px' }} />
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const pts: [number, number][] = values.map((v, i) => [pad + (i / (values.length - 1)) * (W - pad * 2), pad + (1 - (v - min) / span) * (H - pad * 2 - 4)])
  const line = linePath(pts)
  const last = pts[pts.length - 1]
  return (
    <div ref={ref} class={cls} style={{ height: H + 'px' }}>
      {W > 0 && (
        <svg class={`area${mounted ? ' is-in' : ''}`} viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
          <defs>
            <linearGradient id={`ag${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color={color} stop-opacity="0.16" />
              <stop offset="1" stop-color={color} stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${last[0]},${H} L${pts[0][0]},${H} Z`} fill={`url(#ag${id})`} class="area-fill" />
          <path d={line} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="area-line" pathLength={1} />
          <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} class="area-dot" />
        </svg>
      )}
    </div>
  )
}

// ——— Столбики по дням ———

export function DayBars({ values, today, labels, onPick, picked, color = 'var(--accent)' }: {
  values: number[]
  today?: number
  labels?: (i: number) => string
  onPick?: (i: number | null) => void
  picked?: number | null
  color?: string
}) {
  const mounted = useMounted()
  const max = Math.max(1, ...values)
  const days = today !== undefined ? today + 1 : values.length
  const avg = values.slice(0, days).reduce((a, b) => a + b, 0) / Math.max(1, days)
  const n = values.length
  // Подписи: 1, 8, 15, 22, 29 — без наложений в конце месяца
  const showLabel = (i: number) => i % 7 === 0 && i <= n - 1
  return (
    <div class="daybars">
      <div class="daybars-plot">
        {avg > 0 && <div class="daybars-avg" style={{ bottom: `${(avg / max) * 100}%` }} />}
        {values.map((v, i) => {
          const future = today !== undefined && i > today
          const h = v > 0 ? Math.max(3, (v / max) * 100) : 1.5
          return (
            <button key={i} class={`daybar${i === today ? ' is-today' : ''}${future ? ' is-future' : ''}${picked === i ? ' is-picked' : ''}`}
              style={{ '--h': mounted ? `${h}%` : '0%', '--d': `${i * 10}ms`, '--c': color } as CSSProperties}
              onClick={() => { if (future) return; haptic(); onPick?.(picked === i ? null : i) }}
              aria-label={labels ? labels(i) : String(i + 1)}>
              <span />
            </button>
          )
        })}
      </div>
      {labels && (
        <div class="daybars-axis">
          {values.map((_, i) => <span key={i}>{showLabel(i) ? labels(i) : ''}</span>)}
        </div>
      )}
      {avg > 0 && <div class="daybars-note"><i class="lg lg-avg" />в среднем {formatShort(avg)} Br в день</div>}
    </div>
  )
}

// ——— Сравнение месяцев: накопленные расходы ———

export function PaceChart({ current, previous, budget, total, today }: {
  current: number[]
  previous: number[]
  budget?: number
  total: number
  today: number
}) {
  const id = useId().replace(/:/g, '')
  const mounted = useMounted()
  const [ref, W] = useWidth()
  const H = 160, padT = 10, padB = 6, padX = 6
  const cur = current.slice(0, today + 1)
  const rate = cur.length ? cur[cur.length - 1] / cur.length : 0
  const forecast = rate * total
  const max = Math.max(1, ...cur, ...previous, budget ?? 0, today < total - 1 ? forecast : 0) * 1.06
  const x = (i: number) => padX + (i / Math.max(1, total - 1)) * (W - padX * 2)
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB)
  const curPts = cur.map((v, i) => [x(i), y(v)] as [number, number])
  const prevPts = previous.slice(0, total).map((v, i) => [x(i), y(v)] as [number, number])
  const curLine = linePath(curPts)
  const last = curPts[curPts.length - 1]
  return (
    <div ref={ref} style={{ height: H + 'px' }}>
      {W > 0 && (
        <svg class={`pace${mounted ? ' is-in' : ''}`} viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
          <defs>
            <linearGradient id={`pf${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="var(--accent)" stop-opacity=".12" />
              <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map(f => <line key={f} x1={padX} x2={W - padX} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} class="grid" />)}
          {budget !== undefined && budget > 0 && <line x1={padX} x2={W - padX} y1={y(budget)} y2={y(budget)} class="pace-budget" />}
          {prevPts.length > 1 && <path d={linePath(prevPts)} class="pace-prev" fill="none" stroke-linejoin="round" />}
          {last && today < total - 1 && <path d={`M${last[0]},${last[1]} L${x(total - 1)},${y(forecast)}`} class="pace-forecast" fill="none" />}
          {curPts.length > 1 && <path d={`${curLine} L${last[0]},${H - padB} L${curPts[0][0]},${H - padB} Z`} fill={`url(#pf${id})`} class="pace-fill" />}
          {curPts.length > 1 && <path d={curLine} class="pace-cur" stroke="var(--accent)" fill="none" stroke-linejoin="round" pathLength={1} />}
          {last && <circle cx={last[0]} cy={last[1]} r="4" class="pace-dot" />}
        </svg>
      )}
    </div>
  )
}

// ——— Дни недели ———

export function WeekBars({ values }: { values: number[] }) {
  const mounted = useMounted()
  const max = Math.max(1, ...values)
  const top = values.indexOf(Math.max(...values))
  const names = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
  return (
    <div class="weekbars">
      {values.map((v, i) => (
        <div key={i} class={`weekbar${i === top && v > 0 ? ' is-top' : ''}`}>
          <div class="weekbar-track"><span style={{ height: mounted ? `${Math.max(3, (v / max) * 100)}%` : '0%', transitionDelay: `${i * 40}ms` }} /></div>
          <small>{names[i]}</small>
        </div>
      ))}
    </div>
  )
}

// ——— Полоса долей: категории одной линейкой ———

export function StackBar({ parts, selected, onSelect }: {
  parts: DonutPart[]
  selected?: string | null
  onSelect?: (id: string | null) => void
}) {
  const mounted = useMounted()
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0) || 1
  return (
    <div class={`stackbar${mounted ? ' is-in' : ''}`} role="img" aria-label="Доли категорий">
      {parts.map((p, i) => (
        <button key={p.id} class={`stackbar-seg${selected === p.id ? ' is-sel' : ''}${selected && selected !== p.id ? ' is-dim' : ''}`}
          style={{ flexGrow: mounted ? p.value / total : 0.0001, background: p.color, transitionDelay: `${i * 30}ms` }}
          onClick={() => { haptic(); onSelect?.(selected === p.id ? null : p.id) }} aria-label={p.id} />
      ))}
    </div>
  )
}
