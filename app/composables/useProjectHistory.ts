import type { History } from '~~/shared/stats'

const inflightMap = new Map<string, Promise<void>>()

export function useProjectHistory(slug: string) {
  const history = useState<History | null>(`history:${slug}`, () => null)
  const pending = useState<boolean>(`history-pending:${slug}`, () => false)
  const error = useState<Error | null>(`history-error:${slug}`, () => null)

  async function load(): Promise<void> {
    if (!slug) {
      return
    }
    if (history.value) {
      return
    }
    const inflight = inflightMap.get(slug)
    if (inflight) {
      return inflight
    }
    pending.value = true
    error.value = null
    const promise = $fetch<History>(`/history/${slug}.json`)
      .then((data) => {
        history.value = data
      })
      .catch((err) => {
        error.value = err as Error
      })
      .finally(() => {
        pending.value = false
        inflightMap.delete(slug)
      })
    inflightMap.set(slug, promise)
    return promise
  }

  return { history, pending, error, load }
}
