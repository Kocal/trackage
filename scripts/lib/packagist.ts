export async function fetchPackagistTotal(name: string, fetchFn: typeof fetch = fetch): Promise<{ total: number }> {
  const res = await fetchFn(`https://packagist.org/packages/${name}.json`)
  if (!res.ok) {
    throw new Error(`packagist ${name} -> ${(res as Response).status}`)
  }
  const json = await res.json() as { package?: { downloads?: { total?: number } } }
  return { total: json.package?.downloads?.total ?? 0 }
}

export function parsePackagistDaily(json: unknown, name: string): Record<string, number> {
  const data = json as { labels?: string[], values?: Record<string, number[]> }
  const labels = data.labels ?? []
  const values = data.values?.[name] ?? []
  const map: Record<string, number> = {}
  labels.forEach((date, i) => {
    const v = values[i]
    if (typeof v === 'number' && v > 0) {
      map[date] = v
    }
  })
  return map
}

export async function fetchPackagistDaily(name: string, from: string, fetchFn: typeof fetch = fetch): Promise<Record<string, number>> {
  const res = await fetchFn(`https://packagist.org/packages/${name}/stats/all.json?average=daily&from=${from}`)
  if (!res.ok) {
    throw new Error(`packagist daily ${name} -> ${(res as Response).status}`)
  }
  return parsePackagistDaily(await res.json(), name)
}
