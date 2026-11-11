// Лёгкий отклик вибрацией. Android — Vibration API; iPhone (iOS 18+) даёт тактильный отклик
// при переключении системного <input type="checkbox" switch> — держим такой невидимым.

let label: HTMLLabelElement | null = null

function ensure(): HTMLLabelElement | null {
  if (label || typeof document === 'undefined') return label
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.id = 'kp-haptic'
  input.tabIndex = -1
  input.setAttribute('aria-hidden', 'true')
  label = document.createElement('label')
  label.htmlFor = input.id
  label.setAttribute('aria-hidden', 'true')
  const box = document.createElement('div')
  box.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9px;top:-9px'
  box.append(input, label)
  document.body.append(box)
  return label
}

export function haptic() {
  try {
    if (typeof navigator.vibrate === 'function' && !/iPhone|iPad/.test(navigator.userAgent)) {
      navigator.vibrate(8)
      return
    }
    ensure()?.click()
  } catch {
    /* без отклика тоже работает */
  }
}
