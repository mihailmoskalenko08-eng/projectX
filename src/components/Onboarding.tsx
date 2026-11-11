// Первый запуск.

import { isIos, isStandalone } from '../lib/env'
import { haptic } from '../lib/haptic'
import { loadDemo, openSheet, setSettings } from '../state'
import { Icon } from './icons'

const POINTS: [string, string, string][] = [
  ['message', 'Траты из SMS', 'Оплатили картой — операция и остаток появились сами.'],
  ['tag', 'Категории сами', 'По коду магазина из SMS. Поправили один раз — запомнится.'],
  ['target', 'Бюджет и прогноз', 'Сколько можно тратить в день, чтобы дотянуть до конца месяца.'],
  ['shield', 'Только у вас', 'Данные хранятся на телефоне, работает без интернета.']
]

export function Onboarding() {
  const start = (sync: boolean) => {
    haptic()
    setSettings({ onboarded: true })
    if (sync) setTimeout(() => openSheet({ type: 'sync' }), 300)
  }
  const showInstall = isIos() && !isStandalone()
  return (
    <div class="onb">
      <img class="onb-icon" src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width={72} height={72} />
      <h1 class="onb-title">Копейка</h1>
      <p class="onb-lead">Учёт денег, который ведётся сам — из SMS вашего банка.</p>
      <ul class="onb-list">
        {POINTS.map(([icon, title, text]) => (
          <li key={title}>
            <Icon name={icon} size={20} />
            <div><b>{title}</b><span>{text}</span></div>
          </li>
        ))}
      </ul>
      <div class="onb-actions">
        <button class="btn btn-primary btn-block btn-big" onClick={() => start(true)}>Начать</button>
        <button class="btn btn-soft btn-block" onClick={() => { haptic(); loadDemo() }}>Посмотреть на примере</button>
        <button class="text-btn center" onClick={() => start(false)}>Настрою позже</button>
      </div>
      {showInstall && (
        <p class="onb-install">Чтобы «Копейка» открывалась как приложение: «Поделиться» → «На экран „Домой“».</p>
      )}
    </div>
  )
}
