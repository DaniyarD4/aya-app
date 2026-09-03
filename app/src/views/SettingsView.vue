<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '@/core/settingsStore'
import { db } from '@/infra/db'
import PageHeader from '@/design-system/PageHeader.vue'
import AppCard from '@/design-system/AppCard.vue'
import AppButton from '@/design-system/AppButton.vue'

const settings = useSettingsStore()
const resetConfirm = ref(false)

async function exportData() {
  const data = {
    reminders: await db.reminders.toArray(),
    checklists: await db.checklists.toArray(),
    expenses: await db.expenses.toArray(),
    questCompletions: await db.questCompletions.toArray(),
    exportedAt: new Date().toISOString(),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `aya-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function resetAllData() {
  await Promise.all([
    db.reminders.clear(),
    db.checklists.clear(),
    db.expenses.clear(),
    db.questCompletions.clear(),
  ])
  resetConfirm.value = false
}
</script>

<template>
  <PageHeader title="Настройки" />

  <section class="flex flex-col gap-3 px-5">
    <AppCard class="flex items-center justify-between">
      <div>
        <p class="font-medium text-text">Уведомления</p>
        <p class="text-xs text-text-muted">Локальные напоминания в браузере, пока приложение открыто</p>
      </div>
      <AppButton variant="secondary" @click="settings.requestNotifications">
        {{ settings.notificationsEnabled ? 'Включено' : 'Включить' }}
      </AppButton>
    </AppCard>

    <AppCard class="flex items-center justify-between">
      <div>
        <p class="font-medium text-text">Экспорт данных</p>
        <p class="text-xs text-text-muted">Скачать резервную копию в JSON</p>
      </div>
      <AppButton variant="secondary" @click="exportData">Скачать</AppButton>
    </AppCard>

    <AppCard>
      <p class="font-medium text-text">Сбросить все данные</p>
      <p class="mb-3 text-xs text-text-muted">Необратимо удалит все напоминания, чек-листы и траты на этом устройстве</p>
      <AppButton v-if="!resetConfirm" variant="secondary" @click="resetConfirm = true">Сбросить</AppButton>
      <div v-else class="flex gap-2">
        <AppButton variant="secondary" @click="resetConfirm = false">Отмена</AppButton>
        <AppButton @click="resetAllData">Точно удалить всё</AppButton>
      </div>
    </AppCard>

    <p class="mt-2 text-center text-xs text-text-faint">Aya · MVP · данные хранятся только на этом устройстве</p>
  </section>
</template>
