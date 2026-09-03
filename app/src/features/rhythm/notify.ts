import type { Reminder } from '@/infra/db'
import { CATEGORY_LABEL } from '@/features/rhythm/composables/useReminders'
import { dayKey, isDueToday } from '@/core/dates'

/**
 * MVP-уведомления: работают, только пока вкладка/PWA открыта или свёрнута в фоне —
 * браузер не даёт планировать пуш без сервера. Настоящее «напомнит, даже если
 * приложение закрыто» — это web push с бэкендом (см. Desktop/Aya/docs/03-architecture.md,
 * раздел про пуши) и пока не реализовано.
 */
function notifiedKey(id: number) {
  return `aya:notified:${id}:${dayKey()}`
}

export function checkAndNotify(reminders: Reminder[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  for (const r of reminders) {
    if (!r.id || !isDueToday(r.nextDueAt)) continue
    const key = notifiedKey(r.id)
    if (localStorage.getItem(key)) continue
    new Notification(r.title, {
      body: `${CATEGORY_LABEL[r.category]} · Aya напоминает`,
      icon: '/icons/icon-192.png',
      tag: key,
    })
    localStorage.setItem(key, '1')
  }
}
