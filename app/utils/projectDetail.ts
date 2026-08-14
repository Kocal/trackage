import type { TrackedProject } from '~/data/projects.config'
import { mergeDaily } from '~/utils/dashboard'
import { packageKey, type History, type Registry } from '~~/shared/stats'

export interface PackageDetail {
  registry: Registry
  name: string
  repo: string
  packageUrl: string
  githubUrl: string
  total: number
  last7: number
  last30: number
  stars: number
  series: number[]
  chartSeries: number[]
}

export interface ProjectDetail {
  name: string
  dates: string[]
  chartDates: string[]
  packages: PackageDetail[]
  combinedTotal: number
  totalStars: number
  totals: { d7: number, d30: number, d90: number, d365: number, all: number }
  peakDay: { date: string, downloads: number } | null
  averagePerDay: number
  firstTrackedDate: string | null
}

function packageUrl(registry: Registry, name: string): string {
  return registry === 'npm'
    ? `https://www.npmjs.com/package/${name}`
    : `https://packagist.org/packages/${name}`
}

function continuousAxis(daily: Record<string, number>): string[] {
  const keys = Object.keys(daily).sort()
  const first = keys[0]
  const last = keys[keys.length - 1]
  if (!first || !last) {
    return []
  }
  const end = new Date(`${last}T00:00:00Z`)
  const dates: string[] = []
  const cursor = new Date(`${first}T00:00:00Z`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

function sumLastN(values: number[], n: number): number {
  return values.slice(-n).reduce((sum, v) => sum + v, 0)
}

const CHART_BUCKET_DAYS = 7

function bucketDates(dates: string[], size: number): string[] {
  const out: string[] = []
  for (let i = 0; i < dates.length; i += size) {
    const start = dates[i]
    if (start !== undefined) {
      out.push(start)
    }
  }
  return out
}

function bucketSum(series: number[], size: number): number[] {
  const out: number[] = []
  for (let i = 0; i < series.length; i += size) {
    let sum = 0
    for (let j = i; j < i + size && j < series.length; j++) {
      sum += series[j] ?? 0
    }
    out.push(sum)
  }
  return out
}

export function buildProjectDetail(project: TrackedProject, history: History): ProjectDetail {
  const dailies = project.packages.map(p => history.packages[packageKey(p.registry, p.name)]?.daily ?? {})
  const combinedDaily = mergeDaily(dailies)
  const dates = continuousAxis(combinedDaily)
  const combinedAligned = dates.map(d => combinedDaily[d] ?? 0)

  const starsByRepo = new Map<string, number>()
  const packages: PackageDetail[] = project.packages.map((p) => {
    const entry = history.packages[packageKey(p.registry, p.name)]
    const daily = entry?.daily ?? {}
    const series = dates.map(d => daily[d] ?? 0)
    starsByRepo.set(p.repo, entry?.stars ?? 0)
    return {
      registry: p.registry,
      name: p.name,
      repo: p.repo,
      packageUrl: packageUrl(p.registry, p.name),
      githubUrl: `https://github.com/${p.repo}`,
      total: entry?.total ?? 0,
      last7: sumLastN(series, 7),
      last30: sumLastN(series, 30),
      stars: entry?.stars ?? 0,
      series,
      chartSeries: bucketSum(series, CHART_BUCKET_DAYS)
    }
  })

  let peakDay: { date: string, downloads: number } | null = null
  for (const date of dates) {
    const downloads = combinedDaily[date] ?? 0
    if (downloads > 0 && (!peakDay || downloads > peakDay.downloads)) {
      peakDay = { date, downloads }
    }
  }

  const combinedTotal = packages.reduce((sum, p) => sum + p.total, 0)
  const dailySum = combinedAligned.reduce((sum, v) => sum + v, 0)

  return {
    name: project.name,
    dates,
    chartDates: bucketDates(dates, CHART_BUCKET_DAYS),
    packages,
    combinedTotal,
    totalStars: Array.from(starsByRepo.values()).reduce((sum, v) => sum + v, 0),
    totals: {
      d7: sumLastN(combinedAligned, 7),
      d30: sumLastN(combinedAligned, 30),
      d90: sumLastN(combinedAligned, 90),
      d365: sumLastN(combinedAligned, 365),
      all: combinedTotal
    },
    peakDay,
    averagePerDay: dates.length ? Math.round(dailySum / dates.length) : 0,
    firstTrackedDate: dates[0] ?? null
  }
}
