import type { TrackedProject } from '~/data/projects.config'
import { packageKey, sparklineSeries, sumLastNDays, type History, type Registry } from '~~/shared/stats'

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
  combinedLast30: number
  sparkline: number[]
  packages: PackageView[]
}

export interface Dashboard {
  generatedAt: string
  totalDownloads: number
  totalStars: number
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

export function buildDashboard(projects: TrackedProject[], history: History): Dashboard {
  const starsByRepo = new Map<string, number>()

  const projectViews: ProjectView[] = projects.map((project) => {
    const dailies: Record<string, number>[] = []

    const packageViews: PackageView[] = project.packages.map((pkg) => {
      const entry = history.packages[packageKey(pkg.registry, pkg.name)]
      const daily = entry?.daily ?? {}
      const total = entry?.total ?? 0
      const stars = entry?.stars ?? 0

      starsByRepo.set(pkg.repo, stars)
      dailies.push(daily)

      return {
        registry: pkg.registry,
        name: pkg.name,
        repo: pkg.repo,
        total,
        last30: sumLastNDays(daily, 30),
        sparkline: sparklineSeries(daily, 30),
        stars
      }
    })

    const combinedDaily = mergeDaily(dailies)

    return {
      name: project.name,
      combinedTotal: packageViews.reduce((sum, pkg) => sum + pkg.total, 0),
      combinedLast30: sumLastNDays(combinedDaily, 30),
      sparkline: sparklineSeries(combinedDaily, 30),
      packages: packageViews
    }
  })

  return {
    generatedAt: history.generatedAt,
    totalDownloads: projectViews.reduce((sum, project) => sum + project.combinedTotal, 0),
    totalStars: Array.from(starsByRepo.values()).reduce((sum, stars) => sum + stars, 0),
    projects: projectViews
  }
}
