<script setup lang="ts">
import type { Reminder } from '@/infra/db'
import { CATEGORY_LABEL } from '../composables/useReminders'
import { isOverdue, formatShortDate } from '@/core/dates'
import AppCard from '@/design-system/AppCard.vue'
import AppChip from '@/design-system/AppChip.vue'
import AppButton from '@/design-system/AppButton.vue'

const props = defineProps<{ reminder: Reminder }>()
const emit = defineEmits<{ complete: []; skip: [] }>()

const overdue = isOverdue(props.reminder.nextDueAt)
</script>

<template>
  <AppCard class="flex items-center justify-between gap-3">
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <AppChip :tone="overdue ? 'urgent' : 'neutral'">{{ CATEGORY_LABEL[reminder.category] }}</AppChip>
        <span v-if="reminder.streak > 1" class="text-xs text-text-faint">🔥 {{ reminder.streak }}</span>
      </div>
      <p class="mt-1.5 truncate font-medium text-text">{{ reminder.title }}</p>
      <p class="text-xs text-text-muted">
        {{ overdue ? 'Просрочено · ' : '' }}{{ formatShortDate(reminder.nextDueAt) }}, {{ reminder.timeOfDay }}
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-1.5">
      <AppButton variant="ghost" @click="emit('skip')">Не сегодня</AppButton>
      <AppButton variant="primary" @click="emit('complete')">Готово</AppButton>
    </div>
  </AppCard>
</template>
