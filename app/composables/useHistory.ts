import type { History } from '~~/shared/stats'

let inflight: Promise<void> | null = null

export function useHistory() {
  const history = useState<History | null>('history', () => null)
  const pending = useState<boolean>('history-pending', () => false)
  const error = useState<Error | null>('history-error', () => null)

  async function load(): Promise<void> {
    if (history.value) {
      return
    }
    if (inflight) {
      return inflight
    }
    pending.value = true
    error.value = null
    inflight = $fetch<History>('/history.json')
      .then((data) => {
        history.value = data
      })
      .catch((err) => {
        error.value = err as Error
      })
      .finally(() => {
        pending.value = false
        inflight = null
      })
    return inflight
  }

  return { history, pending, error, load }
}
