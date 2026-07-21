import { describe, expect, it } from 'vitest'
import { packageKey, sumDaily } from '../shared/stats'

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
