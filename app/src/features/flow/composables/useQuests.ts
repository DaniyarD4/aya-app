import { db, type QuestCompletion } from '@/infra/db'
import { useLiveQuery } from '@/core/useLiveQuery'
import { dayKey, weekKey } from '@/core/dates'
import { useExpenses } from './useExpenses'
import { computed, watch } from 'vue'

/**
 * Квесты — только про вовлечённость (отметил траты / поразмышлял / заглянул в итоги),
 * никогда про «не потратил» или сумму трат. Награда даётся за сам факт действия.
 */
type QuestPeriod = 'daily' | 'weekly'

interface QuestDef {
  key: string
  title: string
  description: string
  points: number
  period: QuestPeriod
}

export const QUEST_DEFS: QuestDef[] = [
  {
    key: 'log-expense',
    title: 'Отметь траты за сегодня',
    description: 'Запиши хотя бы одну трату — не важно, на что.',
    points: 10,
    period: 'daily',
  },
  {
    key: 'reflect-expense',
    title: 'Отметь, план это был или спонтанно',
    description: 'Без осуждения — оба варианта нормальны, это просто наблюдение за собой.',
    points: 10,
    period: 'daily',
  },
  {
    key: 'view-summary',
    title: 'Загляни в итоги недели',
    description: 'Просто посмотри — без выводов, если не хочешь их делать.',
    points: 20,
    period: 'weekly',
  },
]

function periodKeyFor(period: QuestPeriod): string {
  return period === 'daily' ? dayKey() : weekKey()
}

export function useQuests() {
  const { today, all: allExpenses } = useExpenses()
  const completions = useLiveQuery(() => db.questCompletions.toArray(), [] as QuestCompletion[])

  const totalPoints = computed(() => completions.value.reduce((s, c) => s + c.points, 0))
  const level = computed(() => 1 + Math.floor(totalPoints.value / 100))

  function isCompleted(def: QuestDef): boolean {
    const periodKey = periodKeyFor(def.period)
    return completions.value.some((c) => c.questKey === def.key && c.periodKey === periodKey)
  }

  async function award(def: QuestDef) {
    const periodKey = periodKeyFor(def.period)
    const already = completions.value.some((c) => c.questKey === def.key && c.periodKey === periodKey)
    if (already) return
    await db.questCompletions.add({
      questKey: def.key,
      periodKey,
      points: def.points,
      completedAt: Date.now(),
    })
  }

  /** Пересчитать derived-квесты (log-expense/reflect-expense) по фактическим данным сегодняшнего дня. */
  async function evaluateDerivedQuests() {
    const logDef = QUEST_DEFS.find((q) => q.key === 'log-expense')!
    if (today.value.length > 0) await award(logDef)

    const reflectDef = QUEST_DEFS.find((q) => q.key === 'reflect-expense')!
    if (today.value.some((e) => e.reflection !== null)) await award(reflectDef)
  }

  async function markSummaryViewed() {
    await award(QUEST_DEFS.find((q) => q.key === 'view-summary')!)
  }

  watch(allExpenses, () => evaluateDerivedQuests(), { immediate: true })

  const quests = computed(() =>
    QUEST_DEFS.map((def) => ({ ...def, done: isCompleted(def) })),
  )

  return { quests, totalPoints, level, markSummaryViewed }
}
