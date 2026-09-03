<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <div class="flex flex-col items-center gap-1 py-12 text-center text-text-muted">
    <p class="text-sm font-medium text-text">{{ title }}</p>
    <p v-if="description" class="text-sm max-w-xs">{{ description }}</p>
    <div class="mt-3">
      <slot />
    </div>
  </div>
</template>
