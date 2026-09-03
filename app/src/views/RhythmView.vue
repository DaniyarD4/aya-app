<script setup lang="ts">
import { ref } from 'vue'
import { useReminders } from '@/features/rhythm/composables/useReminders'
import { useChecklists } from '@/features/rhythm/composables/useChecklists'
import PageHeader from '@/design-system/PageHeader.vue'
import AppButton from '@/design-system/AppButton.vue'
import AppCard from '@/design-system/AppCard.vue'
import EmptyState from '@/design-system/EmptyState.vue'
import BottomSheet from '@/design-system/BottomSheet.vue'
import ReminderCard from '@/features/rhythm/components/ReminderCard.vue'
import ReminderForm from '@/features/rhythm/components/ReminderForm.vue'
import ChecklistForm from '@/features/rhythm/components/ChecklistForm.vue'
import type { CreateReminderInput } from '@/features/rhythm/composables/useReminders'

const { all, complete, skipToday, create } = useReminders()
const { all: checklists, toggleItem, create: createChecklist } = useChecklists()

const formOpen = ref(false)
const checklistFormOpen = ref(false)

async function handleSubmit(input: CreateReminderInput) {
  await create(input)
  formOpen.value = false
}

async function handleChecklistSubmit(title: string, items: string[]) {
  await createChecklist(title, items)
  checklistFormOpen.value = false
}
</script>

<template>
  <PageHeader title="Ритм" subtitle="Всё, что повторяется — покупки, дела, сезонные списки" />

  <section class="px-5">
    <div v-if="all.length === 0">
      <EmptyState title="Пока пусто" description="Добавь первое напоминание — например, купить хлеб или принять витамины.">
        <AppButton @click="formOpen = true">Добавить напоминание</AppButton>
      </EmptyState>
    </div>

    <template v-else>
      <div class="flex flex-col gap-2.5">
        <ReminderCard
          v-for="r in all"
          :key="r.id"
          :reminder="r"
          @complete="complete(r.id!)"
          @skip="skipToday(r.id!)"
        />
      </div>
      <AppButton class="mt-4 w-full" variant="secondary" @click="formOpen = true">+ Новое напоминание</AppButton>
    </template>

    <div class="mt-8">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-text-muted">Чек-листы</h2>
        <button class="text-sm font-medium text-accent" @click="checklistFormOpen = true">+ Добавить</button>
      </div>
      <div v-if="checklists.length === 0" class="text-sm text-text-faint">
        Например, «Подготовка к зиме» — список вещей, которые стоит проверить заранее.
      </div>
      <div v-else class="flex flex-col gap-2.5">
        <AppCard v-for="c in checklists" :key="c.id">
          <p class="mb-2 font-medium text-text">{{ c.title }}</p>
          <label
            v-for="item in c.items"
            :key="item.id"
            class="flex items-center gap-2 py-1 text-sm"
            :class="item.done ? 'text-text-faint line-through' : 'text-text'"
          >
            <input type="checkbox" :checked="item.done" @change="toggleItem(c.id!, item.id)" />
            {{ item.label }}
          </label>
        </AppCard>
      </div>
    </div>
  </section>

  <BottomSheet v-model="formOpen">
    <ReminderForm @submit="handleSubmit" @cancel="formOpen = false" />
  </BottomSheet>
  <BottomSheet v-model="checklistFormOpen">
    <ChecklistForm @submit="handleChecklistSubmit" @cancel="checklistFormOpen = false" />
  </BottomSheet>
</template>
