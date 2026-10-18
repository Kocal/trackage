import { describe, expect, it } from 'vitest'
import type { TrackedProject } from '~/data/projects.config'
import { bridgeColor } from '~/utils/colors'
import { buildDashboard } from '~/utils/dashboard'
import type { History } from '~~/shared/stats'

function expectedAxis(latest: string): string[] {
  const end = new Date(`${latest}T00:00:00Z`)
  const dates: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(end)
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

describe('buildDashboard', () => {
  it('builds a 30-consecutive-day date axis ending at the latest recorded date', () => {
    const projects: TrackedProject[] = [
      {
        name: 'Webpack Encore',
        packages: [
          { registry: 'npm', name: '@symfony/webpack-encore', repo: 'symfony/webpack-encore' }
        ]
      }
    ]
    const history: History = {
      generatedAt: '2026-07-21T00:00:00Z',
      packages: {
        'npm:@symfony/webpack-encore': {
          total: 100,
          stars: 10,
          daily: { '2026-06-01': 1, '2026-07-20': 5 }
        }
      }
    }

    const dashboard = buildDashboard(projects, history)

    expect(dashboard.dates).toEqual(expectedAxis('2026-07-20'))
    expect(dashboard.dates).toHaveLength(30)
    expect(dashboard.dates[0]).toBe('2026-06-21')
    expect(dashboard.dates[29]).toBe('2026-07-20')
  })

  it('combines totals across a project\'s npm+packagist packages', () => {
    const projects: TrackedProject[] = [
      {
        name: 'Webpack Encore',
        packages: [
          { registry: 'npm', name: '@symfony/webpack-encore', repo: 'symfony/webpack-encore' },
          { registry: 'packagist', name: 'symfony/webpack-encore-bundle', repo: 'symfony/webpack-encore-bundle' }
        ]
      }
    ]
    const history: History = {
      generatedAt: '2026-07-21T00:00:00Z',
      packages: {
        'npm:@symfony/webpack-encore': { total: 100, stars: 10, daily: { '2026-07-20': 5 } },
        'packagist:symfony/webpack-encore-bundle': { total: 200, stars: 20, daily: { '2026-07-20': 7 } }
      }
    }

    const dashboard = buildDashboard(projects, history)

    expect(dashboard.projects[0]?.combinedTotal).toBe(300)
  })

  it('sums only the last 7 axis days for combinedLast7', () => {
    const projects: TrackedProject[] = [
      {
        name: 'Webpack Encore',
        packages: [
          { registry: 'npm', name: '@symfony/webpack-encore', repo: 'symfony/webpack-encore' }
        ]
      }
    ]
    const history: History = {
      generatedAt: '2026-07-21T00:00:00Z',
      packages: {
        'npm:@symfony/webpack-encore': {
          total: 100,
          stars: 10,
          daily: { '2026-07-05': 50, '2026-07-20': 3 }
        }
      }
    }

    const dashboard = buildDashboard(projects, history)

    // axis ends 2026-07-20; the last 7 days (07-14..07-20) exclude 07-05
    expect(dashboard.projects[0]?.combinedLast7).toBe(3)
    expect(dashboard.projects[0]?.combinedLast30).toBe(53)
  })

  it('aligns a single package\'s sparkline to the 30-day axis, zero-filling absent days', () => {
    const projects: TrackedProject[] = [
      {
        name: 'Reprise',
        packages: [
          { registry: 'npm', name: '@symfony/reprise', repo: 'symfony/reprise' }
        ]
      }
    ]
    const history: History = {
      generatedAt: '2026-07-21T00:00:00Z',
      packages: {
        'npm:@symfony/reprise': {
          total: 466,
          stars: 37,
          daily: { '2026-07-18': 1, '2026-07-19': 2, '2026-07-20': 3 }
        }
      }
    }

    const dashboard = buildDashboard(projects, history)
    const pkg = dashboard.projects[0]?.packages[0]

    expect(pkg?.total).toBe(466)
    expect(pkg?.stars).toBe(37)
    expect(pkg?.sparkline).toHaveLength(30)
    expect(pkg?.sparkline?.length).toBe(dashboard.dates.length)
    // last three entries are the recorded days; everything before is zero-filled
    expect(pkg?.sparkline?.slice(-3)).toEqual([1, 2, 3])
    expect(pkg?.sparkline?.slice(0, -3)).toEqual(Array(27).fill(0))
    expect(pkg?.last30).toBe(6)
  })

  it('sums overlapping dates across packages for combined daily, not concatenates', () => {
    const projects: TrackedProject[] = [
      {
        name: 'UX Vue',
        packages: [
          { registry: 'packagist', name: 'symfony/ux-vue', repo: 'symfony/ux-vue' },
          { registry: 'npm', name: '@symfony/ux-vue', repo: 'symfony/ux-vue' }
        ]
      }
    ]
    const history: History = {
      generatedAt: '2026-07-21T00:00:00Z',
      packages: {
        'packagist:symfony/ux-vue': {
          total: 1000,
          stars: 35,
          daily: { '2026-07-19': 10, '2026-07-20': 20 }
        },
        'npm:@symfony/ux-vue': {
          total: 500,
          stars: 35,
          daily: { '2026-07-20': 5, '2026-07-21': 8 }
        }
      }
    }

    const dashboard = buildDashboard(projects, history)
    const project = dashboard.projects[0]

    expect(dashboard.dates).toHaveLength(30)
    expect(dashboard.dates[29]).toBe('2026-07-21')
    expect(project?.sparkline).toHaveLength(30)
    // last three axis days are 07-19, 07-20, 07-21
    expect(project?.sparkline?.slice(-3)).toEqual([10, 25, 8])
    expect(project?.combinedLast30).toBe(43)
  })

  it('dedupes totalStars by repo when packages share a repo', () => {
    const projects: TrackedProject[] = [
      {
        name: 'UX Vue',
        packages: [
          { registry: 'packagist', name: 'symfony/ux-vue', repo: 'symfony/ux-vue' },
          { registry: 'npm', name: '@symfony/ux-vue', repo: 'symfony/ux-vue' }
        ]
      },
      {
        name: 'UX Toolkit',
        packages: [
          { registry: 'packagist', name: 'symfony/ux-toolkit', repo: 'symfony/ux-toolkit' }
        ]
      }
    ]
    const history: History = {
      generatedAt: '2026-07-21T00:00:00Z',
      packages: {
        'packagist:symfony/ux-vue': { total: 1000, stars: 35, daily: {} },
        'npm:@symfony/ux-vue': { total: 500, stars: 35, daily: {} },
        'packagist:symfony/ux-toolkit': { total: 300, stars: 16, daily: {} }
      }
    }

    const dashboard = buildDashboard(projects, history)

    expect(dashboard.totalStars).toBe(51)
    expect(dashboard.projects[0]?.bridges).toEqual([])
    expect(dashboard.projects[0]?.bridgesNpmTotal).toBe(0)
    expect(dashboard.projects[0]?.totalStars).toBe(35)
  })

  it('computes a family card from its core and exposes one view per bridge', () => {
    const uxMap: TrackedProject = {
      name: 'UX Map',
      packages: [{ registry: 'packagist', name: 'symfony/ux-map', repo: 'symfony/ux-map' }],
      bridges: [
        {
          name: 'Leaflet',
          packages: [
            { registry: 'packagist', name: 'symfony/ux-leaflet-map', repo: 'symfony/ux-leaflet-map' },
            { registry: 'npm', name: '@symfony/ux-leaflet-map', repo: 'symfony/ux-leaflet-map' }
          ]
        },
        {
          name: 'Google Maps',
          packages: [
            { registry: 'packagist', name: 'symfony/ux-google-map', repo: 'symfony/ux-google-map' },
            { registry: 'npm', name: '@symfony/ux-google-map', repo: 'symfony/ux-google-map' }
          ]
        }
      ]
    }
    const history: History = {
      generatedAt: '2026-07-21T00:00:00Z',
      packages: {
        'packagist:symfony/ux-map': { total: 1000, stars: 19, daily: { '2026-07-19': 10, '2026-07-20': 20 } },
        'packagist:symfony/ux-leaflet-map': { total: 700, stars: 15, daily: { '2026-07-19': 6, '2026-07-20': 12 } },
        'npm:@symfony/ux-leaflet-map': { total: 40, stars: 15, daily: { '2026-07-20': 4 } },
        'packagist:symfony/ux-google-map': { total: 290, stars: 9, daily: { '2026-07-20': 7 } },
        'npm:@symfony/ux-google-map': { total: 30, stars: 9, daily: { '2026-07-20': 3 } }
      }
    }

    const dashboard = buildDashboard([uxMap], history)
    const project = dashboard.projects[0]

    expect(project?.combinedTotal).toBe(1000)
    expect(project?.combinedLast30).toBe(30)
    expect(project?.sparkline.slice(-2)).toEqual([10, 20])
    expect(project?.packages).toHaveLength(1)
    expect(project?.totalStars).toBe(43)
    expect(project?.bridgesNpmTotal).toBe(70)
    expect(project?.bridges.map(b => b.name)).toEqual(['Leaflet', 'Google Maps'])

    const [leaflet, google] = project?.bridges ?? []
    expect(leaflet?.total).toBe(700)
    expect(leaflet?.last30).toBe(18)
    expect(leaflet?.sparkline).toHaveLength(30)
    expect(leaflet?.sparkline.slice(-2)).toEqual([6, 12])
    expect(leaflet?.stars).toBe(15)
    expect(leaflet?.packages).toHaveLength(2)
    expect(leaflet?.color).toBe(bridgeColor(0))
    expect(google?.total).toBe(290)
    expect(google?.sparkline.slice(-2)).toEqual([0, 7])
    expect(google?.stars).toBe(9)
    expect(google?.color).toBe(bridgeColor(1))

    expect(dashboard.totalDownloads).toBe(1000)
    expect(dashboard.totalStars).toBe(43)
  })

  it('yields a zeroed bridge when the bridge is missing from history', () => {
    const project: TrackedProject = {
      name: 'Core',
      packages: [{ registry: 'packagist', name: 'x/core', repo: 'x/core' }],
      bridges: [
        { name: 'Ghost', packages: [{ registry: 'packagist', name: 'x/ghost', repo: 'x/ghost' }] }
      ]
    }
    const history: History = {
      generatedAt: '2026-07-21T00:00:00Z',
      packages: {
        'packagist:x/core': { total: 1, stars: 0, daily: { '2026-07-20': 1 } }
      }
    }

    const bridge = buildDashboard([project], history).projects[0]?.bridges[0]

    expect(bridge?.total).toBe(0)
    expect(bridge?.stars).toBe(0)
    expect(bridge?.last30).toBe(0)
    expect(bridge?.sparkline).toEqual(Array(30).fill(0))
  })

  it('yields zeros and an empty sparkline for a package missing from history when there is no date axis', () => {
    const projects: TrackedProject[] = [
      {
        name: 'Ghost Package',
        packages: [
          { registry: 'npm', name: '@symfony/ghost', repo: 'symfony/ghost' }
        ]
      }
    ]
    const history: History = {
      generatedAt: '2026-07-21T00:00:00Z',
      packages: {}
    }

    const dashboard = buildDashboard(projects, history)
    const pkg = dashboard.projects[0]?.packages[0]

    expect(dashboard.dates).toEqual([])
    expect(pkg?.total).toBe(0)
    expect(pkg?.stars).toBe(0)
    expect(pkg?.last30).toBe(0)
    expect(pkg?.sparkline).toEqual([])
    expect(dashboard.projects[0]?.combinedTotal).toBe(0)
    expect(dashboard.totalStars).toBe(0)
  })

  it('passes generatedAt through from history', () => {
    const dashboard = buildDashboard([], { generatedAt: '2026-07-21T12:34:56Z', packages: {} })

    expect(dashboard.generatedAt).toBe('2026-07-21T12:34:56Z')
  })

  it('sums combinedTotal across all projects for totalDownloads', () => {
    const projects: TrackedProject[] = [
      {
        name: 'Webpack Encore',
        packages: [
          { registry: 'npm', name: '@symfony/webpack-encore', repo: 'symfony/webpack-encore' }
        ]
      },
      {
        name: 'Reprise',
        packages: [
          { registry: 'npm', name: '@symfony/reprise', repo: 'symfony/reprise' }
        ]
      }
    ]
    const history: History = {
      generatedAt: '2026-07-21T00:00:00Z',
      packages: {
        'npm:@symfony/webpack-encore': { total: 1000, stars: 10, daily: {} },
        'npm:@symfony/reprise': { total: 50, stars: 5, daily: {} }
      }
    }

    const dashboard = buildDashboard(projects, history)

    expect(dashboard.totalDownloads).toBe(1050)
  })
})
