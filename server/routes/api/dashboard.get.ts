import { buildDashboard } from '~/utils/dashboard'
import { projects } from '~/data/projects.config'
import type { History } from '~~/shared/stats'

export default defineEventHandler(async () => {
  const storage = useStorage('assets:history')
  const keys = await storage.getKeys()
  const merged: History = { generatedAt: '', packages: {} }
  for (const key of keys) {
    const h = await storage.getItem(key) as History | null
    if (!h) {
      continue
    }
    Object.assign(merged.packages, h.packages)
    if (h.generatedAt > merged.generatedAt) {
      merged.generatedAt = h.generatedAt
    }
  }
  return buildDashboard(projects, merged)
})
