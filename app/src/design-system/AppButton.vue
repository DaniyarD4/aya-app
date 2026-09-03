<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    type?: 'button' | 'submit'
  }>(),
  { variant: 'primary', type: 'button' },
)
</script>

<template>
  <button
    :type="type"
    class="inline-flex items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
    :class="{
      'bg-accent text-white hover:bg-accent-strong': variant === 'primary',
      'bg-surface-muted text-text hover:bg-border': variant === 'secondary',
      'text-text-muted hover:text-text hover:bg-surface-muted': variant === 'ghost',
    }"
  >
    <slot />
  </button>
</template>
