import { describe, expect, it, vi } from 'vitest'
import { fetchPackagist, parsePackagist } from '../scripts/lib/packagist'

const payload = {
  package: {
    downloads: { total: 5000000, monthly: 120000, daily: 4000 },
    favers: 880,
    repository: 'https://github.com/symfony/webpack-encore-bundle'
  }
}

describe('parsePackagist', () => {
  it('maps downloads and favers', () => {
    expect(parsePackagist(payload)).toEqual({ total: 5000000, last30: 120000, lastDay: 4000, stars: 880 })
  })

  it('defaults missing fields to 0', () => {
    expect(parsePackagist({ package: { downloads: {} } })).toEqual({ total: 0, last30: 0, lastDay: 0, stars: 0 })
  })
})

describe('fetchPackagist', () => {
  it('requests the package json endpoint', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => payload })) as unknown as typeof fetch
    await fetchPackagist('symfony/webpack-encore-bundle', fetchFn)
    expect(fetchFn).toHaveBeenCalledWith('https://packagist.org/packages/symfony/webpack-encore-bundle.json')
  })

  it('throws on a non-ok response', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch
    await expect(fetchPackagist('does/not-exist', fetchFn)).rejects.toThrow()
  })
})
