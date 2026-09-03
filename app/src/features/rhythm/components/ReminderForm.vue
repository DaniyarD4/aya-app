<script setup lang="ts">
import { reactive } from 'vue'
import type { ReminderCategory, ReminderType } from '@/infra/db'
import { CATEGORY_LABEL, type CreateReminderInput } from '../composables/useReminders'
import AppButton from '@/design-system/AppButton.vue'

const emit = defineEmits<{ submit: [input: CreateReminderInput]; cancel: [] }>()

const WEEKDAYS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
]

const INTERVAL_PRESETS = [
  { label: 'Каждый день', days: 1 },
  { label: 'Раз в неделю', days: 7 },
  { label: 'Раз в 2 недели', days: 14 },
  { label: 'Раз в месяц', days: 30 },
]

const form = reactive({
  title: '',
  category: 'custom' as ReminderCategory,
  type: 'interval' as ReminderType,
  intervalDays: 1,
  weeklyDays: [] as number[],
  timeOfDay: '09:00',
})

function toggleWeekday(day: number) {
  const idx = form.weeklyDays.indexOf(day)
  if (idx === -1) form.weeklyDays.push(day)
  else form.weeklyDays.splice(idx, 1)
}

function submit() {
  if (!form.title.trim()) return
  if (form.type === 'weekly' && form.weeklyDays.length === 0) return
  emit('submit', {
    title: form.title.trim(),
    category: form.category,
    type: form.type,
    intervalDays: form.type === 'interval' ? form.intervalDays : undefined,
    weeklyDays: form.type === 'weekly' ? [...form.weeklyDays] : undefined,
    timeOfDay: form.timeOfDay,
  })
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="submit">
    <h2 class="text-lg font-semibold text-text">Новое напоминание</h2>

    <div>
      <label class="field-label">Что напомнить</label>
      <input v-model="form.title" class="field-input" placeholder="Например, купить хлеб" autofocus />
    </div>

    <div>
      <label class="field-label">Категория</label>
      <select v-model="form.category" class="field-input">
        <option v-for="(label, key) in CATEGORY_LABEL" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <div>
      <label class="field-label">Повторение</label>
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-control border px-3 py-2 text-sm font-medium"
          :class="form.type === 'interval' ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-text-muted'"
          @click="form.type = 'interval'"
        >
          По интервалу
        </button>
        <button
          type="button"
          class="flex-1 rounded-control border px-3 py-2 text-sm font-medium"
          :class="form.type === 'weekly' ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-text-muted'"
          @click="form.type = 'weekly'"
        >
          По дням недели
        </button>
      </div>
    </div>

    <div v-if="form.type === 'interval'" class="grid grid-cols-2 gap-2">
      <button
        v-for="preset in INTERVAL_PRESETS"
        :key="preset.days"
        type="button"
        class="rounded-control border px-3 py-2 text-sm"
        :class="form.intervalDays === preset.days ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-text-muted'"
        @click="form.intervalDays = preset.days"
      >
        {{ preset.label }}
      </button>
    </div>

    <div v-else class="flex flex-wrap gap-1.5">
      <button
        v-for="d in WEEKDAYS"
        :key="d.value"
        type="button"
        class="h-9 w-9 rounded-full border text-sm font-medium"
        :class="
          form.weeklyDays.includes(d.value)
            ? 'border-accent bg-accent-soft text-accent-strong'
            : 'border-border text-text-muted'
        "
        @click="toggleWeekday(d.value)"
      >
        {{ d.label }}
      </button>
    </div>

    <div>
      <label class="field-label">Время</label>
      <input v-model="form.timeOfDay" type="time" class="field-input" />
    </div>

    <div class="mt-1 flex gap-2">
      <AppButton variant="secondary" type="button" @click="emit('cancel')">Отмена</AppButton>
      <AppButton type="submit">Создать</AppButton>
    </div>
  </form>
</template>
