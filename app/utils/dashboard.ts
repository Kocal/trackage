import type { TrackedPackage, TrackedProject } from '~/data/projects.config'
import { bridgeColor } from '~/utils/colors'
import { packageKey, type History, type Registry } from '~~/shared/stats'

export interface PackageView {
  registry: Registry
  name: string
  repo: string
  total: number
  last30: number
  sparkline: number[]
  stars: number
}

export interface BridgeView {
  name: string
  color: string
  total: number
  last30: number
  sparkline: number[]
  stars: number
  packages: PackageView[]
}

export interface ProjectView {
  name: string
  combinedTotal: number
  combinedLast7: number
  combinedLast30: number
  sparkline: number[]
  packages: PackageView[]
  bridges: BridgeView[]
  totalStars: number
  bridgesNpmTotal: number
}

export interface Dashboard {
  generatedAt: string
  totalDownloads: number
  totalStars: number
  dates: string[]
  projects: ProjectView[]
}

export function mergeDaily(dailies: Record<string, number>[]): Record<string, number> {
  const combined: Record<string, number> = {}
  for (const daily of dailies) {
    for (const [date, value] of Object.entries(daily)) {
      combined[date] = (combined[date] ?? 0) + value
    }
  }
  return combined
}

function buildDateAxis(history: History, days: number): string[] {
  let latest: string | null = null
  for (const entry of Object.values(history.packages)) {
    for (const date of Object.keys(entry.daily)) {
      if (latest === null || date > latest) {
        latest = date
      }
    }
  }

  if (latest === null) {
    return []
  }

  const end = new Date(`${latest}T00:00:00Z`)
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0)
}

function starsOfDistinctRepos(packages: PackageView[]): number {
  return sum(Array.from(new Map(packages.map(pkg => [pkg.repo, pkg.stars])).values()))
}

export function buildDashboard(projects: TrackedProject[], history: History): Dashboard {
  const starsByRepo = new Map<string, number>()
  const dates = buildDateAxis(history, 30)

  const dailyOf = (pkg: TrackedPackage) => history.packages[packageKey(pkg.registry, pkg.name)]?.daily ?? {}
  const align = (daily: Record<string, number>) => dates.map(d => daily[d] ?? 0)

  function packageView(pkg: TrackedPackage): PackageView {
    const entry = history.packages[packageKey(pkg.registry, pkg.name)]
    const aligned = align(entry?.daily ?? {})

    return {
      registry: pkg.registry,
      name: pkg.name,
      repo: pkg.repo,
      total: entry?.total ?? 0,
      last30: sum(aligned),
      sparkline: aligned,
      stars: entry?.stars ?? 0
    }
  }

  const projectViews: ProjectView[] = projects.map((project) => {
    const packageViews = project.packages.map(packageView)
    const combinedAligned = align(mergeDaily(project.packages.map(dailyOf)))

    const bridges: BridgeView[] = (project.bridges ?? []).map((bridge, index) => {
      const views = bridge.packages.map(packageView)
      const sparkline = align(mergeDaily(bridge.packages.filter(pkg => pkg.registry === 'packagist').map(dailyOf)))

      return {
        name: bridge.name,
        color: bridgeColor(index),
        total: sum(views.filter(view => view.registry === 'packagist').map(view => view.total)),
        last30: sum(sparkline),
        sparkline,
        stars: starsOfDistinctRepos(views),
        packages: views
      }
    })

    const familyPackages = [...packageViews, ...bridges.flatMap(bridge => bridge.packages)]
    for (const pkg of familyPackages) {
      starsByRepo.set(pkg.repo, pkg.stars)
    }

    return {
      name: project.name,
      combinedTotal: sum(packageViews.map(pkg => pkg.total)),
      combinedLast7: sum(combinedAligned.slice(-7)),
      combinedLast30: sum(combinedAligned),
      sparkline: combinedAligned,
      packages: packageViews,
      bridges,
      totalStars: starsOfDistinctRepos(familyPackages),
      bridgesNpmTotal: sum(bridges.flatMap(bridge => bridge.packages).filter(pkg => pkg.registry === 'npm').map(pkg => pkg.total))
    }
  })

  return {
    generatedAt: history.generatedAt,
    totalDownloads: projectViews.reduce((sum, project) => sum + project.combinedTotal, 0),
    totalStars: Array.from(starsByRepo.values()).reduce((sum, stars) => sum + stars, 0),
    dates,
    projects: projectViews
  }
}
