<script setup lang="ts">
import { useReminders } from '@/features/rhythm/composables/useReminders'
import { useExpenses } from '@/features/flow/composables/useExpenses'
import { useQuests } from '@/features/flow/composables/useQuests'
import PageHeader from '@/design-system/PageHeader.vue'
import AppCard from '@/design-system/AppCard.vue'
import EmptyState from '@/design-system/EmptyState.vue'
import ReminderCard from '@/features/rhythm/components/ReminderCard.vue'

const { dueToday, complete, skipToday } = useReminders()
const { todayTotal } = useExpenses()
const { quests } = useQuests()

const questsLeft = () => quests.value.filter((q) => !q.done).length

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}
</script>

<template>
  <PageHeader :title="greeting()" subtitle="Вот что важно сегодня" />

  <section class="px-5">
    <div class="grid grid-cols-2 gap-2.5">
      <AppCard>
        <p class="text-xs text-text-muted">Потрачено сегодня</p>
        <p class="mt-1 text-xl font-semibold text-text">{{ todayTotal.toLocaleString('ru-RU') }} ₸</p>
      </AppCard>
      <AppCard>
        <p class="text-xs text-text-muted">Квесты открыты</p>
        <p class="mt-1 text-xl font-semibold text-text">{{ questsLeft() }}</p>
      </AppCard>
    </div>

    <h2 class="mb-2 mt-6 text-sm font-semibold text-text-muted">На сегодня</h2>
    <EmptyState v-if="dueToday.length === 0" title="На сегодня всё сделано" description="Можно выдохнуть — ничего не забыто." />
    <div v-else class="flex flex-col gap-2.5">
      <ReminderCard
        v-for="r in dueToday"
        :key="r.id"
        :reminder="r"
        @complete="complete(r.id!)"
        @skip="skipToday(r.id!)"
      />
    </div>
  </section>
</template>
