import { describe, expect, it } from 'vitest'
import { bridgeColor } from '~/utils/colors'

describe('bridgeColor', () => {
  it('gives 5 distinct colors, then cycles', () => {
    const indexes = [0, 1, 2, 3, 4, 5]

    const colors = indexes.map(bridgeColor)

    expect(new Set(colors.slice(0, 5)).size).toBe(5)
    expect(colors[5]).toBe(colors[0])
  })
})
