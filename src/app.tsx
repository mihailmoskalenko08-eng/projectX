// Каркас: экраны, нижняя панель с кнопкой «+», стопка шторок, уведомления.

import type { ComponentChildren } from 'preact'
import { useEffect } from 'preact/hooks'
import { haptic } from './lib/haptic'
import { closeSheet, data, openSheet, sheets, tab, type SheetState, type Tab } from './state'
import { AddSheet } from './components/AddSheet'
import { Home } from './components/Home'
import { Icon } from './components/icons'
import { More } from './components/More'
import { Onboarding } from './components/Onboarding'
import { Ops } from './components/Ops'
import {
  AccountSheet, BudgetsSheet, CategoriesSheet, CategorySheet, EditCategorySheet, MerchantSheet, PasteSheet,
  PendingSheet, RatesSheet, RecurringSheet
} from './components/Sheets'
import { Stats } from './components/Stats'
import { SyncSheet } from './components/SyncSheet'
import { TxSheet } from './components/TxSheet'
import { Sheet, ToastHost } from './components/ui'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Главная', icon: 'tabHome' },
  { id: 'ops', label: 'Операции', icon: 'list' },
  { id: 'stats', label: 'Аналитика', icon: 'chart' },
  { id: 'more', label: 'Ещё', icon: 'more' }
]

function TabBar() {
  const cur = tab.value
  const go = (t: Tab) => {
    haptic()
    if (t === cur) window.scrollTo({ top: 0, behavior: 'smooth' })
    tab.value = t
  }
  const left = TABS.slice(0, 2), right = TABS.slice(2)
  const btn = (t: typeof TABS[number]) => (
    <button key={t.id} class={`tab${cur === t.id ? ' is-on' : ''}`} onClick={() => go(t.id)} aria-current={cur === t.id ? 'page' : undefined}>
      <Icon name={t.icon} size={23} />
      <span>{t.label}</span>
    </button>
  )
  return (
    <nav class="tabbar" aria-label="Разделы">
      {left.map(btn)}
      <button class="fab" onClick={() => { haptic(); openSheet({ type: 'add' }) }} aria-label="Добавить операцию">
        <Icon name="plus" size={26} />
      </button>
      {right.map(btn)}
    </nav>
  )
}

function sheetBody(s: SheetState): { body: ComponentChildren; label: string; tall?: boolean } {
  switch (s.type) {
    case 'add': return { body: <AddSheet kind={s.kind} category={s.category} account={s.account} editId={s.editId} />, label: 'Новая операция' }
    case 'tx': return { body: <TxSheet id={s.id} />, label: 'Операция' }
    case 'category': return { body: <CategorySheet id={s.id} offset={s.offset} />, label: 'Категория', tall: true }
    case 'sync': return { body: <SyncSheet />, label: 'Траты из SMS', tall: true }
    case 'paste': return { body: <PasteSheet />, label: 'Вставить SMS' }
    case 'account': return { body: <AccountSheet id={s.id} />, label: 'Счёт' }
    case 'accounts': return { body: <More />, label: 'Счета' }
    case 'budgets': return { body: <BudgetsSheet />, label: 'Бюджеты', tall: true }
    case 'categories': return { body: <CategoriesSheet />, label: 'Категории', tall: true }
    case 'editCategory': return { body: <EditCategorySheet id={s.id} kind={s.kind} />, label: 'Категория' }
    case 'pending': return { body: <PendingSheet />, label: 'SMS на разбор' }
    case 'rates': return { body: <RatesSheet />, label: 'Курсы валют' }
    case 'merchant': return { body: <MerchantSheet k={s.key} />, label: 'Магазин', tall: true }
    case 'recurring': return { body: <RecurringSheet />, label: 'Регулярные платежи' }
  }
}

export function App() {
  const d = data.value
  const t = tab.value

  // Смена вкладки — наверх
  useEffect(() => { window.scrollTo({ top: 0 }) }, [t])

  if (!d.settings.onboarded) {
    return (
      <>
        <Onboarding />
        {sheets.value.map((s, i) => { const x = sheetBody(s); return <Sheet key={i + s.type} depth={i} label={x.label} tall={x.tall} onClosed={closeSheet}>{x.body}</Sheet> })}
        <ToastHost />
      </>
    )
  }

  return (
    <>
      <main class="app" key={t}>
        {t === 'home' && <Home />}
        {t === 'ops' && <Ops />}
        {t === 'stats' && <Stats />}
        {t === 'more' && <More />}
      </main>
      <TabBar />
      {sheets.value.map((s, i) => {
        const x = sheetBody(s)
        return <Sheet key={i + s.type} depth={i} label={x.label} tall={x.tall} onClosed={closeSheet}>{x.body}</Sheet>
      })}
      <ToastHost />
    </>
  )
}
