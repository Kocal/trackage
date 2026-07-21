export interface PackagistStats {
  total: number
  last30: number
  lastDay: number
  stars: number
}

export function parsePackagist(json: unknown): PackagistStats {
  const pkg = (json as { package?: { downloads?: Record<string, number>, favers?: number } }).package
  const downloads = pkg?.downloads ?? {}
  return {
    total: downloads.total ?? 0,
    last30: downloads.monthly ?? 0,
    lastDay: downloads.daily ?? 0,
    stars: pkg?.favers ?? 0
  }
}

export async function fetchPackagist(name: string, fetchFn: typeof fetch = fetch): Promise<PackagistStats> {
  const res = await fetchFn(`https://packagist.org/packages/${name}.json`)
  if (!res.ok) {
    throw new Error(`packagist ${name} -> ${res.status}`)
  }
  return parsePackagist(await res.json())
}
