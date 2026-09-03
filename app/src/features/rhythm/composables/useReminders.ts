import { db, type Reminder, type ReminderCategory, type ReminderType } from '@/infra/db'
import { addDays, isDueToday, isOverdue, parseTimeOfDay, startOfDay } from '@/core/dates'
import { useLiveQuery } from '@/core/useLiveQuery'
import { computed } from 'vue'

export const CATEGORY_LABEL: Record<ReminderCategory, string> = {
  purchase: 'Покупки',
  cooking: 'Готовка',
  dishes: 'Посуда',
  medicine: 'Лекарства',
  vitamins: 'Витамины',
  gym: 'Спортзал',
  custom: 'Своё',
}

/** Ближайшая дата выполнения для нового/пересозданного напоминания. */
function computeInitialDueAt(input: Pick<Reminder, 'type' | 'intervalDays' | 'weeklyDays' | 'timeOfDay'>): number {
  const now = Date.now()
  if (input.type === 'interval') {
    return parseTimeOfDay(input.timeOfDay, now)
  }
  // weekly: ближайший из выбранных дней недели (включая сегодня, если время ещё не прошло)
  const days = input.weeklyDays ?? []
  if (days.length === 0) return parseTimeOfDay(input.timeOfDay, now)
  for (let offset = 0; offset < 8; offset++) {
    const candidateBase = addDays(now, offset)
    const candidateDow = new Date(candidateBase).getDay()
    if (days.includes(candidateDow)) {
      const dueAt = parseTimeOfDay(input.timeOfDay, candidateBase)
      if (dueAt >= now - 60_000) return dueAt
    }
  }
  return parseTimeOfDay(input.timeOfDay, now)
}

/** Следующая дата после отметки «сделано» сегодня. */
function computeNextDueAfterCompletion(reminder: Reminder, completedAt: number): number {
  if (reminder.type === 'interval') {
    return parseTimeOfDay(reminder.timeOfDay, addDays(completedAt, reminder.intervalDays ?? 1))
  }
  const days = reminder.weeklyDays ?? []
  if (days.length === 0) return parseTimeOfDay(reminder.timeOfDay, addDays(completedAt, 7))
  for (let offset = 1; offset < 8; offset++) {
    const candidateBase = addDays(completedAt, offset)
    if (days.includes(new Date(candidateBase).getDay())) {
      return parseTimeOfDay(reminder.timeOfDay, candidateBase)
    }
  }
  return parseTimeOfDay(reminder.timeOfDay, addDays(completedAt, 7))
}

export interface CreateReminderInput {
  title: string
  category: ReminderCategory
  type: ReminderType
  intervalDays?: number
  weeklyDays?: number[]
  timeOfDay: string
}

export function useReminders() {
  const all = useLiveQuery(
    () => db.reminders.orderBy('nextDueAt').filter((r) => !r.archived).toArray(),
    [] as Reminder[],
  )

  const dueToday = computed(() => all.value.filter((r) => isDueToday(r.nextDueAt)))
  const overdue = computed(() => all.value.filter((r) => isOverdue(r.nextDueAt)))
  const upcoming = computed(() => all.value.filter((r) => !isDueToday(r.nextDueAt)))

  async function create(input: CreateReminderInput) {
    const nextDueAt = computeInitialDueAt(input)
    await db.reminders.add({
      ...input,
      lastCompletedAt: null,
      nextDueAt,
      streak: 0,
      archived: false,
      createdAt: Date.now(),
    })
  }

  async function complete(id: number) {
    const reminder = await db.reminders.get(id)
    if (!reminder) return
    const now = Date.now()
    const wasOnTime = !isOverdue(reminder.nextDueAt, now) || isDueToday(reminder.nextDueAt, now)
    await db.reminders.update(id, {
      lastCompletedAt: now,
      nextDueAt: computeNextDueAfterCompletion(reminder, now),
      streak: wasOnTime ? reminder.streak + 1 : 1,
    })
  }

  /** Отложить на сутки — не трогает стрик, просто сдвигает дедлайн. */
  async function snooze(id: number) {
    const reminder = await db.reminders.get(id)
    if (!reminder) return
    await db.reminders.update(id, {
      nextDueAt: parseTimeOfDay(reminder.timeOfDay, addDays(startOfDay(), 1)),
    })
  }

  /** Пропустить сегодня без чувства вины — просто пересчитать следующий цикл, стрик сбрасывается тихо, без предупреждений. */
  async function skipToday(id: number) {
    const reminder = await db.reminders.get(id)
    if (!reminder) return
    await db.reminders.update(id, {
      nextDueAt: computeNextDueAfterCompletion(reminder, Date.now()),
      streak: 0,
    })
  }

  async function archive(id: number) {
    await db.reminders.update(id, { archived: true })
  }

  return { all, dueToday, overdue, upcoming, create, complete, snooze, skipToday, archive }
}
