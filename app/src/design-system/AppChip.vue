<script setup lang="ts">
withDefaults(
  defineProps<{ tone?: 'neutral' | 'accent' | 'positive' | 'urgent' }>(),
  { tone: 'neutral' },
)
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
    :class="{
      'bg-surface-muted text-text-muted': tone === 'neutral',
      'bg-accent-soft text-accent-strong': tone === 'accent',
      'bg-positive-soft text-positive': tone === 'positive',
      'bg-urgent-soft text-urgent': tone === 'urgent',
    }"
  >
    <slot />
  </span>
</template>
