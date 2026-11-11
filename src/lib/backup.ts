// Резервные копии и выгрузка в таблицу.

import { dayKey, timeLabel } from './dates'
import { baseAmount, txTitle, type Data } from './model'
import { sanitize } from './storage'

export function exportJson(d: Data): string {
  return JSON.stringify({ app: 'kopeyka', exportedAt: new Date().toISOString(), ...d }, null, 1)
}

export function importJson(text: string): Data {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Файл повреждён или это не копия «Копейки»')
  }
  return sanitize(raw)
}

const KIND_RU = { expense: 'Расход', income: 'Доход', transfer: 'Перевод', refund: 'Возврат' } as const

function cell(v: string | number): string {
  const s = String(v)
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/** CSV для Excel/Numbers: разделитель «;», десятичная запятая. */
export function exportCsv(d: Data): string {
  const head = ['Дата', 'Время', 'Тип', 'Сумма', 'Валюта', `Сумма, ${d.settings.base}`, 'Категория', 'Название', 'Счёт', 'Заметка', 'MCC', 'Город']
  const rows = [head.join(';')]
  for (const t of d.txs) {
    const cat = t.kind === 'transfer' ? 'Перевод' : d.categories.find(c => c.id === t.category)?.name ?? ''
    const acc = d.accounts.find(a => a.id === t.account)?.name ?? ''
    const sign = t.kind === 'expense' ? -1 : 1
    const money = (m: number) => (sign * m / 100).toFixed(2).replace('.', ',')
    rows.push([
      dayKey(t.at), timeLabel(t.at), KIND_RU[t.kind], money(t.amount), t.currency, money(baseAmount(t, d.settings)),
      cat, txTitle(t, d), acc, t.note ?? '', t.mcc ?? '', t.city ?? ''
    ].map(cell).join(';'))
  }
  return '﻿' + rows.join('\r\n')
}

export function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const file = new File([blob], name, { type })
  // На iPhone «Поделиться» удобнее: сразу в Файлы, Telegram, почту
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad/.test(navigator.userAgent)) {
    navigator.share({ files: [file], title: name }).catch(() => {})
    return
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.append(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000)
}
