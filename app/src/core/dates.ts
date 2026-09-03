/** Общие хелперы дат — используются и в Rhythm (расчёт nextDueAt), и в Flow (ключи периодов). */

export function startOfDay(ts: number = Date.now()): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function addDays(ts: number, days: number): number {
  const d = new Date(ts)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b)
}

export function isOverdue(nextDueAt: number, now: number = Date.now()): boolean {
  return nextDueAt < startOfDay(now)
}

export function isDueToday(nextDueAt: number, now: number = Date.now()): boolean {
  return isSameDay(nextDueAt, now) || isOverdue(nextDueAt, now)
}

export function dayKey(ts: number = Date.now()): string {
  const d = new Date(ts)
  return d.toISOString().slice(0, 10)
}

/** Ключ недели вида 2026-W36, неделя начинается с понедельника (ISO). */
export function weekKey(ts: number = Date.now()): string {
  const d = new Date(startOfDay(ts))
  const day = (d.getDay() + 6) % 7 // 0 = понедельник
  d.setDate(d.getDate() - day + 3) // четверг этой недели
  const firstThursday = new Date(d.getFullYear(), 0, 4)
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7,
    )
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

export function parseTimeOfDay(timeOfDay: string, baseTs: number): number {
  const [h, m] = timeOfDay.split(':').map(Number)
  const d = new Date(baseTs)
  d.setHours(h || 0, m || 0, 0, 0)
  return d.getTime()
}

export function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
