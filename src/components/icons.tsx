// Собственный набор линейных иконок: 24×24, скруглённые концы, толщина линии задаётся в CSS.

import type { CSSProperties, JSX } from 'preact'

const P: Record<string, JSX.Element> = {
  // ——— категории ———
  cart: <><path d="M3 4h2.2l2.1 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6.1" /><circle cx="10" cy="19.5" r="1.4" /><circle cx="17" cy="19.5" r="1.4" /></>,
  coffee: <><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" /><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M8 3.5c-.6.8-.6 1.7 0 2.5M12 3.5c-.6.8-.6 1.7 0 2.5" /></>,
  bus: <><rect x="5" y="3" width="14" height="15" rx="3" /><path d="M5 11h14M8 21v-3M16 21v-3" /><circle cx="8.5" cy="14.5" r=".6" fill="currentColor" /><circle cx="15.5" cy="14.5" r=".6" fill="currentColor" /><path d="M9 6.5h6" /></>,
  taxi: <><path d="M5 16v-3.6a2 2 0 0 1 .3-1.1L7.3 8a2 2 0 0 1 1.7-1h6a2 2 0 0 1 1.7 1l2 3.3a2 2 0 0 1 .3 1.1V16" /><rect x="3.5" y="12" width="17" height="5.5" rx="2" /><path d="M6 17.5V20M18 17.5V20M10 4h4" /><circle cx="7.5" cy="14.7" r=".6" fill="currentColor" /><circle cx="16.5" cy="14.7" r=".6" fill="currentColor" /></>,
  fuel: <><path d="M5 20V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15M3.5 20h13" /><path d="M8 7h4" /><path d="M15 9.5h1.5A1.5 1.5 0 0 1 18 11v5a1.5 1.5 0 0 0 3 0V8.5L18.5 6" /></>,
  home: <><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" /><path d="M10 20.5v-5.5h4v5.5" /></>,
  bolt: <path d="M13 3 5.5 13.2h5.6L10.5 21 18 10.8h-5.6L13 3Z" />,
  wifi: <><path d="M3 9.5a13 13 0 0 1 18 0" /><path d="M6 12.8a8.5 8.5 0 0 1 12 0" /><path d="M9.2 16a4 4 0 0 1 5.6 0" /><circle cx="12" cy="19" r=".9" fill="currentColor" /></>,
  heart: <path d="M12 20s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.6 12 20 12 20Z" />,
  sparkle: <><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9-5.7-1.8L10.2 9 12 3.5Z" /><path d="M19 17v3M17.5 18.5h3" /></>,
  shirt: <path d="M8.5 4 4 6.5l1.8 4 2.2-1V20h8V9.5l2.2 1 1.8-4L15.5 4a3.5 3.5 0 0 1-7 0Z" />,
  bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></>,
  device: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></>,
  ticket: <><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4V7.5Z" /><path d="M14 6v12" stroke-dasharray="1.6 2" /></>,
  repeat: <><path d="M17 3.5 20 6.5l-3 3" /><path d="M4 11.5v-1a4 4 0 0 1 4-4h12" /><path d="M7 20.5l-3-3 3-3" /><path d="M20 12.5v1a4 4 0 0 1-4 4H4" /></>,
  plane: <path d="M10.5 13.5 4 12l-1-1.5 2-1 5.5 1L15 5.5a2.1 2.1 0 0 1 3 3L13.5 13l1 5.5-1 2-1.5-1-1.5-6Z" />,
  dumbbell: <><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" /></>,
  book: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" /></>,
  paw: <><circle cx="7" cy="10" r="1.7" /><circle cx="10.5" cy="6.5" r="1.7" /><circle cx="14.5" cy="6.5" r="1.7" /><circle cx="18" cy="10" r="1.7" /><path d="M12.5 12c-2.6 0-5 3.3-5 5.4 0 1.4 1.1 2.1 2.4 2.1.9 0 1.6-.4 2.6-.4s1.7.4 2.6.4c1.3 0 2.4-.7 2.4-2.1 0-2.1-2.4-5.4-5-5.4Z" /></>,
  gift: <><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12M12 8v13" /><path d="M12 8C9 8 7.5 6.8 7.5 5.4 7.5 3.4 10.5 3.6 12 8ZM12 8c3 0 4.5-1.2 4.5-2.6 0-2-3-1.8-4.5 2.6Z" /></>,
  send: <><path d="M20.5 3.5 10 14" /><path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z" /></>,
  receipt: <><path d="M6 3h12v18l-2.5-1.5L13 21l-2-1.5L8.5 21 6 19.5V3Z" /><path d="M9 8h6M9 11.5h6M9 15h3" /></>,
  dots: <><circle cx="6" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="18" cy="12" r="1.3" fill="currentColor" /></>,
  briefcase: <><rect x="3.5" y="7" width="17" height="13" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" /></>,
  rocket: <><path d="M12 15.5 8.5 12c1-4.5 4-8 9-8.5.5 5-3 8-7.5 9" /><path d="M8.5 12 5 11l2.5-3H11M12 15.5l1 3.5 3-2.5V13" /><path d="M6 16.5c-1 .5-1.5 2-1.5 3.5 1.5 0 3-.5 3.5-1.5" /><circle cx="14.5" cy="9" r="1.2" /></>,
  percent: <><path d="M19 5 5 19" /><circle cx="7" cy="7" r="2.2" /><circle cx="17" cy="17" r="2.2" /></>,
  download: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19.5h14" /></>,

  // ——— интерфейс ———
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  left: <path d="m14.5 5-7 7 7 7" />,
  right: <path d="m9.5 5 7 7-7 7" />,
  down: <path d="m5 9.5 7 7 7-7" />,
  up: <path d="m5 14.5 7-7 7 7" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M4 4l16 16" /><path d="M9.9 6A9.3 9.3 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.7 3.4M6.3 7.6A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.2-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  sync: <><path d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5" /><path d="M4 4v4.5h4.5" /><path d="M4 13a8 8 0 0 0 14.3 4.5L20 15.5" /><path d="M20 20v-4.5h-4.5" /></>,
  more: <><circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none" /></>,
  tabHome: <><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" /></>,
  list: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.8" cy="6.5" r="1.1" fill="currentColor" /><circle cx="4.8" cy="12" r="1.1" fill="currentColor" /><circle cx="4.8" cy="17.5" r="1.1" fill="currentColor" /></>,
  chart: <><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12V3.5Z" /><path d="M15 3.8A8.6 8.6 0 0 1 20.2 9H15V3.8Z" /></>,
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v3" /><rect x="4" y="8" width="16.5" height="12" rx="2.5" /><path d="M16 14h2" /></>,
  card: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M6.5 15h3" /></>,
  cash: <><rect x="2.5" y="6.5" width="19" height="11" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" /></>,
  savings: <><path d="M5 11.5a6.5 5.5 0 0 1 12.2-2.6L20 8.5l-.8 3.2a5.5 5.5 0 0 1-1.7 3.6V19h-3v-1.5h-4V19h-3v-3.2A5.4 5.4 0 0 1 5 11.5Z" /><path d="M10 6.5h4" /><circle cx="15.5" cy="10.5" r=".6" fill="currentColor" /></>,
  trash: <><path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-13" /><path d="M10 10.5v6M14 10.5v6" /></>,
  alert: <><path d="M12 4 2.8 19.5h18.4L12 4Z" /><path d="M12 10v4.5" /><circle cx="12" cy="17" r=".7" fill="currentColor" /></>,
  trendUp: <><path d="m3.5 17 6-6 4 4 7-7.5" /><path d="M15 7.5h5.5V13" /></>,
  trendDown: <><path d="m3.5 7 6 6 4-4 7 7.5" /><path d="M15 16.5h5.5V11" /></>,
  flame: <path d="M12 21c3.6 0 6.5-2.6 6.5-6.2 0-4.3-3.6-6.2-4.2-10.3-2 1.4-3.3 3.6-3.3 5.8-.9-.7-1.5-1.8-1.7-3C7.4 9 5.5 11.3 5.5 14.8 5.5 18.4 8.4 21 12 21Z" />,
  pie: <><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12V3.5Z" /></>,
  leaf: <><path d="M5 19c0-8 4.5-13.5 15-14-.5 10.5-6 15-14 15" /><path d="M5 19 13 11" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  copy: <><rect x="8.5" y="8.5" width="12" height="12" rx="2.5" /><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" /></>,
  message: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5v-8Z" /><path d="M8 9h8M8 12.5h5" /></>,
  cloud: <path d="M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9a4.8 4.8 0 0 1-.5 9.5H7Z" />,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  transfer: <><path d="M4 8h15.5M15.5 4l4 4-4 4" /><path d="M20 16H4.5M8.5 12l-4 4 4 4" /></>,
  edit: <><path d="M14.5 5.5l4 4L8.5 19.5H4.5v-4l10-10Z" /><path d="m12.5 7.5 4 4" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />,
  auto: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" /></>,
  upload: <><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M5 19.5h14" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r=".8" fill="currentColor" /></>,
  sparkles: <><path d="M10 4 11.6 8.4 16 10l-4.4 1.6L10 16l-1.6-4.4L4 10l4.4-1.6L10 4Z" /><path d="M17.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>,
  tag: <><path d="M3.5 12V4.5a1 1 0 0 1 1-1H12l8.5 8.5-8.5 8.5L3.5 12Z" /><circle cx="8" cy="8" r="1.3" /></>,
  palette: <><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.9.7-1.5 1.7-1.5h2.2a3.8 3.8 0 0 0 3.8-3.8c0-4.2-3.8-7.4-8.5-7.4Z" /><circle cx="7.8" cy="11" r="1.1" fill="currentColor" /><circle cx="10.5" cy="7.3" r="1.1" fill="currentColor" /><circle cx="15" cy="7.8" r="1.1" fill="currentColor" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5Z" /></>,
  phone: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 5h3" /></>,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5l1.5-2Z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  backspace: <><path d="M8.5 5.5H19A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H8.5L3 12l5.5-6.5Z" /><path d="m11.5 9.5 5 5M16.5 9.5l-5 5" /></>,
  note: <><path d="M5 4.5h14v10l-5 5H5v-15Z" /><path d="M14 19.5v-5h5M8.5 9h7M8.5 12.5h4" /></>,
  filter: <path d="M4 5h16l-6 7.5V19l-4-1.5v-5L4 5Z" />,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M14.8 9.2c-.5-.9-1.6-1.5-2.8-1.5-1.6 0-2.8.9-2.8 2.1 0 2.9 5.8 1.6 5.8 4.4 0 1.3-1.3 2.2-3 2.2-1.3 0-2.4-.6-2.9-1.6M12 6v1.7M12 16.4V18" /></>
}

export type IconName = keyof typeof P

export function Icon({ name, size = 22, class: cls, style }: { name: string; size?: number; class?: string; style?: CSSProperties }) {
  return (
    <svg class={`ico${cls ? ' ' + cls : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style={style}>
      {P[name] ?? P.dots}
    </svg>
  )
}

export const CATEGORY_ICONS = [
  'cart', 'coffee', 'bus', 'taxi', 'fuel', 'home', 'bolt', 'wifi', 'heart', 'sparkle', 'shirt', 'bag', 'device', 'ticket',
  'repeat', 'plane', 'dumbbell', 'book', 'paw', 'gift', 'send', 'receipt', 'briefcase', 'rocket', 'percent', 'download',
  'coin', 'target', 'tag', 'palette', 'globe', 'phone', 'note', 'dots'
]
