// MCC — код типа торговой точки, который банк присылает в SMS. По нему определяем категорию.

type Range = [number, number, string]

const RANGES: Range[] = [
  // Путешествия: авиакомпании, отели, аренда авто
  [3000, 3350, 'travel'],
  [3351, 3500, 'travel'],
  [3501, 3999, 'travel'],
  [4511, 4511, 'travel'],
  [4582, 4582, 'travel'],
  [4722, 4723, 'travel'],
  [4411, 4411, 'travel'],
  [7011, 7012, 'travel'],
  [7033, 7033, 'travel'],
  [7512, 7519, 'travel'],
  [4112, 4112, 'travel'], // поезда дальнего следования

  // Транспорт
  [4011, 4011, 'transport'],
  [4111, 4111, 'transport'],
  [4131, 4131, 'transport'],
  [4784, 4784, 'auto'], // платные дороги
  [4789, 4789, 'transport'],
  [4121, 4121, 'taxi'],

  // Авто
  [5511, 5599, 'auto'],
  [5531, 5533, 'auto'],
  [5541, 5542, 'auto'],
  [5983, 5983, 'auto'],
  [7523, 7523, 'auto'],
  [7531, 7549, 'auto'],

  // Связь, коммуналка
  [4812, 4816, 'telecom'],
  [4821, 4821, 'telecom'],
  [4899, 4899, 'telecom'],
  [4900, 4900, 'utilities'],

  // Продукты
  [5300, 5300, 'food'],
  [5411, 5411, 'food'],
  [5422, 5422, 'food'],
  [5441, 5441, 'food'],
  [5451, 5451, 'food'],
  [5462, 5462, 'food'],
  [5499, 5499, 'food'],
  [5921, 5921, 'food'],

  // Кафе
  [5811, 5814, 'cafe'],

  // Цифровые товары и подписки
  [5815, 5815, 'subs'],
  [5816, 5816, 'fun'],
  [5817, 5818, 'subs'],
  [4816, 4816, 'telecom'],

  // Одежда и обувь
  [5137, 5139, 'clothes'],
  [5611, 5699, 'clothes'],
  [5931, 5931, 'clothes'],
  [5948, 5948, 'clothes'],
  [7251, 7251, 'clothes'],

  // Дом и ремонт
  [1520, 1799, 'home'],
  [5021, 5021, 'home'],
  [5039, 5039, 'home'],
  [5200, 5200, 'home'],
  [5211, 5271, 'home'],
  [5712, 5719, 'home'],
  [5722, 5722, 'tech'],
  [5950, 5950, 'home'],
  [7210, 7217, 'home'],
  [7342, 7342, 'home'],

  // Техника
  [5044, 5045, 'tech'],
  [5732, 5734, 'tech'],
  [5946, 5946, 'tech'],
  [7372, 7372, 'subs'],
  [7379, 7379, 'tech'],
  [7622, 7623, 'tech'],

  // Здоровье
  [5047, 5047, 'health'],
  [5122, 5122, 'health'],
  [5912, 5912, 'health'],
  [5975, 5976, 'health'],
  [8011, 8099, 'health'],
  [4119, 4119, 'health'],

  // Красота
  [5977, 5977, 'beauty'],
  [7230, 7230, 'beauty'],
  [7297, 7298, 'beauty'],

  // Покупки
  [5262, 5262, 'shopping'],
  [5309, 5311, 'shopping'],
  [5331, 5331, 'shopping'],
  [5399, 5399, 'shopping'],
  [5964, 5969, 'shopping'],
  [5940, 5940, 'sport'],
  [5941, 5941, 'sport'],
  [5942, 5943, 'edu'],
  [5944, 5944, 'gifts'],
  [5945, 5945, 'gifts'],
  [5947, 5947, 'gifts'],
  [5992, 5992, 'gifts'],
  [5993, 5993, 'shopping'],
  [5994, 5994, 'edu'],
  [5995, 5995, 'pets'],
  [5999, 5999, 'shopping'],

  // Развлечения
  [5735, 5735, 'fun'],
  [7829, 7841, 'fun'],
  [7911, 7933, 'fun'],
  [7991, 7996, 'fun'],
  [7998, 7999, 'fun'],
  [7994, 7994, 'fun'],
  [7832, 7832, 'fun'],

  // Спорт
  [7941, 7941, 'sport'],
  [7997, 7997, 'sport'],

  // Образование
  [8211, 8299, 'edu'],

  // Питомцы
  [742, 742, 'pets'],

  // Подарки и благотворительность
  [8398, 8398, 'gifts'],
  [8661, 8661, 'gifts'],

  // Налоги, госуслуги, финансы
  [9211, 9405, 'fees'],
  [6300, 6399, 'fees'],
  [6540, 6540, 'transfers'],
  [6012, 6012, 'transfers'],
  [6050, 6051, 'transfers'],
  [4829, 4829, 'transfers'],
  [6536, 6538, 'transfers']
]

