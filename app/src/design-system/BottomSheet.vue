<script setup lang="ts">
const open = defineModel<boolean>({ required: true })
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-20 bg-black/30" @click="open = false" />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-200 ease-out"
      leave-active-class="transition-transform duration-150 ease-in"
      enter-from-class="translate-y-full"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md rounded-t-card bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl"
      >
        <div class="mx-auto mb-4 h-1 w-9 rounded-full bg-border" />
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>
