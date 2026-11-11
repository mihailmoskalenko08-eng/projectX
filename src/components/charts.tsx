// Графики на чистом SVG: кольцо категорий, кривая баланса, столбики по дням, сравнение месяцев.

import type { CSSProperties } from 'preact'
import { useEffect, useId, useState } from 'preact/hooks'
import { haptic } from '../lib/haptic'
import { formatShort } from '../lib/money'

/** Плавная кривая без «перелётов» (монотонная кубическая интерполяция). */
export function smoothPath(pts: [number, number][]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`
  const dx: number[] = [], m: number[] = [], t: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0])
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1))
  }
  t.push(m[0])
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2)
  t.push(m[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue }
    const a = t[i] / m[i], b = t[i + 1] / m[i]
    const s = a * a + b * b
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i] }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + t[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - t[i + 1] * h).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`
  }
  return d
}

function useMounted(): boolean {
  const [m, setM] = useState(false)
  useEffect(() => { const r = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(r) }, [])
  return m
}

// ——— Кольцо ———

export interface DonutPart {
  id: string
  value: number
  color: string
}

export function Donut({ parts, size = 220, thickness = 22, selected, onSelect, children }: {
  parts: DonutPart[]
  size?: number
  thickness?: number
  selected?: string | null
  onSelect?: (id: string | null) => void
  children?: preact.ComponentChildren
}) {
  const mounted = useMounted()
  const r = (size - thickness) / 2 - 6
  const c = 2 * Math.PI * r
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0)
  const gap = parts.length > 1 ? Math.min(10, c * 0.012) + thickness : 0
  let acc = 0
  return (
    <div class="donut" style={{ width: size + 'px', height: size + 'px' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" class="donut-track" stroke-width={thickness} />
        {total > 0 && parts.map((p, i) => {
          const len = (p.value / total) * c
          const visible = Math.max(0.001, len - gap)
          const offset = -acc
          acc += len
          const sel = selected === p.id
          const dim = selected && !sel
          return (
            <circle key={p.id} cx={size / 2} cy={size / 2} r={r} fill="none"
              class={`donut-seg${sel ? ' is-sel' : ''}${dim ? ' is-dim' : ''}`}
              stroke={p.color} stroke-width={sel ? thickness + 4 : thickness} stroke-linecap="round"
              stroke-dasharray={`${mounted ? visible : 0} ${c}`}
              stroke-dashoffset={offset - gap / 2}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transitionDelay: `${i * 45}ms` }}
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
  const W = 340
  const H = height
  if (values.length < 2) return <div style={{ height: H + 'px' }} />
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const pts: [number, number][] = values.map((v, i) => [(i / (values.length - 1)) * W, 6 + (1 - (v - min) / span) * (H - 16)])
  const line = smoothPath(pts)
  const area = `${line} L${W},${H} L0,${H} Z`
  const last = pts[pts.length - 1]
  return (
    <svg class={`area${cls ? ' ' + cls : ''}${mounted ? ' is-in' : ''}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} aria-hidden="true">
      <defs>
        <linearGradient id={`ag${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color={color} stop-opacity="0.16" />
          <stop offset="1" stop-color={color} stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#ag${id})`} class="area-fill" />
      <path d={line} fill="none" stroke={color} stroke-width="2" vector-effect="non-scaling-stroke" class="area-line" pathLength={1} />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} class="area-dot" vector-effect="non-scaling-stroke" />
    </svg>
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
  const nonZero = values.filter((v, i) => v > 0 && (today === undefined || i <= today))
  const avg = nonZero.length ? nonZero.reduce((a, b) => a + b, 0) / Math.max(1, today !== undefined ? today + 1 : values.length) : 0
  return (
    <div class="daybars">
      <div class="daybars-plot">
        {avg > 0 && <div class="daybars-avg" style={{ bottom: `${(avg / max) * 100}%` }}><span>≈ {formatShort(avg)} в день</span></div>}
        {values.map((v, i) => {
          const future = today !== undefined && i > today
          const h = v > 0 ? Math.max(4, (v / max) * 100) : 2
          return (
            <button key={i} class={`daybar${i === today ? ' is-today' : ''}${future ? ' is-future' : ''}${picked === i ? ' is-picked' : ''}`}
              style={{ '--h': mounted ? `${h}%` : '0%', '--d': `${i * 12}ms`, '--c': color } as CSSProperties}
              onClick={() => { if (future) return; haptic(); onPick?.(picked === i ? null : i) }}
              aria-label={labels ? labels(i) : String(i + 1)}>
              <span />
            </button>
          )
        })}
      </div>
      {labels && (
        <div class="daybars-axis">
          {values.map((_, i) => <span key={i}>{i === 0 || i === values.length - 1 || (i + 1) % 7 === 0 ? labels(i) : ''}</span>)}
        </div>
      )}
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
  const W = 340, H = 150, padT = 10, padB = 8
  const cur = current.slice(0, today + 1)
  const max = Math.max(1, ...cur, ...previous, budget ?? 0) * 1.05
  const x = (i: number) => (i / Math.max(1, total - 1)) * W
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB)
  const curPts = cur.map((v, i) => [x(i), y(v)] as [number, number])
  const prevPts = previous.slice(0, total).map((v, i) => [x(i), y(v)] as [number, number])
  const curLine = smoothPath(curPts)
  const last = curPts[curPts.length - 1]
  // Прогноз: продолжаем текущий темп пунктиром
  const rate = cur.length ? cur[cur.length - 1] / cur.length : 0
  const forecastEnd: [number, number] = [x(total - 1), y(rate * total)]
  return (
    <svg class={`pace${mounted ? ' is-in' : ''}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} aria-hidden="true">
      <defs>
        <linearGradient id={`pf${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="var(--accent)" stop-opacity=".12" />
          <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(f => <line key={f} x1="0" x2={W} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} class="grid" vector-effect="non-scaling-stroke" />)}
      {budget !== undefined && budget > 0 && (
        <line x1="0" x2={W} y1={y(budget)} y2={y(budget)} class="pace-budget" vector-effect="non-scaling-stroke" />
      )}
      {prevPts.length > 1 && <path d={smoothPath(prevPts)} class="pace-prev" fill="none" vector-effect="non-scaling-stroke" />}
      {last && today < total - 1 && <path d={`M${last[0]},${last[1]} L${forecastEnd[0]},${forecastEnd[1]}`} class="pace-forecast" fill="none" vector-effect="non-scaling-stroke" />}
      {curPts.length > 1 && <path d={`${curLine} L${last[0]},${H} L0,${H} Z`} fill={`url(#pf${id})`} class="pace-fill" />}
      {curPts.length > 1 && <path d={curLine} class="pace-cur" stroke="var(--accent)" fill="none" vector-effect="non-scaling-stroke" pathLength={1} />}
      {last && <circle cx={last[0]} cy={last[1]} r="4" class="pace-dot" vector-effect="non-scaling-stroke" />}
    </svg>
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
