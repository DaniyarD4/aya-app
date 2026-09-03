<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { Capacitor } from '@capacitor/core'
import BottomNav from '@/design-system/BottomNav.vue'
import { useReminders } from '@/features/rhythm/composables/useReminders'
import { checkAndNotify } from '@/features/rhythm/notify'
import { useNativeNotifications } from '@/features/rhythm/composables/useNativeNotifications'

const { all } = useReminders()

// Native iOS (Capacitor): настоящие on-device уведомления, планируются здесь и работают
// даже с закрытым приложением. На вебе — best-effort polling ниже, только пока открыто.
useNativeNotifications(all)

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  if (Capacitor.isNativePlatform()) return
  checkAndNotify(all.value)
  timer = setInterval(() => checkAndNotify(all.value), 60_000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="mx-auto min-h-svh max-w-md bg-bg pb-20">
    <router-view />
  </div>
  <BottomNav />
</template>
