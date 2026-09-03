<script setup lang="ts">
import { reactive } from 'vue'
import AppButton from '@/design-system/AppButton.vue'

const emit = defineEmits<{ submit: [title: string, items: string[]]; cancel: [] }>()

const form = reactive({ title: '', itemsText: '' })

function submit() {
  const title = form.title.trim()
  const items = form.itemsText.split('\n')
  if (!title || items.every((i) => !i.trim())) return
  emit('submit', title, items)
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="submit">
    <h2 class="text-lg font-semibold text-text">Новый чек-лист</h2>

    <div>
      <label class="field-label">Название</label>
      <input v-model="form.title" class="field-input" placeholder="Например, подготовка к зиме" autofocus />
    </div>

    <div>
      <label class="field-label">Пункты — по одному на строку</label>
      <textarea v-model="form.itemsText" class="field-input" rows="5" placeholder="Проверить тёплую куртку&#10;Достать шарф и перчатки&#10;Проверить резину на машине" />
    </div>

    <div class="mt-1 flex gap-2">
      <AppButton variant="secondary" type="button" @click="emit('cancel')">Отмена</AppButton>
      <AppButton type="submit">Создать</AppButton>
    </div>
  </form>
</template>
