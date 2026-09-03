import { db, type Expense, type ExpenseCategory } from '@/infra/db'
import { useLiveQuery } from '@/core/useLiveQuery'
import { dayKey, startOfDay } from '@/core/dates'
import { computed } from 'vue'

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  coffee: 'Кофе',
  food: 'Еда',
  clothes: 'Одежда',
  transport: 'Транспорт',
  health: 'Здоровье',
  other: 'Другое',
}

export interface LogExpenseInput {
  amount: number
  category: ExpenseCategory
  note?: string
  reflection: Expense['reflection']
}

export function useExpenses() {
  const all = useLiveQuery(() => db.expenses.orderBy('createdAt').reverse().toArray(), [] as Expense[])

  const today = computed(() => all.value.filter((e) => e.createdAt >= startOfDay()))
  const todayTotal = computed(() => today.value.reduce((sum, e) => sum + e.amount, 0))

  async function log(input: LogExpenseInput) {
    await db.expenses.add({ ...input, createdAt: Date.now() })
  }

  async function remove(id: number) {
    await db.expenses.delete(id)
  }

  function totalForDay(key: string) {
    return all.value.filter((e) => dayKey(e.createdAt) === key).reduce((s, e) => s + e.amount, 0)
  }

  return { all, today, todayTotal, log, remove, totalForDay }
}
