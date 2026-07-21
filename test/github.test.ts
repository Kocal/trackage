import { describe, expect, it, vi } from 'vitest'
import { fetchStars } from '../scripts/lib/github'

describe('fetchStars', () => {
  it('returns stargazers_count', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ stargazers_count: 1234 }) })) as unknown as typeof fetch
    expect(await fetchStars('symfony/ux', 'tok', fetchFn)).toBe(1234)
  })

  it('sends auth header when token present', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ stargazers_count: 1 }) })) as unknown as typeof fetch
    await fetchStars('symfony/ux', 'tok', fetchFn)
    const headers = (fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as { headers: Record<string, string> }
    expect(headers.headers.Authorization).toBe('Bearer tok')
  })

  it('throws on non-ok', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch
    await expect(fetchStars('x/y', '', fetchFn)).rejects.toThrow()
  })
})
