import { describe, expect, it, vi } from 'vitest'
import { fetchPackagistDaily, fetchPackagistTotal, parsePackagistDaily } from '../scripts/lib/packagist'

describe('parsePackagistDaily', () => {
  it('zips labels with the values for the given package name', () => {
    const json = {
      labels: ['2026-07-10', '2026-07-11', '2026-07-12'],
      values: { 'symfony/webpack-encore-bundle': [54870, 0, 61190] },
      average: 'daily'
    }
    expect(parsePackagistDaily(json, 'symfony/webpack-encore-bundle')).toEqual({
      '2026-07-10': 54870,
      '2026-07-12': 61190
    })
  })

  it('skips non-positive values', () => {
    const json = { labels: ['2026-07-10'], values: { 'a/b': [0] } }
    expect(parsePackagistDaily(json, 'a/b')).toEqual({})
  })

  it('returns an empty map when the name key is missing', () => {
    const json = { labels: ['2026-07-10'], values: {} }
    expect(parsePackagistDaily(json, 'a/b')).toEqual({})
  })
})

describe('fetchPackagistTotal', () => {
  it('maps downloads.total', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ package: { downloads: { total: 5000000 } } })
    })) as unknown as typeof fetch
    expect(await fetchPackagistTotal('symfony/webpack-encore-bundle', fetchFn)).toEqual({ total: 5000000 })
  })

  it('defaults to 0 when downloads are missing', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ package: {} }) })) as unknown as typeof fetch
    expect(await fetchPackagistTotal('a/b', fetchFn)).toEqual({ total: 0 })
  })

  it('throws on a non-ok response', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch
    await expect(fetchPackagistTotal('does/not-exist', fetchFn)).rejects.toThrow()
  })
})

describe('fetchPackagistDaily', () => {
  it('requests the exact stats/all.json URL', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ labels: [], values: {} })
    })) as unknown as typeof fetch
    await fetchPackagistDaily('symfony/webpack-encore-bundle', '2026-06-16', fetchFn)
    expect(fetchFn).toHaveBeenCalledWith(
      'https://packagist.org/packages/symfony/webpack-encore-bundle/stats/all.json?average=daily&from=2026-06-16'
    )
  })

  it('parses the response into a daily map', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ labels: ['2026-07-10'], values: { 'a/b': [10] } })
    })) as unknown as typeof fetch
    expect(await fetchPackagistDaily('a/b', '2026-06-16', fetchFn)).toEqual({ '2026-07-10': 10 })
  })

  it('throws on a non-ok response', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch
    await expect(fetchPackagistDaily('a/b', '2026-06-16', fetchFn)).rejects.toThrow()
  })
})
