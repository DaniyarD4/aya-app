<script setup lang="ts">
withDefaults(defineProps<{ padded?: boolean }>(), { padded: true })
</script>

<template>
  <div
    class="rounded-card bg-surface border border-border"
    :class="padded ? 'p-4' : ''"
  >
    <slot />
  </div>
</template>
