export type Registry = 'npm' | 'packagist'

export interface PackageHistory {
  total: number
  stars: number
  daily: Record<string, number>
}

export interface History {
  generatedAt: string
  packages: Record<string, PackageHistory>
}

export function packageKey(registry: Registry, name: string): string {
  return `${registry}:${name}`
}

export function sumDaily(daily: Record<string, number>): number {
  return Object.values(daily).reduce((sum, v) => sum + v, 0)
}

export function sumLastNDays(daily: Record<string, number>, n: number): number {
  const dates = Object.keys(daily).sort().slice(-n)
  return dates.reduce((sum, d) => sum + (daily[d] ?? 0), 0)
}

export function sparklineSeries(daily: Record<string, number>, n = 30): number[] {
  const dates = Object.keys(daily).sort().slice(-n)
  return dates.map(d => daily[d] ?? 0)
}
