// Общие элементы: шторка, уведомление, суммы, иконки категорий, переключатели.

import type { ComponentChildren, CSSProperties } from 'preact'
import { createContext } from 'preact'
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { haptic } from '../lib/haptic'
import { formatMoney, formatNumber, symbol } from '../lib/money'
import { data, hideToast, toast } from '../state'
import { Icon } from './icons'

// ——— Шторка ———

const SheetCtx = createContext<() => void>(() => {})
/** Закрыть текущую шторку с анимацией. */
export const useCloseSheet = () => useContext(SheetCtx)

export function Sheet({ onClosed, children, label, tall, depth = 0 }: {
  onClosed: () => void
  children: ComponentChildren
  label: string
  tall?: boolean
  depth?: number
}) {
  const panel = useRef<HTMLDivElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'enter' | 'open' | 'leave'>('enter')
  const drag = useRef<{ y: number; dy: number; t: number; active: boolean } | null>(null)

  useLayoutEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setState('open')))
    return () => cancelAnimationFrame(r)
  }, [])

  const close = () => {
    if (state === 'leave') return
    setState('leave')
    setTimeout(onClosed, 300)
  }

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    document.documentElement.classList.add('locked')
    requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }))
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => () => {
    // Последняя шторка закрылась — разблокировать прокрутку страницы
    setTimeout(() => { if (!document.querySelector('.sheet-wrap')) document.documentElement.classList.remove('locked') }, 0)
  }, [])

  // Клавиатура iPhone не меняет высоту окна — поднимаем шторку над ней
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const apply = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      wrap.current?.style.setProperty('--kb', `${kb}px`)
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => { vv.removeEventListener('resize', apply); vv.removeEventListener('scroll', apply) }
  }, [])

  const onStart = (e: TouchEvent) => {
    const el = panel.current
    if (!el || (e.target as HTMLElement).closest('input, textarea, .no-drag')) return
    drag.current = { y: e.touches[0].clientY, dy: 0, t: Date.now(), active: el.scrollTop <= 0 }
  }
  const onMove = (e: TouchEvent) => {
    const d = drag.current, el = panel.current
    if (!d || !el) return
    if (!d.active) {
      if (el.scrollTop <= 0) { d.active = true; d.y = e.touches[0].clientY }
      return
    }
    const dy = e.touches[0].clientY - d.y
    if (dy <= 0) { d.dy = 0; el.style.transform = ''; return }
    if (e.cancelable) e.preventDefault()
    d.dy = dy
    el.style.transition = 'none'
    el.style.transform = `translateY(${dy < 0 ? 0 : dy}px)`
  }
  const onEnd = () => {
    const d = drag.current, el = panel.current
    drag.current = null
    if (!d || !el) return
    el.style.transition = ''
    el.style.transform = ''
    const v = d.dy / Math.max(1, Date.now() - d.t)
    if (d.dy > 120 || (d.dy > 40 && v > 0.6)) close()
  }

  return (
    <SheetCtx.Provider value={close}>
      <div class={`sheet-wrap is-${state}`} ref={wrap} style={{ zIndex: 50 + depth * 2 }}>
        <div class="sheet-backdrop" onClick={close} />
        <div class={`sheet${tall ? ' sheet-tall' : ''}`} ref={panel} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
          onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}>
          <div class="sheet-grip" aria-hidden="true" />
          {children}
        </div>
      </div>
    </SheetCtx.Provider>
  )
}

export function SheetHeader({ title, sub, right }: { title: string; sub?: string; right?: ComponentChildren }) {
  const close = useCloseSheet()
  return (
    <div class="sheet-head">
      <div class="sheet-head-text">
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {right}
      <button class="icon-btn" onClick={close} aria-label="Закрыть"><Icon name="close" size={20} /></button>
    </div>
  )
}

// ——— Уведомление ———

export function ToastHost() {
  const t = toast.value
  const [shown, setShown] = useState(t)
  useEffect(() => { if (t) setShown(t) }, [t])
  return (
    <div class={`toast${t ? ' is-on' : ''}${shown?.tone ? ' tone-' + shown.tone : ''}`} role="status" aria-live="polite">
      {shown && <>
        <span class="toast-dot" />
        <span class="toast-text">{shown.text}</span>
        {shown.action && <button class="toast-action" onClick={() => { haptic(); shown.action!.run() }}>{shown.action.label}</button>}
        <button class="toast-close" onClick={hideToast} aria-label="Скрыть"><Icon name="close" size={16} /></button>
      </>}
    </div>
  )
}

// ——— Суммы ———

