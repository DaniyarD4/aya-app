import Dexie, { type EntityTable } from 'dexie'

/**
 * Rhythm — бытовые напоминания.
 * Два движка повторения (interval / weekly) покрывают все сценарии MVP:
 * покупки и лекарства — interval, витамины — interval:1 (ежедневно),
 * спортзал — weekly. Плюс checklist — разовый чек-лист без авто-повтора
 * (сезонная подготовка, пересоздаётся вручную).
 */
export type ReminderCategory =
  | 'purchase'
  | 'cooking'
  | 'dishes'
  | 'medicine'
  | 'vitamins'
  | 'gym'
  | 'custom'

export type ReminderType = 'interval' | 'weekly'

export interface Reminder {
  id?: number
  title: string
  category: ReminderCategory
  type: ReminderType
  /** для type: 'interval' — раз в N дней */
  intervalDays?: number
  /** для type: 'weekly' — дни недели, 0=вс..6=сб */
  weeklyDays?: number[]
  /** время дня в формате HH:mm, используется для отображения/сортировки */
  timeOfDay: string
  lastCompletedAt: number | null
  nextDueAt: number
  streak: number
  archived: boolean
  createdAt: number
}

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

export interface Checklist {
  id?: number
  title: string
  items: ChecklistItem[]
  archived: boolean
  createdAt: number
}

export type ExpenseCategory = 'coffee' | 'food' | 'clothes' | 'transport' | 'health' | 'other'

export interface Expense {
  id?: number
  amount: number
  category: ExpenseCategory
  note?: string
  /** осознанность без осуждения: план/спонтанно/не отмечено — оба варианта равноценны */
  reflection: 'planned' | 'spontaneous' | null
  createdAt: number
}

export interface QuestCompletion {
  id?: number
  questKey: string
  /** ключ периода, к которому относится квест: YYYY-MM-DD для daily, YYYY-Www для weekly */
  periodKey: string
  points: number
  completedAt: number
}

export const db = new Dexie('aya') as Dexie & {
  reminders: EntityTable<Reminder, 'id'>
  checklists: EntityTable<Checklist, 'id'>
  expenses: EntityTable<Expense, 'id'>
  questCompletions: EntityTable<QuestCompletion, 'id'>
}

db.version(1).stores({
  reminders: '++id, category, type, nextDueAt, archived',
  checklists: '++id, archived, createdAt',
  expenses: '++id, category, createdAt',
  questCompletions: '++id, questKey, periodKey',
})
