import { defineStore } from 'pinia'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

const STORAGE_KEY = 'aya:notifications-enabled'

/**
 * Настройки уровня приложения — то немногое, что не относится к конкретной фиче
 * (Rhythm/Flow) и должно быть доступно из разных мест разом.
 */
export const useSettingsStore = defineStore('settings', {
  state: () => ({
    notificationsEnabled: readStoredFlag(),
  }),
  actions: {
    async requestNotifications() {
      if (Capacitor.isNativePlatform()) {
        const { display } = await LocalNotifications.requestPermissions()
        this.notificationsEnabled = display === 'granted'
      } else {
        if (!('Notification' in window)) return
        const permission = await Notification.requestPermission()
        this.notificationsEnabled = permission === 'granted'
      }
      localStorage.setItem(STORAGE_KEY, String(this.notificationsEnabled))
    },
  },
})

function readStoredFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}
