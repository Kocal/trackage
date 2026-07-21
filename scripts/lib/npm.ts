export interface NpmDay {
  day: string
  downloads: number
}

export interface NpmFetchOptions {
  delayMs?: number
  maxRetries?: number
  sleep?: (ms: number) => Promise<void>
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function chunkRanges(start: string, end: string, size = 500): Array<[string, string]> {
  const ranges: Array<[string, string]> = []
  const endDate = new Date(`${end}T00:00:00Z`)
  let cursor = new Date(`${start}T00:00:00Z`)
  while (cursor <= endDate) {
    const chunkEnd = new Date(cursor)
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + size - 1)
    const clamped = chunkEnd > endDate ? endDate : chunkEnd
    ranges.push([iso(cursor), iso(clamped)])
    cursor = new Date(clamped)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return ranges
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export async function fetchNpmDays(pkg: string, start: string, end: string, fetchFn: typeof fetch = fetch, opts: NpmFetchOptions = {}): Promise<NpmDay[]> {
  const delayMs = opts.delayMs ?? 300
  const maxRetries = opts.maxRetries ?? 4
  const sleep = opts.sleep ?? defaultSleep
  const out: NpmDay[] = []
  for (const [chunkStart, chunkEnd] of chunkRanges(start, end)) {
    let attempt = 0
    for (;;) {
      const res = await fetchFn(`https://api.npmjs.org/downloads/range/${chunkStart}:${chunkEnd}/${pkg}`)
      if (res.ok) {
        const json = await res.json() as { downloads?: NpmDay[] }
        for (const d of json.downloads ?? []) {
          if (d.downloads > 0) out.push(d)
        }
        break
      }
      if ((res as Response).status === 404) {
        return out
      }
      if ((res as Response).status === 429 && attempt < maxRetries) {
        attempt++
        await sleep(delayMs * 2 ** attempt)
        continue
      }
      throw new Error(`npm ${pkg} ${chunkStart}:${chunkEnd} -> ${(res as Response).status}`)
    }
    await sleep(delayMs)
  }
  return out
}

export function dailyMap(days: NpmDay[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const d of days) {
    if (d.downloads > 0) {
      map[d.day] = d.downloads
    }
  }
  return map
}
