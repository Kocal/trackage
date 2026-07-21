export type Registry = 'npm' | 'packagist'

export interface Snapshot {
  date: string
  total: number
  last30: number
  lastDay: number
  stars: number
}

export interface History {
  generatedAt: string
  packages: Record<string, Snapshot[]>
}

export function packageKey(registry: Registry, name: string): string {
  return `${registry}:${name}`
}

export function mergeSnapshot(series: Snapshot[] | undefined, snapshot: Snapshot): Snapshot[] {
  const rest = (series ?? []).filter(s => s.date !== snapshot.date)
  return [...rest, snapshot].sort((a, b) => a.date.localeCompare(b.date))
}

export function sparklineFromSeries(series: Snapshot[], days = 30): number[] {
  return series.slice(-days).map(s => s.lastDay)
}
