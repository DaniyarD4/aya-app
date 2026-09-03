<script setup lang="ts">
import { reactive } from 'vue'
import type { ExpenseCategory, Expense } from '@/infra/db'
import { EXPENSE_CATEGORY_LABEL, type LogExpenseInput } from '../composables/useExpenses'
import AppButton from '@/design-system/AppButton.vue'

const emit = defineEmits<{ submit: [input: LogExpenseInput]; cancel: [] }>()

const form = reactive({
  amount: null as number | null,
  category: 'food' as ExpenseCategory,
  note: '',
  reflection: null as Expense['reflection'],
})

function submit() {
  if (!form.amount || form.amount <= 0) return
  emit('submit', {
    amount: form.amount,
    category: form.category,
    note: form.note.trim() || undefined,
    reflection: form.reflection,
  })
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="submit">
    <h2 class="text-lg font-semibold text-text">Новая трата</h2>

    <div>
      <label class="field-label">Сумма</label>
      <input v-model.number="form.amount" type="number" inputmode="decimal" min="0" class="field-input" placeholder="0" autofocus />
    </div>

    <div>
      <label class="field-label">Категория</label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="(label, key) in EXPENSE_CATEGORY_LABEL"
          :key="key"
          type="button"
          class="rounded-full border px-3 py-1.5 text-sm"
          :class="form.category === key ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-text-muted'"
          @click="form.category = key"
        >
          {{ label }}
        </button>
      </div>
    </div>

    <div>
      <label class="field-label">Заметка (необязательно)</label>
      <input v-model="form.note" class="field-input" placeholder="" />
    </div>

    <div>
      <label class="field-label">Это было — без оценки, просто наблюдение</label>
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-control border px-3 py-2 text-sm font-medium"
          :class="form.reflection === 'planned' ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-text-muted'"
          @click="form.reflection = form.reflection === 'planned' ? null : 'planned'"
        >
          Плановая
        </button>
        <button
          type="button"
          class="flex-1 rounded-control border px-3 py-2 text-sm font-medium"
          :class="form.reflection === 'spontaneous' ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-text-muted'"
          @click="form.reflection = form.reflection === 'spontaneous' ? null : 'spontaneous'"
        >
          Спонтанная
        </button>
      </div>
    </div>

    <div class="mt-1 flex gap-2">
      <AppButton variant="secondary" type="button" @click="emit('cancel')">Отмена</AppButton>
      <AppButton type="submit">Записать</AppButton>
    </div>
  </form>
</template>
