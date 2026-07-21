import { describe, expect, it } from 'vitest'
import { packageKey, sparklineSeries, sumDaily, sumLastNDays } from '../shared/stats'

describe('packageKey', () => {
  it('joins registry and name', () => {
    expect(packageKey('npm', '@symfony/ux-vue')).toBe('npm:@symfony/ux-vue')
  })
})

describe('sumDaily', () => {
  it('sums all values', () => {
    expect(sumDaily({ '2026-07-19': 3, '2026-07-20': 4 })).toBe(7)
  })

  it('is safe on empty input', () => {
    expect(sumDaily({})).toBe(0)
  })
})

describe('sumLastNDays', () => {
  it('sums all values when there are fewer than n dates', () => {
    const daily = { '2026-07-19': 3, '2026-07-20': 4 }
    expect(sumLastNDays(daily, 30)).toBe(7)
  })

  it('sums all values when there are exactly n dates', () => {
    const daily = { '2026-07-19': 3, '2026-07-20': 4 }
    expect(sumLastNDays(daily, 2)).toBe(7)
  })

  it('sums only the most-recent n dates when there are more than n', () => {
    const daily = { '2026-07-18': 1, '2026-07-19': 2, '2026-07-20': 3 }
    expect(sumLastNDays(daily, 2)).toBe(5)
  })
})

describe('sparklineSeries', () => {
  it('returns values in ascending date order', () => {
    const daily = { '2026-07-20': 3, '2026-07-18': 1, '2026-07-19': 2 }
    expect(sparklineSeries(daily, 3)).toEqual([1, 2, 3])
  })

  it('returns only the last n values in ascending date order', () => {
    const daily = { '2026-07-18': 1, '2026-07-19': 2, '2026-07-20': 3 }
    expect(sparklineSeries(daily, 2)).toEqual([2, 3])
  })
})
