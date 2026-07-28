import { describe, expect, it } from 'vitest'
import type { TrackedProject } from '~/data/projects.config'
import { buildProjectDetail } from '~/utils/projectDetail'
import type { History } from '~~/shared/stats'

describe('buildProjectDetail', () => {
  it('builds a continuous zero-filled axis and aligns a package series to it', () => {
    const project: TrackedProject = {
      name: 'X',
      packages: [{ registry: 'npm', name: '@x/x', repo: 'x/x' }]
    }
    const history: History = {
      generatedAt: '2026-07-04T00:00:00Z',
      packages: {
        'npm:@x/x': { total: 999, stars: 7, daily: { '2026-07-01': 10, '2026-07-03': 5 } }
      }
    }

    const detail = buildProjectDetail(project, history)

    expect(detail.dates).toEqual(['2026-07-01', '2026-07-02', '2026-07-03'])
    expect(detail.packages[0]?.series).toEqual([10, 0, 5])
    expect(detail.packages[0]?.total).toBe(999)
    expect(detail.packages[0]?.last7).toBe(15)
    expect(detail.packages[0]?.packageUrl).toBe('https://www.npmjs.com/package/@x/x')
    expect(detail.packages[0]?.githubUrl).toBe('https://github.com/x/x')
    expect(detail.combinedTotal).toBe(999)
    expect(detail.totals.all).toBe(999)
    expect(detail.totals.d7).toBe(15)
    expect(detail.peakDay).toEqual({ date: '2026-07-01', downloads: 10 })
    expect(detail.averagePerDay).toBe(5)
    expect(detail.firstTrackedDate).toBe('2026-07-01')
    expect(detail.totalStars).toBe(7)
  })

  it('combines packages, dedupes stars by shared repo, and honors trailing windows', () => {
    const project: TrackedProject = {
      name: 'UX Vue',
      packages: [
        { registry: 'packagist', name: 'symfony/ux-vue', repo: 'symfony/ux-vue' },
        { registry: 'npm', name: '@symfony/ux-vue', repo: 'symfony/ux-vue' }
      ]
    }
    const history: History = {
      generatedAt: '2026-07-21T00:00:00Z',
      packages: {
        'packagist:symfony/ux-vue': { total: 1000, stars: 35, daily: { '2026-06-01': 100, '2026-07-20': 20 } },
        'npm:@symfony/ux-vue': { total: 500, stars: 35, daily: { '2026-07-19': 3, '2026-07-20': 5 } }
      }
    }

    const detail = buildProjectDetail(project, history)

    expect(detail.dates).toHaveLength(50) // 2026-06-01 .. 2026-07-20 inclusive
    expect(detail.firstTrackedDate).toBe('2026-06-01')
    expect(detail.combinedTotal).toBe(1500)
    expect(detail.totalStars).toBe(35) // deduped: both packages share symfony/ux-vue
    expect(detail.totals.d7).toBe(28) // 07-19 (3) + 07-20 (25)
    expect(detail.totals.d30).toBe(28)
    expect(detail.totals.d90).toBe(128) // + 06-01 (100)
    expect(detail.totals.d365).toBe(128)
    expect(detail.peakDay).toEqual({ date: '2026-06-01', downloads: 100 })
    expect(detail.averagePerDay).toBe(3) // round(128 / 50)
    const npm = detail.packages.find(p => p.registry === 'npm')
    expect(npm?.total).toBe(500) // authoritative, not the daily sum (8)
    expect(npm?.packageUrl).toBe('https://www.npmjs.com/package/@symfony/ux-vue')
  })

  it('returns empty structures for a project with no history', () => {
    const detail = buildProjectDetail({ name: 'E', packages: [] }, { generatedAt: '', packages: {} })

    expect(detail.dates).toEqual([])
    expect(detail.packages).toEqual([])
    expect(detail.combinedTotal).toBe(0)
    expect(detail.totals).toEqual({ d7: 0, d30: 0, d90: 0, d365: 0, all: 0 })
    expect(detail.peakDay).toBeNull()
    expect(detail.averagePerDay).toBe(0)
    expect(detail.firstTrackedDate).toBeNull()
    expect(detail.totalStars).toBe(0)
  })

  it('yields zeros and an empty series for a package missing from history', () => {
    const project: TrackedProject = {
      name: 'Ghost',
      packages: [{ registry: 'npm', name: '@x/ghost', repo: 'x/ghost' }]
    }

    const detail = buildProjectDetail(project, { generatedAt: '', packages: {} })

    expect(detail.dates).toEqual([])
    expect(detail.packages[0]?.total).toBe(0)
    expect(detail.packages[0]?.series).toEqual([])
    expect(detail.combinedTotal).toBe(0)
  })
})
