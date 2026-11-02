/** 日期与时间工具，全部使用本地时区，避免跨时区导致的执行日期错位。 */

export const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

export function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayDate(): string {
  return formatDate(new Date())
}

/** 将 YYYY-MM-DD 解析为本地零点，避免 new Date('YYYY-MM-DD') 的 UTC 偏差。 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function isDateString(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDate(value).getTime())
}

export function isTimeString(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-9]{2}$/.test(value)
}

export function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

export function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`
}

/** 将日期字符串与 HH:mm 组合成毫秒时间戳 */
export function combineDateTime(dateStr: string, timeStr: string): number {
  const date = parseDate(dateStr)
  const [hour, minute] = timeStr.split(':').map(Number)
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour,
    minute,
    0,
    0
  ).getTime()
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function addDaysToDateString(dateStr: string, amount: number): string {
  return formatDate(addDays(parseDate(dateStr), amount))
}

export function getWeekday(dateStr: string): number {
  return parseDate(dateStr).getDay()
}

/** 返回给定日期所在周（周一开始）的 7 个日期 */
export function getWeekDates(reference: Date = new Date()): string[] {
  const current = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  const offset = (current.getDay() + 6) % 7
  const monday = addDays(current, -offset)
  return Array.from({ length: 7 }, (_, index) => formatDate(addDays(monday, index)))
}

/** 日期字符串相减的天数（b - a） */
export function diffDays(a: string, b: string): number {
  const first = parseDate(a).getTime()
  const second = parseDate(b).getTime()
  return Math.round((second - first) / 86_400_000)
}

export function formatClock(timestamp: number): string {
  const date = new Date(timestamp)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${formatDate(date)} ${formatClock(timestamp)}`
}

export function formatMonthDay(dateStr: string): string {
  const date = parseDate(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

/** 将倒计时毫秒格式化为 HH:MM:SS（超过 24 小时也能显示） */
export function formatCountdown(milliseconds: number): string {
  const safe = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}
