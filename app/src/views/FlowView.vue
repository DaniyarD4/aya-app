<script setup lang="ts">
import { ref, computed } from 'vue'
import { useExpenses } from '@/features/flow/composables/useExpenses'
import { useQuests } from '@/features/flow/composables/useQuests'
import { EXPENSE_CATEGORY_LABEL } from '@/features/flow/composables/useExpenses'
import { weekKey, formatShortDate } from '@/core/dates'
import PageHeader from '@/design-system/PageHeader.vue'
import AppCard from '@/design-system/AppCard.vue'
import AppButton from '@/design-system/AppButton.vue'
import AppChip from '@/design-system/AppChip.vue'
import EmptyState from '@/design-system/EmptyState.vue'
import BottomSheet from '@/design-system/BottomSheet.vue'
import ExpenseForm from '@/features/flow/components/ExpenseForm.vue'
import type { LogExpenseInput } from '@/features/flow/composables/useExpenses'

const { today, todayTotal, all, log, remove } = useExpenses()
const { quests, totalPoints, level, markSummaryViewed } = useQuests()

const formOpen = ref(false)
const summaryOpen = ref(false)

async function handleSubmit(input: LogExpenseInput) {
  await log(input)
  formOpen.value = false
}

const weekExpenses = computed(() => all.value.filter((e) => weekKey(e.createdAt) === weekKey()))
const weekTotal = computed(() => weekExpenses.value.reduce((s, e) => s + e.amount, 0))
const weekByCategory = computed(() => {
  const map = new Map<string, number>()
  for (const e of weekExpenses.value) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
  return [...map.entries()].sort((a, b) => b[1] - a[1])
})

function openSummary() {
  summaryOpen.value = !summaryOpen.value
  if (summaryOpen.value) markSummaryViewed()
}
</script>

<template>
  <PageHeader title="Финансы" subtitle="Никаких лимитов — только осознанность и награда за внимание к себе" />

  <section class="px-5">
    <AppCard class="flex items-center justify-between">
      <div>
        <p class="text-xs text-text-muted">Потрачено сегодня</p>
        <p class="text-2xl font-semibold text-text">{{ todayTotal.toLocaleString('ru-RU') }} ₸</p>
      </div>
      <div class="text-right">
        <p class="text-xs text-text-muted">Уровень {{ level }}</p>
        <p class="text-sm font-medium text-accent-strong">{{ totalPoints }} очков</p>
      </div>
    </AppCard>

    <div class="mt-3 flex flex-col gap-2">
      <AppCard v-for="q in quests" :key="q.key" class="flex items-center justify-between">
        <div class="min-w-0">
          <p class="text-sm font-medium" :class="q.done ? 'text-text-faint line-through' : 'text-text'">
            {{ q.title }}
          </p>
          <p class="text-xs text-text-muted">{{ q.description }}</p>
        </div>
        <AppChip :tone="q.done ? 'positive' : 'neutral'">{{ q.done ? '✓' : `+${q.points}` }}</AppChip>
      </AppCard>
    </div>

    <AppButton class="mt-4 w-full" @click="formOpen = true">+ Записать трату</AppButton>
    <AppButton class="mt-2 w-full" variant="ghost" @click="openSummary">
      {{ summaryOpen ? 'Скрыть итоги недели' : 'Итоги недели' }}
    </AppButton>

    <AppCard v-if="summaryOpen" class="mt-2">
      <p class="text-sm text-text-muted">Всего за неделю</p>
      <p class="text-xl font-semibold text-text">{{ weekTotal.toLocaleString('ru-RU') }} ₸</p>
      <div class="mt-3 flex flex-col gap-1.5">
        <div v-for="[cat, sum] in weekByCategory" :key="cat" class="flex justify-between text-sm">
          <span class="text-text-muted">{{ EXPENSE_CATEGORY_LABEL[cat as keyof typeof EXPENSE_CATEGORY_LABEL] }}</span>
          <span class="text-text">{{ sum.toLocaleString('ru-RU') }} ₸</span>
        </div>
      </div>
    </AppCard>

    <div class="mt-6">
      <h2 class="mb-2 text-sm font-semibold text-text-muted">Сегодня</h2>
      <EmptyState v-if="today.length === 0" title="Трат пока нет" />
      <div v-else class="flex flex-col gap-2">
        <AppCard v-for="e in today" :key="e.id" class="flex items-center justify-between">
          <div class="min-w-0">
            <p class="text-sm font-medium text-text">
              {{ EXPENSE_CATEGORY_LABEL[e.category] }}
              <span v-if="e.note" class="font-normal text-text-muted">· {{ e.note }}</span>
            </p>
            <p class="text-xs text-text-faint">{{ formatShortDate(e.createdAt) }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-medium text-text">{{ e.amount.toLocaleString('ru-RU') }} ₸</span>
            <button class="text-text-faint hover:text-urgent" aria-label="Удалить" @click="remove(e.id!)">✕</button>
          </div>
        </AppCard>
      </div>
    </div>
  </section>

  <BottomSheet v-model="formOpen">
    <ExpenseForm @submit="handleSubmit" @cancel="formOpen = false" />
  </BottomSheet>
</template>
