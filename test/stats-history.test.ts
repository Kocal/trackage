import { describe, expect, it } from 'vitest'
import { mergeSnapshot, packageKey, sparklineFromSeries, type Snapshot } from '../shared/stats'

const snap = (date: string, lastDay: number): Snapshot => ({ date, total: 100, last30: 30, lastDay, stars: 5 })

describe('packageKey', () => {
  it('joins registry and name', () => {
    expect(packageKey('npm', '@symfony/ux-vue')).toBe('npm:@symfony/ux-vue')
  })
})

describe('mergeSnapshot', () => {
  it('appends and keeps date order', () => {
    const out = mergeSnapshot([snap('2026-07-19', 1)], snap('2026-07-20', 2))
    expect(out.map(s => s.date)).toEqual(['2026-07-19', '2026-07-20'])
  })

  it('overwrites same-day snapshot (idempotent)', () => {
    const out = mergeSnapshot([snap('2026-07-20', 1)], snap('2026-07-20', 9))
    expect(out).toHaveLength(1)
    expect(out[0].lastDay).toBe(9)
  })

  it('handles undefined series', () => {
    expect(mergeSnapshot(undefined, snap('2026-07-20', 1))).toHaveLength(1)
  })
})

describe('sparklineFromSeries', () => {
  it('returns the last N lastDay values', () => {
    const series = [snap('2026-07-18', 1), snap('2026-07-19', 2), snap('2026-07-20', 3)]
    expect(sparklineFromSeries(series, 2)).toEqual([2, 3])
  })
})
