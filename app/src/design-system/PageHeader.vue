<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <header class="px-5 pt-8 pb-4">
    <h1 class="text-2xl font-semibold tracking-tight text-text">{{ title }}</h1>
    <p v-if="subtitle" class="mt-1 text-sm text-text-muted">{{ subtitle }}</p>
  </header>
</template>
