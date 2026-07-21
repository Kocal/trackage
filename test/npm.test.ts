import { describe, expect, it, vi } from 'vitest'
import { chunkRanges, dailyMap, fetchNpmDays } from '../scripts/lib/npm'

describe('chunkRanges', () => {
  it('splits into <=size-day windows covering the whole span', () => {
    const ranges = chunkRanges('2015-01-01', '2016-12-31', 500)
    expect(ranges[0][0]).toBe('2015-01-01')
    expect(ranges.at(-1)![1]).toBe('2016-12-31')
    for (const [s, e] of ranges) {
      const span = (Date.parse(e) - Date.parse(s)) / 86400000
      expect(span).toBeLessThanOrEqual(499)
    }
  })

  it('is contiguous with no gaps or overlaps', () => {
    const ranges = chunkRanges('2020-01-01', '2021-06-01', 500)
    for (let i = 1; i < ranges.length; i++) {
      const prevEnd = Date.parse(ranges[i - 1][1])
      const thisStart = Date.parse(ranges[i][0])
      expect(thisStart - prevEnd).toBe(86400000)
    }
  })
})

describe('fetchNpmDays', () => {
  it('merges downloads across chunks, fetching different data per chunk', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      const [, range] = url.match(/range\/([^/]+)\//) ?? []
      const [chunkStart] = (range ?? '').split(':')
      return {
        ok: true,
        json: async () => ({ downloads: [{ day: chunkStart, downloads: chunkStart === '2015-01-10' ? 5 : 7 }] })
      }
    }) as unknown as typeof fetch

    const days = await fetchNpmDays('@symfony/ux-vue', '2015-01-10', '2016-06-01', fetchFn, { delayMs: 0, sleep: async () => {} })

    expect(days.length).toBeGreaterThan(1)
    expect(days.some(d => d.downloads === 5)).toBe(true)
    expect(days.some(d => d.downloads === 7)).toBe(true)
  })

  it('stops and returns what it has on a 404', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch
    const days = await fetchNpmDays('@symfony/ux-vue', '2015-01-10', '2015-06-01', fetchFn, { delayMs: 0, sleep: async () => {} })
    expect(days).toEqual([])
  })

  it('retries on 429 with backoff then succeeds', async () => {
    let calls = 0
    const fetchFn = vi.fn(async () => {
      calls++
      if (calls === 1) {
        return { ok: false, status: 429 }
      }
      return { ok: true, json: async () => ({ downloads: [{ day: '2015-01-10', downloads: 9 }] }) }
    }) as unknown as typeof fetch

    const days = await fetchNpmDays('@symfony/ux-vue', '2015-01-10', '2015-01-10', fetchFn, { delayMs: 0, sleep: async () => {} })

    expect(calls).toBe(2)
    expect(days).toEqual([{ day: '2015-01-10', downloads: 9 }])
  })

  it('throws on a non-ok, non-404, non-429 response', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch
    await expect(
      fetchNpmDays('@symfony/ux-vue', '2015-01-10', '2015-01-10', fetchFn, { delayMs: 0, sleep: async () => {} })
    ).rejects.toThrow()
  })
})

describe('dailyMap', () => {
  it('maps day to downloads, skipping non-positive values', () => {
    const map = dailyMap([
      { day: '2026-07-19', downloads: 3 },
      { day: '2026-07-20', downloads: 0 },
      { day: '2026-07-21', downloads: 4 }
    ])
    expect(map).toEqual({ '2026-07-19': 3, '2026-07-21': 4 })
  })

  it('is safe on empty input', () => {
    expect(dailyMap([])).toEqual({})
  })
})
