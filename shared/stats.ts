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

export function projectSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
