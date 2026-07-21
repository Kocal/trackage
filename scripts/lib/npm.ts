export interface NpmDay {
  day: string
  downloads: number
}

const NPM_EPOCH = '2015-01-10'

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

export function aggregate(days: NpmDay[]): { total: number, last30: number, lastDay: number } {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day))
  const total = sorted.reduce((sum, d) => sum + d.downloads, 0)
  const last30 = sorted.slice(-30).reduce((sum, d) => sum + d.downloads, 0)
  const lastDay = sorted.length ? sorted[sorted.length - 1].downloads : 0
  return { total, last30, lastDay }
}

export async function fetchNpmDays(pkg: string, end: string, fetchFn: typeof fetch = fetch): Promise<NpmDay[]> {
  const out: NpmDay[] = []
  for (const [start, chunkEnd] of chunkRanges(NPM_EPOCH, end)) {
    const url = `https://api.npmjs.org/downloads/range/${start}:${chunkEnd}/${pkg}`
    const res = await fetchFn(url)
    if (!res.ok) {
      if (res.status === 404) break
      throw new Error(`npm ${pkg} ${start}:${chunkEnd} -> ${res.status}`)
    }
    const json = await res.json() as { downloads?: NpmDay[] }
    for (const d of json.downloads ?? []) {
      if (d.downloads > 0) out.push(d)
    }
  }
  return out
}
