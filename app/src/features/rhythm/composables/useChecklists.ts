import { db, type Checklist, type ChecklistItem } from '@/infra/db'
import { useLiveQuery } from '@/core/useLiveQuery'

export function useChecklists() {
  const all = useLiveQuery(
    () => db.checklists.orderBy('createdAt').reverse().filter((c) => !c.archived).toArray(),
    [] as Checklist[],
  )

  async function create(title: string, itemLabels: string[]) {
    const items: ChecklistItem[] = itemLabels
      .map((label) => label.trim())
      .filter(Boolean)
      .map((label) => ({ id: crypto.randomUUID(), label, done: false }))
    await db.checklists.add({ title, items, archived: false, createdAt: Date.now() })
  }

  async function toggleItem(checklistId: number, itemId: string) {
    const checklist = await db.checklists.get(checklistId)
    if (!checklist) return
    const items = checklist.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i))
    await db.checklists.update(checklistId, { items })
  }

  async function archive(checklistId: number) {
    await db.checklists.update(checklistId, { archived: true })
  }

  return { all, create, toggleItem, archive }
}
