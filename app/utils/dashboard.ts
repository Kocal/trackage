import type { TrackedProject } from '~/data/projects.config'
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

export interface ProjectView {
  name: string
  combinedTotal: number
  combinedLast7: number
  combinedLast30: number
  sparkline: number[]
  packages: PackageView[]
}

export interface Dashboard {
  generatedAt: string
  totalDownloads: number
  totalStars: number
  dates: string[]
  projects: ProjectView[]
}

function mergeDaily(dailies: Record<string, number>[]): Record<string, number> {
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

export function buildDashboard(projects: TrackedProject[], history: History): Dashboard {
  const starsByRepo = new Map<string, number>()
  const dates = buildDateAxis(history, 30)

  const projectViews: ProjectView[] = projects.map((project) => {
    const dailies: Record<string, number>[] = []

    const packageViews: PackageView[] = project.packages.map((pkg) => {
      const entry = history.packages[packageKey(pkg.registry, pkg.name)]
      const daily = entry?.daily ?? {}
      const total = entry?.total ?? 0
      const stars = entry?.stars ?? 0

      starsByRepo.set(pkg.repo, stars)
      dailies.push(daily)

      const aligned = dates.map(d => daily[d] ?? 0)

      return {
        registry: pkg.registry,
        name: pkg.name,
        repo: pkg.repo,
        total,
        last30: aligned.reduce((sum, v) => sum + v, 0),
        sparkline: aligned,
        stars
      }
    })

    const combinedDaily = mergeDaily(dailies)
    const combinedAligned = dates.map(d => combinedDaily[d] ?? 0)

    return {
      name: project.name,
      combinedTotal: packageViews.reduce((sum, pkg) => sum + pkg.total, 0),
      combinedLast7: combinedAligned.slice(-7).reduce((sum, v) => sum + v, 0),
      combinedLast30: combinedAligned.reduce((sum, v) => sum + v, 0),
      sparkline: combinedAligned,
      packages: packageViews
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
