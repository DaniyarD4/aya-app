import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Reminder } from '@/infra/db'
import { CATEGORY_LABEL } from './useReminders'
import { watch, type Ref } from 'vue'

/**
 * На native iOS (Capacitor) планируем настоящие on-device уведомления —
 * UNUserNotificationCenter под капотом, без сети и без сервера, работает
 * даже с закрытым приложением. На вебе (PWA в браузере) этого API нет —
 * там остаётся best-effort из notify.ts (см. там объяснение ограничения).
 */
export function useNativeNotifications(reminders: Ref<Reminder[]>) {
  if (!Capacitor.isNativePlatform()) return

  let permissionRequested = false

  async function sync() {
    if (!permissionRequested) {
      const { display } = await LocalNotifications.requestPermissions()
      permissionRequested = true
      if (display !== 'granted') return
    }

    const scheduled = reminders.value.filter((r): r is Reminder & { id: number } => r.id != null)
    if (scheduled.length === 0) return

    // Плановая замена: тот же id перезаписывает предыдущий запрос для этого напоминания.
    await LocalNotifications.schedule({
      notifications: scheduled.map((r) => ({
        id: r.id,
        title: r.title,
        body: `${CATEGORY_LABEL[r.category]} · Aya напоминает`,
        schedule: { at: new Date(r.nextDueAt) },
      })),
    })
  }

  watch(reminders, sync, { immediate: true })
}