/** Сумма с крупными рублями и мелкими копейками. hideable — размывается в режиме «скрыть суммы». */
export function Money({ value, cur, sign, class: cls, hideable = true, cents = 'auto', big }: {
  value: number
  cur?: string
  sign?: boolean
  class?: string
  hideable?: boolean
  cents?: 'auto' | 'always' | 'never'
  big?: boolean
}) {
  const c = cur ?? data.value.settings.base
  const hidden = hideable && data.value.settings.hide
  if (!big) {
    return <span class={`money${hidden ? ' is-hidden' : ''}${cls ? ' ' + cls : ''}`}>{formatMoney(value, c, { sign, cents })}</span>
  }
  const n = formatNumber(value, { cents: 'always' })
  const [whole, frac] = n.split(',')
  const sym = symbol(c)
  return (
    <span class={`money money-big${hidden ? ' is-hidden' : ''}${cls ? ' ' + cls : ''}`}>
      {sign && value > 0 ? '+' : ''}{whole}<span class="money-frac">,{frac}</span><span class="money-cur">{sym}</span>
    </span>
  )
}

/** Число, которое плавно «добегает» до нового значения. */
export function CountUp({ value, cur, big = true, class: cls }: { value: number; cur?: string; big?: boolean; class?: string }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const raf = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    const b = value
    if (a === b) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const dur = reduce ? 0 : Math.min(1100, 450 + Math.log10(Math.abs(b - a) + 1) * 120)
    cancelAnimationFrame(raf.current)
    const step = (now: number) => {
      const t = dur ? Math.min(1, (now - start) / dur) : 1
      const e = 1 - Math.pow(1 - t, 4)
      const v = Math.round(a + (b - a) * e)
      setShown(v)
      from.current = v
      if (t < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [value])
  return <Money value={shown} cur={cur} big={big} class={cls} />
}

// ——— Категории ———

export function CatIcon({ icon, color, size = 40, glyph }: { icon: string; color: string; size?: number; glyph?: number }) {
  return (
    <span class="cat-icon" style={{ '--c': color, width: size + 'px', height: size + 'px', borderRadius: Math.round(size * 0.32) + 'px' } as CSSProperties}>
      <Icon name={icon} size={glyph ?? Math.round(size * 0.52)} />
    </span>
  )
}

// ——— Переключатели ———

export function Segmented<T extends string>({ value, options, onChange, small }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  small?: boolean
}) {
  const i = Math.max(0, options.findIndex(o => o.value === value))
  return (
    <div class={`seg${small ? ' seg-sm' : ''}`} role="tablist" style={{ '--n': options.length, '--i': i } as CSSProperties}>
      <span class="seg-thumb" aria-hidden="true" />
      {options.map(o => (
        <button key={o.value} role="tab" aria-selected={o.value === value} class={o.value === value ? 'is-on' : ''}
          onClick={() => { if (o.value !== value) { haptic(); onChange(o.value) } }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button class={`switch${on ? ' is-on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => { haptic(); onChange(!on) }}>
      <span class="switch-knob" />
    </button>
  )
}

export function Row({ icon, color, title, sub, right, onClick, danger, chevron = true }: {
  icon?: string
  color?: string
  title: ComponentChildren
  sub?: ComponentChildren
  right?: ComponentChildren
  onClick?: () => void
  danger?: boolean
  chevron?: boolean
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag class={`row${danger ? ' row-danger' : ''}${onClick ? ' row-btn' : ''}`} onClick={onClick ? () => { haptic(); onClick() } : undefined}>
      {icon && (color ? <CatIcon icon={icon} color={color} size={34} /> : <span class="row-ico"><Icon name={icon} size={21} /></span>)}
      <span class="row-main">
        <span class="row-title">{title}</span>
        {sub && <span class="row-sub">{sub}</span>}
      </span>
      {right !== undefined && <span class="row-right">{right}</span>}
      {onClick && chevron && <Icon name="right" size={16} class="row-chev" />}
    </Tag>
  )
}

export function Empty({ icon, title, text, children }: { icon: string; title: string; text?: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <div class="empty-orb"><Icon name={icon} size={30} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}

export function ProgressBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const p = max > 0 ? Math.min(1, value / max) : 0
  const over = value > max
  return (
    <div class={`bar${over ? ' is-over' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${p * 100}%`, '--c': color } as CSSProperties} />
    </div>
  )
}

/** Копирование текста с подтверждением галочкой. */
export function CopyField({ value, label, mono = true }: { value: string; label?: string; mono?: boolean }) {
  const [ok, setOk] = useState(false)
  const copy = async () => {
    haptic()
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.append(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setOk(true)
    setTimeout(() => setOk(false), 1600)
  }
  return (
    <div class="copy-field">
      {label && <span class="copy-label">{label}</span>}
      <button class={`copy-box${ok ? ' is-ok' : ''}`} onClick={copy}>
        <code class={mono ? 'mono' : ''}>{value}</code>
        <span class="copy-ico"><Icon name={ok ? 'check' : 'copy'} size={18} /></span>
      </button>
    </div>
  )
}
