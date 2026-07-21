import { describe, expect, it, vi } from 'vitest'
import { aggregate, chunkRanges, fetchNpmDays } from '../scripts/lib/npm'

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

describe('aggregate', () => {
  it('computes total, last30 and lastDay', () => {
    const days = Array.from({ length: 40 }, (_, i) => ({
      day: `2026-06-${String(i + 1).padStart(2, '0')}`,
      downloads: i + 1
    }))
    const out = aggregate(days)
    expect(out.total).toBe(820)
    expect(out.lastDay).toBe(40)
    expect(out.last30).toBe(Array.from({ length: 30 }, (_, i) => i + 11).reduce((a, b) => a + b, 0))
  })

  it('is safe on empty input', () => {
    expect(aggregate([])).toEqual({ total: 0, last30: 0, lastDay: 0 })
  })
})

describe('fetchNpmDays', () => {
  it('merges downloads across chunks', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ downloads: [{ day: '2026-06-01', downloads: 5 }] })
    })) as unknown as typeof fetch
    const days = await fetchNpmDays('@symfony/ux-vue', '2015-06-01', fetchFn)
    expect(days.length).toBeGreaterThan(0)
    expect(days[0].downloads).toBe(5)
  })
})
