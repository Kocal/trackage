import { describe, expect, it } from 'vitest'
import { bridgeColor } from '~/utils/colors'

describe('bridgeColor', () => {
  it('gives 4 distinct colors, then cycles', () => {
    const firstFour = [0, 1, 2, 3].map(bridgeColor)
    expect(new Set(firstFour).size).toBe(4)
    expect(bridgeColor(4)).toBe(bridgeColor(0))
  })
})
