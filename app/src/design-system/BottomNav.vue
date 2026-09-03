<script setup lang="ts">
const tabs = [
  { to: '/', label: 'Сегодня', icon: 'home' },
  { to: '/rhythm', label: 'Ритм', icon: 'cycle' },
  { to: '/flow', label: 'Финансы', icon: 'wallet' },
  { to: '/settings', label: 'Настройки', icon: 'settings' },
] as const
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
  >
    <div class="mx-auto flex max-w-md">
      <router-link
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
        :class="$route.path === tab.to ? 'text-accent' : 'text-text-faint'"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="h-5 w-5">
          <path
            v-if="tab.icon === 'home'"
            d="M4 11.5 12 4l8 7.5M6 10v9h5v-5h2v5h5v-9"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <template v-else-if="tab.icon === 'cycle'">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M8.5 12.2 11 14.7l4.8-5.6" stroke-linecap="round" stroke-linejoin="round" />
          </template>
          <template v-else-if="tab.icon === 'wallet'">
            <rect x="3.5" y="6.5" width="17" height="12" rx="2" />
            <path d="M14.5 12.5h3" stroke-linecap="round" />
          </template>
          <template v-else>
            <circle cx="12" cy="12" r="2.8" />
            <path
              d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6M17.8 17.8l-1.6-1.6M7.8 7.8 6.2 6.2"
              stroke-linecap="round"
            />
          </template>
        </svg>
        {{ tab.label }}
      </router-link>
    </div>
  </nav>
</template>
