import { liveQuery } from 'dexie'
import { onScopeDispose, ref, type Ref } from 'vue'

/** Реактивная подписка на Dexie liveQuery — держит IndexedDB-данные в актуальном состоянии без ручного рефетча. */
export function useLiveQuery<T>(querier: () => Promise<T> | T, initial: T): Ref<T> {
  const value = ref(initial) as Ref<T>
  const subscription = liveQuery(querier).subscribe({
    next: (v) => {
      value.value = v
    },
    error: (err) => {
      console.error('useLiveQuery error', err)
    },
  })
  onScopeDispose(() => subscription.unsubscribe())
  return value
}