/** Снятие наличных — это не расход, а перевод с карты в кошелёк. */
export const CASH_MCC = new Set([6010, 6011])

const EXACT = new Map<number, string>()
for (const [a, b, c] of RANGES) {
  // Точные коды (a === b) приоритетнее диапазонов
  if (a === b) EXACT.set(a, c)
}

export function categoryForMcc(mcc: number | undefined): string | null {
  if (mcc === undefined || !Number.isFinite(mcc)) return null
  const exact = EXACT.get(mcc)
  if (exact) return exact
  for (const [a, b, c] of RANGES) if (mcc >= a && mcc <= b) return c
  return null
}

/** Категория по названию магазина, если MCC нет или он слишком общий. */
const BY_NAME: [RegExp, string][] = [
  [/PAYBYCARD|TRANSPORT|METRO|MINSKTRANS|AVTOBUS/, 'transport'],
  [/YANDEX\s*\.?\s*(GO|TAXI)|UBER|BOLT|TAXI/, 'taxi'],
  [/YANDEX\s*\.?\s*(EDA|EATS)|DELIVERY|WOLT|GLOVO/, 'cafe'],
  [/EVROOPT|EUROOPT|HIT\s*!?\s*DISK|GRIN|GREEN|SANTA|KORONA|GIPPO|ALMI|SOSEDI|DOBROTSEN|BELMARKET|VIKTORIYA|RODNAYA STORONA/, 'food'],
  [/MCDONALDS|MAK\.?BY|KFC|BURGER|STARBUCKS|COFFEE|KOFE|CAFE|KAFE|PIZZA|SUSHI|DODO/, 'cafe'],
  [/APTEKA|PHARM|BELFARM/, 'health'],
  [/WILDBERRIES|OZON|ALIEXPRESS|21VEK|ONLINER|LAMODA/, 'shopping'],
  [/APPLE\.COM|ITUNES|SPOTIFY|NETFLIX|YOUTUBE|YANDEX\s*\.?\s*PLUS|ICLOUD|CHATGPT|OPENAI|ANTHROPIC|CLAUDE/, 'subs'],
  [/\bA1\b|VELCOM|\bMTS\b|\bLIFE\b|BELTELECOM|BYFLY/, 'telecom'],
  [/AZS|BELORUSNEFT|BELNEFT|LUKOIL|GAZPROMNEFT/, 'auto'],
  [/OSTROV|MILE\b|OMA\b|BAUCENTER|MASTERDOM/, 'home'],
  [/ZOO/, 'pets']
]

export function categoryForName(merchant: string | undefined): string | null {
  if (!merchant) return null
  const up = merchant.toUpperCase()
  for (const [re, c] of BY_NAME) if (re.test(up)) return c
  return null
}

/** Подпись к MCC для подробностей операции. */
export function mccLabel(mcc: number): string {
  const known: Record<number, string> = {
    4111: 'Пассажирские перевозки', 4121: 'Такси', 4814: 'Связь', 4900: 'Коммунальные услуги',
    5411: 'Супермаркеты', 5499: 'Продуктовые магазины', 5812: 'Рестораны', 5814: 'Фастфуд',
    5912: 'Аптеки', 5541: 'АЗС', 5542: 'АЗС (автомат)', 5311: 'Универмаги', 5399: 'Товары',
    5732: 'Электроника', 5651: 'Одежда', 5691: 'Одежда', 5699: 'Одежда и аксессуары',
    5815: 'Цифровые товары', 5816: 'Игры', 5817: 'Приложения', 5818: 'Цифровые товары',
    6010: 'Выдача наличных', 6011: 'Банкомат', 6012: 'Финансовые услуги', 4829: 'Денежные переводы',
    7832: 'Кинотеатры', 7997: 'Фитнес и клубы', 8099: 'Медицинские услуги', 9399: 'Госуслуги'
  }
  return known[mcc] ?? `Код ${mcc}`
}
