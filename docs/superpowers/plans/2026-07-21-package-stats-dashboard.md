# Package-Stats Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single static Nuxt page showing download + star stats for ~16 npm/Packagist packages, refreshed daily by a GitHub Action that commits a JSON history file.

**Architecture:** A Node script (`scripts/fetch-stats.ts`) fetches stats from npm/Packagist/GitHub and appends dated snapshots to `data/history.json`. A daily GitHub Action runs it and commits the file; the push triggers a Cloudflare Pages rebuild. Nuxt imports the committed JSON at build time (SSG) and renders a grid of project tiles. Linked PHP+JS packages are grouped into one tile with a combined headline.

**Tech Stack:** Nuxt 4.4, Nuxt UI v4, Tailwind 4, TypeScript, pnpm, tsx, vitest, Cloudflare Pages.

## Global Constraints

- Package manager: **pnpm** (`pnpm@11.13.1`). Never use npm/yarn to install.
- Node 22 (matches CI matrix).
- ESLint stylistic rules already configured: `commaDangle: 'never'`, `braceStyle: '1tbs'`. Run `pnpm lint --fix` before committing; every task must leave `pnpm lint` and `pnpm typecheck` green.
- Nuxt 4 path aliases: `~` = `app/`, `~~` = repo root. Config lives at `app/data/projects.config.ts` (`~/data/...`); data lives at `data/history.json` (`~~/data/...`).
- No code comments unless the "why" is non-obvious (project convention).
- Package key is `` `${registry}:${name}` ``.
- npm all-time totals MUST use the `/downloads/range/` endpoint chunked at ≤500 days (the `/point/` endpoint silently truncates at 18 months).

> **SEE "Revision 1" BELOW — it supersedes Tasks 2, 4, 5, 7, 8 and the data model.** The original tasks stored a pre-aggregated `{ date, total, last30, lastDay, stars }` snapshot. Revision 1 changes this to a **day-by-day model**: persist the full all-time daily download series per package; compute `total`/`last30`/sparkline **app-side**. GitHub stars come from each package's **own repo** (Symfony UX packages use their split repos, e.g. `symfony/ux-vue`, not the `symfony/ux` monorepo).

---

### Task 1: Baseline — commit scaffold, add tsx + vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `test/smoke.test.ts`
- Modify: `package.json` (scripts + devDeps)

**Interfaces:**
- Produces: `pnpm test` (vitest), `pnpm stats` (tsx runner) available for later tasks.

- [ ] **Step 1: Make the initial commit of the existing scaffold**

```bash
git add -A
git commit -m "chore: initial Nuxt UI scaffold"
```

- [ ] **Step 2: Add tooling deps**

```bash
pnpm add -D tsx vitest
```

- [ ] **Step 3: Add scripts to `package.json`**

In the `"scripts"` block add:

```json
"test": "vitest run",
"stats": "tsx scripts/fetch-stats.ts"
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts']
  }
})
```

- [ ] **Step 5: Create `test/smoke.test.ts`**

```ts
import { expect, it } from 'vitest'

it('runs', () => {
  expect(1 + 1).toBe(2)
})
```

- [ ] **Step 6: Run tests, verify pass**

Run: `pnpm test`
Expected: 1 passing test.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts test/smoke.test.ts
git commit -m "chore: add tsx and vitest"
```

---

### Task 2: Shared types + snapshot/history helpers

**Files:**
- Create: `shared/stats.ts`
- Create: `test/stats-history.test.ts`

**Interfaces:**
- Produces:
  - `type Registry = 'npm' | 'packagist'`
  - `interface Snapshot { date: string; total: number; last30: number; lastDay: number; stars: number }`
  - `interface History { generatedAt: string; packages: Record<string, Snapshot[]> }`
  - `packageKey(registry: Registry, name: string): string`
  - `mergeSnapshot(series: Snapshot[] | undefined, snapshot: Snapshot): Snapshot[]`
  - `sparklineFromSeries(series: Snapshot[], days?: number): number[]`

Note: `shared/` is chosen so both the Node script and the Nuxt app import the same types (Nuxt 4 exposes `~~/shared`). No Nuxt runtime imports here — pure TS.

- [ ] **Step 1: Write the failing test — `test/stats-history.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { mergeSnapshot, packageKey, sparklineFromSeries, type Snapshot } from '../shared/stats'

const snap = (date: string, lastDay: number): Snapshot => ({ date, total: 100, last30: 30, lastDay, stars: 5 })

describe('packageKey', () => {
  it('joins registry and name', () => {
    expect(packageKey('npm', '@symfony/ux-vue')).toBe('npm:@symfony/ux-vue')
  })
})

describe('mergeSnapshot', () => {
  it('appends and keeps date order', () => {
    const out = mergeSnapshot([snap('2026-07-19', 1)], snap('2026-07-20', 2))
    expect(out.map(s => s.date)).toEqual(['2026-07-19', '2026-07-20'])
  })

  it('overwrites same-day snapshot (idempotent)', () => {
    const out = mergeSnapshot([snap('2026-07-20', 1)], snap('2026-07-20', 9))
    expect(out).toHaveLength(1)
    expect(out[0].lastDay).toBe(9)
  })

  it('handles undefined series', () => {
    expect(mergeSnapshot(undefined, snap('2026-07-20', 1))).toHaveLength(1)
  })
})

describe('sparklineFromSeries', () => {
  it('returns the last N lastDay values', () => {
    const series = [snap('2026-07-18', 1), snap('2026-07-19', 2), snap('2026-07-20', 3)]
    expect(sparklineFromSeries(series, 2)).toEqual([2, 3])
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm test test/stats-history.test.ts`
Expected: FAIL (cannot find module `../shared/stats`).

- [ ] **Step 3: Implement `shared/stats.ts`**

```ts
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
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm test test/stats-history.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/stats.ts test/stats-history.test.ts
git commit -m "feat: add shared stats types and history helpers"
```

---

### Task 3: Tracked-projects config

**Files:**
- Create: `app/data/projects.config.ts`
- Create: `test/projects-config.test.ts`

**Interfaces:**
- Produces:
  - `interface TrackedPackage { registry: Registry; name: string; repo: string }`
  - `interface TrackedProject { name: string; packages: TrackedPackage[] }`
  - `const projects: TrackedProject[]`

- [ ] **Step 1: Write the failing test — `test/projects-config.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { projects } from '../app/data/projects.config'
import { packageKey } from '../shared/stats'

describe('projects config', () => {
  it('has projects', () => {
    expect(projects.length).toBeGreaterThan(10)
  })

  it('every package has a valid registry, name and owner/name repo', () => {
    for (const project of projects) {
      expect(project.packages.length).toBeGreaterThan(0)
      for (const pkg of project.packages) {
        expect(['npm', 'packagist']).toContain(pkg.registry)
        expect(pkg.name.length).toBeGreaterThan(0)
        expect(pkg.repo).toMatch(/^[^/]+\/[^/]+$/)
      }
    }
  })

  it('has no duplicate package keys', () => {
    const keys = projects.flatMap(p => p.packages.map(pkg => packageKey(pkg.registry, pkg.name)))
    expect(new Set(keys).size).toBe(keys.length)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm test test/projects-config.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `app/data/projects.config.ts`**

Only include an npm package if it actually resolves on the registry — verify each `@symfony/ux-*` with `curl -sI https://registry.npmjs.org/@symfony/ux-vue | head -1` (200 = exists) before adding it. Start from this list and drop npm entries that 404:

```ts
import type { Registry } from '~~/shared/stats'

export interface TrackedPackage {
  registry: Registry
  name: string
  repo: string
}

export interface TrackedProject {
  name: string
  packages: TrackedPackage[]
}

export const projects: TrackedProject[] = [
  {
    name: 'Webpack Encore',
    packages: [
      { registry: 'npm', name: '@symfony/webpack-encore', repo: 'symfony/webpack-encore' },
      { registry: 'packagist', name: 'symfony/webpack-encore-bundle', repo: 'symfony/webpack-encore-bundle' }
    ]
  },
  {
    name: 'Reprise',
    packages: [
      { registry: 'npm', name: '@symfony/reprise', repo: 'symfony/reprise' },
      { registry: 'packagist', name: 'symfony/reprise', repo: 'symfony/reprise' }
    ]
  },
  {
    name: 'UX Vue',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-vue', repo: 'symfony/ux' },
      { registry: 'npm', name: '@symfony/ux-vue', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX Translator',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-translator', repo: 'symfony/ux' },
      { registry: 'npm', name: '@symfony/ux-translator', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX Toolkit',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-toolkit', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX React',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-react', repo: 'symfony/ux' },
      { registry: 'npm', name: '@symfony/ux-react', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX Native',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-native', repo: 'symfony/ux' },
      { registry: 'npm', name: '@symfony/ux-native', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX Leaflet Map',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-leaflet-map', repo: 'symfony/ux' },
      { registry: 'npm', name: '@symfony/ux-leaflet-map', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX Google Map',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-google-map', repo: 'symfony/ux' },
      { registry: 'npm', name: '@symfony/ux-google-map', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX Map',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-map', repo: 'symfony/ux' },
      { registry: 'npm', name: '@symfony/ux-map', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX Calendar Link',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-calendar-link', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'PHPStan Symfony UX',
    packages: [
      { registry: 'packagist', name: 'kocal/phpstan-symfony-ux', repo: 'kocal/phpstan-symfony-ux' }
    ]
  },
  {
    name: 'Biome.js Bundle',
    packages: [
      { registry: 'packagist', name: 'kocal/biome-js-bundle', repo: 'kocal/biome-js-bundle' }
    ]
  },
  {
    name: 'Symfony Mailer Testing',
    packages: [
      { registry: 'packagist', name: 'kocal/symfony-mailer-testing', repo: 'kocal/symfony-mailer-testing' }
    ]
  },
  {
    name: 'Oxc Bundle',
    packages: [
      { registry: 'packagist', name: 'kocal/oxc-bundle', repo: 'kocal/oxc-bundle' }
    ]
  }
]
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm test test/projects-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/data/projects.config.ts test/projects-config.test.ts
git commit -m "feat: add tracked-projects config"
```

---

### Task 4: npm fetcher (range chunking + aggregation)

**Files:**
- Create: `scripts/lib/npm.ts`
- Create: `test/npm.test.ts`

**Interfaces:**
- Produces:
  - `interface NpmDay { day: string; downloads: number }`
  - `chunkRanges(start: string, end: string, size?: number): Array<[string, string]>`
  - `aggregate(days: NpmDay[]): { total: number; last30: number; lastDay: number }`
  - `fetchNpmDays(pkg: string, end: string, fetchFn?: typeof fetch): Promise<NpmDay[]>`

- [ ] **Step 1: Write the failing test — `test/npm.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { aggregate, chunkRanges, fetchNpmDays } from '../scripts/lib/npm'

describe('chunkRanges', () => {
  it('splits into <=size-day windows covering the whole span', () => {
    const ranges = chunkRanges('2015-01-01', '2016-12-31', 500)
    expect(ranges[0][0]).toBe('2015-01-01')
    expect(ranges.at(-1)![1]).toBe('2016-12-31')
    for (const [s, e] of ranges) {
      const span = (Date.parse(e) - Date.parse(s)) / 86400000
      expect(span).toBeLessThanOrEqual(499)
    }
  })

  it('is contiguous with no gaps or overlaps', () => {
    const ranges = chunkRanges('2020-01-01', '2021-06-01', 500)
    for (let i = 1; i < ranges.length; i++) {
      const prevEnd = Date.parse(ranges[i - 1][1])
      const thisStart = Date.parse(ranges[i][0])
      expect(thisStart - prevEnd).toBe(86400000)
    }
  })
})

describe('aggregate', () => {
  it('computes total, last30 and lastDay', () => {
    const days = Array.from({ length: 40 }, (_, i) => ({
      day: `2026-06-${String(i + 1).padStart(2, '0')}`,
      downloads: i + 1
    }))
    const out = aggregate(days)
    expect(out.total).toBe(820)
    expect(out.lastDay).toBe(40)
    expect(out.last30).toBe(Array.from({ length: 30 }, (_, i) => i + 11).reduce((a, b) => a + b, 0))
  })

  it('is safe on empty input', () => {
    expect(aggregate([])).toEqual({ total: 0, last30: 0, lastDay: 0 })
  })
})

describe('fetchNpmDays', () => {
  it('merges downloads across chunks', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ downloads: [{ day: '2026-06-01', downloads: 5 }] })
    })) as unknown as typeof fetch
    const days = await fetchNpmDays('@symfony/ux-vue', '2015-06-01', fetchFn)
    expect(days.length).toBeGreaterThan(0)
    expect(days[0].downloads).toBe(5)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm test test/npm.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `scripts/lib/npm.ts`**

```ts
export interface NpmDay {
  day: string
  downloads: number
}

const NPM_EPOCH = '2015-01-10'

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function chunkRanges(start: string, end: string, size = 500): Array<[string, string]> {
  const ranges: Array<[string, string]> = []
  const endDate = new Date(`${end}T00:00:00Z`)
  let cursor = new Date(`${start}T00:00:00Z`)
  while (cursor <= endDate) {
    const chunkEnd = new Date(cursor)
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + size - 1)
    const clamped = chunkEnd > endDate ? endDate : chunkEnd
    ranges.push([iso(cursor), iso(clamped)])
    cursor = new Date(clamped)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return ranges
}

export function aggregate(days: NpmDay[]): { total: number; last30: number; lastDay: number } {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day))
  const total = sorted.reduce((sum, d) => sum + d.downloads, 0)
  const last30 = sorted.slice(-30).reduce((sum, d) => sum + d.downloads, 0)
  const lastDay = sorted.length ? sorted[sorted.length - 1].downloads : 0
  return { total, last30, lastDay }
}

export async function fetchNpmDays(pkg: string, end: string, fetchFn: typeof fetch = fetch): Promise<NpmDay[]> {
  const out: NpmDay[] = []
  for (const [start, chunkEnd] of chunkRanges(NPM_EPOCH, end)) {
    const url = `https://api.npmjs.org/downloads/range/${start}:${chunkEnd}/${pkg}`
    const res = await fetchFn(url)
    if (!res.ok) {
      if (res.status === 404) break
      throw new Error(`npm ${pkg} ${start}:${chunkEnd} -> ${res.status}`)
    }
    const json = await res.json() as { downloads?: NpmDay[] }
    for (const d of json.downloads ?? []) {
      if (d.downloads > 0) out.push(d)
    }
  }
  return out
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm test test/npm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/npm.ts test/npm.test.ts
git commit -m "feat: add npm range fetcher and aggregation"
```

---

### Task 5: Packagist fetcher

**Files:**
- Create: `scripts/lib/packagist.ts`
- Create: `test/packagist.test.ts`

**Interfaces:**
- Produces:
  - `interface PackagistStats { total: number; last30: number; lastDay: number; stars: number }`
  - `parsePackagist(json: unknown): PackagistStats`
  - `fetchPackagist(name: string, fetchFn?: typeof fetch): Promise<PackagistStats>`

- [ ] **Step 1: Write the failing test — `test/packagist.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { fetchPackagist, parsePackagist } from '../scripts/lib/packagist'

const payload = {
  package: {
    downloads: { total: 5000000, monthly: 120000, daily: 4000 },
    favers: 880,
    repository: 'https://github.com/symfony/webpack-encore-bundle'
  }
}

describe('parsePackagist', () => {
  it('maps downloads and favers', () => {
    expect(parsePackagist(payload)).toEqual({ total: 5000000, last30: 120000, lastDay: 4000, stars: 880 })
  })

  it('defaults missing fields to 0', () => {
    expect(parsePackagist({ package: { downloads: {} } })).toEqual({ total: 0, last30: 0, lastDay: 0, stars: 0 })
  })
})

describe('fetchPackagist', () => {
  it('requests the package json endpoint', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => payload })) as unknown as typeof fetch
    await fetchPackagist('symfony/webpack-encore-bundle', fetchFn)
    expect(fetchFn).toHaveBeenCalledWith('https://packagist.org/packages/symfony/webpack-encore-bundle.json')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm test test/packagist.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `scripts/lib/packagist.ts`**

```ts
export interface PackagistStats {
  total: number
  last30: number
  lastDay: number
  stars: number
}

export function parsePackagist(json: unknown): PackagistStats {
  const pkg = (json as { package?: { downloads?: Record<string, number>; favers?: number } }).package
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
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm test test/packagist.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/packagist.ts test/packagist.test.ts
git commit -m "feat: add packagist fetcher"
```

---

### Task 6: GitHub stars fetcher

**Files:**
- Create: `scripts/lib/github.ts`
- Create: `test/github.test.ts`

**Interfaces:**
- Produces: `fetchStars(repo: string, token: string, fetchFn?: typeof fetch): Promise<number>`

- [ ] **Step 1: Write the failing test — `test/github.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { fetchStars } from '../scripts/lib/github'

describe('fetchStars', () => {
  it('returns stargazers_count', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ stargazers_count: 1234 }) })) as unknown as typeof fetch
    expect(await fetchStars('symfony/ux', 'tok', fetchFn)).toBe(1234)
  })

  it('sends auth header when token present', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ stargazers_count: 1 }) })) as unknown as typeof fetch
    await fetchStars('symfony/ux', 'tok', fetchFn)
    const headers = (fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as { headers: Record<string, string> }
    expect(headers.headers.Authorization).toBe('Bearer tok')
  })

  it('throws on non-ok', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch
    await expect(fetchStars('x/y', '', fetchFn)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm test test/github.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `scripts/lib/github.ts`**

```ts
export async function fetchStars(repo: string, token: string, fetchFn: typeof fetch = fetch): Promise<number> {
  const res = await fetchFn(`https://api.github.com/repos/${repo}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'trackage',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })
  if (!res.ok) {
    throw new Error(`github ${repo} -> ${(res as Response).status}`)
  }
  const json = await res.json() as { stargazers_count?: number }
  return json.stargazers_count ?? 0
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm test test/github.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/github.ts test/github.test.ts
git commit -m "feat: add github stars fetcher"
```

---

### Task 7: Orchestrator script + real data seed

**Files:**
- Create: `scripts/fetch-stats.ts`
- Create: `data/history.json` (generated by running the script)

**Interfaces:**
- Consumes: `projects` (Task 3), `fetchNpmDays`/`aggregate` (Task 4), `fetchPackagist` (Task 5), `fetchStars` (Task 6), `packageKey`/`mergeSnapshot`/`History`/`Snapshot` (Task 2).
- Produces: `data/history.json` on disk conforming to `History`.

This task's deliverable is verified by running it against live APIs, not a unit test (it is thin glue).

- [ ] **Step 1: Implement `scripts/fetch-stats.ts`**

```ts
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { projects } from '../app/data/projects.config'
import { fetchStars } from './lib/github'
import { aggregate, fetchNpmDays } from './lib/npm'
import { fetchPackagist } from './lib/packagist'
import { mergeSnapshot, packageKey, type History, type Snapshot } from '../shared/stats'

const HISTORY_PATH = new URL('../data/history.json', import.meta.url)
const token = process.env.GITHUB_TOKEN ?? ''
const today = new Date().toISOString().slice(0, 10)

async function loadHistory(): Promise<History> {
  try {
    return JSON.parse(await readFile(HISTORY_PATH, 'utf8')) as History
  } catch {
    return { generatedAt: '', packages: {} }
  }
}

async function statsFor(registry: string, name: string, repo: string): Promise<Omit<Snapshot, 'date'>> {
  const stars = await fetchStars(repo, token).catch(() => 0)
  if (registry === 'npm') {
    const { total, last30, lastDay } = aggregate(await fetchNpmDays(name, today))
    return { total, last30, lastDay, stars }
  }
  const { total, last30, lastDay } = await fetchPackagist(name)
  return { total, last30, lastDay, stars }
}

async function main() {
  const history = await loadHistory()
  for (const project of projects) {
    for (const pkg of project.packages) {
      const key = packageKey(pkg.registry, pkg.name)
      try {
        const stats = await statsFor(pkg.registry, pkg.name, pkg.repo)
        history.packages[key] = mergeSnapshot(history.packages[key], { date: today, ...stats })
        console.log(`ok  ${key}  total=${stats.total} stars=${stats.stars}`)
      } catch (err) {
        console.error(`fail ${key}: ${(err as Error).message}`)
      }
    }
  }
  history.generatedAt = new Date().toISOString()
  await mkdir(new URL('../data/', import.meta.url), { recursive: true })
  await writeFile(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`)
  console.log(`wrote ${HISTORY_PATH.pathname}`)
}

main()
```

- [ ] **Step 2: Run it against live APIs**

Run: `pnpm stats`
Expected: one `ok <key> …` line per package, ends with `wrote …/data/history.json`. Some npm 404s (nonexistent `@symfony/ux-*`) are acceptable — but if a package you kept in the config 404s, remove that npm entry from `app/data/projects.config.ts` and re-run.

- [ ] **Step 3: Spot-check the numbers**

Open `data/history.json`. Pick `packagist:symfony/webpack-encore-bundle` and compare `total` to the count on its Packagist page. They should match closely.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-stats.ts data/history.json app/data/projects.config.ts
git commit -m "feat: add stats orchestrator and seed history"
```

---

### Task 8: Dashboard view-model derivation

**Files:**
- Create: `app/utils/dashboard.ts`
- Create: `test/dashboard.test.ts`

**Interfaces:**
- Consumes: `projects`/`TrackedProject` (Task 3), `History`/`Snapshot`/`sparklineFromSeries`/`packageKey` (Task 2).
- Produces:
  - `interface PackageView { registry: Registry; name: string; repo: string; total: number; last30: number; lastDay: number; stars: number; sparkline: number[] }`
  - `interface ProjectView { name: string; combinedTotal: number; combinedLast30: number; combinedLastDay: number; packages: PackageView[]; sparkline: number[] }`
  - `interface Dashboard { generatedAt: string; totalDownloads: number; totalStars: number; projects: ProjectView[] }`
  - `buildDashboard(projects: TrackedProject[], history: History): Dashboard`

- [ ] **Step 1: Write the failing test — `test/dashboard.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { buildDashboard } from '../app/utils/dashboard'
import type { History } from '../shared/stats'
import type { TrackedProject } from '../app/data/projects.config'

const projects: TrackedProject[] = [{
  name: 'Webpack Encore',
  packages: [
    { registry: 'npm', name: '@symfony/webpack-encore', repo: 'symfony/webpack-encore' },
    { registry: 'packagist', name: 'symfony/webpack-encore-bundle', repo: 'symfony/webpack-encore-bundle' }
  ]
}]

const history: History = {
  generatedAt: '2026-07-21T04:00:00.000Z',
  packages: {
    'npm:@symfony/webpack-encore': [
      { date: '2026-07-20', total: 100, last30: 30, lastDay: 3, stars: 800 },
      { date: '2026-07-21', total: 110, last30: 33, lastDay: 4, stars: 810 }
    ],
    'packagist:symfony/webpack-encore-bundle': [
      { date: '2026-07-21', total: 1000, last30: 300, lastDay: 40, stars: 700 }
    ]
  }
}

describe('buildDashboard', () => {
  it('combines totals across a project\'s packages', () => {
    const dash = buildDashboard(projects, history)
    const project = dash.projects[0]
    expect(project.combinedTotal).toBe(1110)
    expect(project.combinedLastDay).toBe(44)
    expect(project.packages).toHaveLength(2)
  })

  it('uses the latest snapshot per package', () => {
    const dash = buildDashboard(projects, history)
    const npm = dash.projects[0].packages.find(p => p.registry === 'npm')!
    expect(npm.total).toBe(110)
    expect(npm.sparkline).toEqual([3, 4])
  })

  it('aggregates dashboard-wide totals', () => {
    const dash = buildDashboard(projects, history)
    expect(dash.totalDownloads).toBe(1110)
    expect(dash.totalStars).toBe(810 + 700)
    expect(dash.generatedAt).toBe('2026-07-21T04:00:00.000Z')
  })

  it('tolerates a package with no history', () => {
    const dash = buildDashboard(projects, { generatedAt: '', packages: {} })
    expect(dash.projects[0].combinedTotal).toBe(0)
    expect(dash.projects[0].packages[0].sparkline).toEqual([])
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm test test/dashboard.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `app/utils/dashboard.ts`**

```ts
import type { TrackedProject } from '~/data/projects.config'
import { packageKey, sparklineFromSeries, type History, type Registry, type Snapshot } from '~~/shared/stats'

export interface PackageView {
  registry: Registry
  name: string
  repo: string
  total: number
  last30: number
  lastDay: number
  stars: number
  sparkline: number[]
}

export interface ProjectView {
  name: string
  combinedTotal: number
  combinedLast30: number
  combinedLastDay: number
  packages: PackageView[]
  sparkline: number[]
}

export interface Dashboard {
  generatedAt: string
  totalDownloads: number
  totalStars: number
  projects: ProjectView[]
}

const EMPTY: Snapshot = { date: '', total: 0, last30: 0, lastDay: 0, stars: 0 }

function sumSparklines(series: number[][]): number[] {
  const width = Math.max(0, ...series.map(s => s.length))
  return Array.from({ length: width }, (_, i) => {
    const col = width - 1 - i
    return series.reduce((sum, s) => sum + (s[s.length - 1 - col] ?? 0), 0)
  })
}

export function buildDashboard(projects: TrackedProject[], history: History): Dashboard {
  const projectViews: ProjectView[] = projects.map((project) => {
    const packages: PackageView[] = project.packages.map((pkg) => {
      const series = history.packages[packageKey(pkg.registry, pkg.name)] ?? []
      const latest = series.at(-1) ?? EMPTY
      return {
        registry: pkg.registry,
        name: pkg.name,
        repo: pkg.repo,
        total: latest.total,
        last30: latest.last30,
        lastDay: latest.lastDay,
        stars: latest.stars,
        sparkline: sparklineFromSeries(series)
      }
    })
    return {
      name: project.name,
      combinedTotal: packages.reduce((s, p) => s + p.total, 0),
      combinedLast30: packages.reduce((s, p) => s + p.last30, 0),
      combinedLastDay: packages.reduce((s, p) => s + p.lastDay, 0),
      packages,
      sparkline: sumSparklines(packages.map(p => p.sparkline))
    }
  })

  return {
    generatedAt: history.generatedAt,
    totalDownloads: projectViews.reduce((s, p) => s + p.combinedTotal, 0),
    totalStars: projectViews.reduce((s, p) => s + p.packages.reduce((ss, pkg) => ss + pkg.stars, 0), 0),
    projects: projectViews
  }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm test test/dashboard.test.ts`
Expected: PASS (all 4 cases; confirm `sumSparklines` right-aligns `[3,4]` + `[40]` to `[3, 44]`).

- [ ] **Step 5: Commit**

```bash
git add app/utils/dashboard.ts test/dashboard.test.ts
git commit -m "feat: derive dashboard view-model from history"
```

---

### Task 9: Sparkline component

**Files:**
- Create: `app/components/Sparkline.vue`

**Interfaces:**
- Consumes: `data: number[]` prop.
- Produces: `<Sparkline :data="[…]" />` inline SVG (auto-imported by Nuxt).

- [ ] **Step 1: Implement `app/components/Sparkline.vue`**

```vue
<script setup lang="ts">
const props = withDefaults(defineProps<{
  data: number[]
  width?: number
  height?: number
}>(), {
  width: 120,
  height: 32
})

const path = computed(() => {
  const data = props.data
  if (data.length < 2) {
    return ''
  }
  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1
  const stepX = props.width / (data.length - 1)
  return data
    .map((value, i) => {
      const x = i * stepX
      const y = props.height - ((value - min) / span) * props.height
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})
</script>

<template>
  <svg
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    class="text-primary"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path
      v-if="path"
      :d="path"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </svg>
</template>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors from `Sparkline.vue`.

- [ ] **Step 3: Commit**

```bash
git add app/components/Sparkline.vue
git commit -m "feat: add SVG sparkline component"
```

---

### Task 10: Project tile component

**Files:**
- Create: `app/components/ProjectTile.vue`

**Interfaces:**
- Consumes: `project: ProjectView` prop (from `~/utils/dashboard`), `<Sparkline>` (Task 9).
- Produces: `<ProjectTile :project="…" />`.

Use Nuxt UI `UCard`, `UBadge`, `UIcon`. Registry icon: `i-simple-icons-npm` for npm, `i-simple-icons-packagist` for packagist; stars use `i-lucide-star`.

- [ ] **Step 1: Implement `app/components/ProjectTile.vue`**

```vue
<script setup lang="ts">
import type { ProjectView } from '~/utils/dashboard'

defineProps<{ project: ProjectView }>()

const nf = new Intl.NumberFormat('en-US')

function registryIcon(registry: string) {
  return registry === 'npm' ? 'i-simple-icons-npm' : 'i-simple-icons-packagist'
}

function registryColor(registry: string) {
  return registry === 'npm' ? 'error' : 'warning'
}
</script>

<template>
  <UCard variant="subtle" class="flex flex-col">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-semibold truncate">
          {{ project.name }}
        </h3>
        <Sparkline :data="project.sparkline" />
      </div>
    </template>

    <div class="flex items-baseline gap-2">
      <span class="text-2xl font-bold tabular-nums">{{ nf.format(project.combinedTotal) }}</span>
      <span class="text-xs text-muted">installs · npm + Packagist</span>
    </div>
    <div class="mt-1 flex gap-4 text-sm text-muted tabular-nums">
      <span>30d {{ nf.format(project.combinedLast30) }}</span>
      <span>24h {{ nf.format(project.combinedLastDay) }}</span>
    </div>

    <div class="mt-4 space-y-2">
      <div
        v-for="pkg in project.packages"
        :key="`${pkg.registry}:${pkg.name}`"
        class="flex items-center justify-between gap-2 text-sm"
      >
        <div class="flex items-center gap-1.5 min-w-0">
          <UIcon :name="registryIcon(pkg.registry)" :class="`text-${registryColor(pkg.registry)}`" />
          <span class="truncate font-mono text-xs">{{ pkg.name }}</span>
        </div>
        <div class="flex items-center gap-3 shrink-0 tabular-nums text-muted">
          <span>{{ nf.format(pkg.total) }}</span>
          <span class="flex items-center gap-0.5">
            <UIcon name="i-lucide-star" class="text-warning" />
            {{ nf.format(pkg.stars) }}
          </span>
        </div>
      </div>
    </div>
  </UCard>
</template>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/ProjectTile.vue
git commit -m "feat: add project tile component"
```

---

### Task 11: Dashboard page + app shell

**Files:**
- Modify: `app/pages/index.vue` (replace scaffold content)
- Modify: `app/app.vue` (rebrand header/footer, drop template menu)
- Delete: `app/components/TemplateMenu.vue` (scaffold leftover)

**Interfaces:**
- Consumes: `projects` (Task 3), `history.json` (Task 7), `buildDashboard` (Task 8), `<ProjectTile>` (Task 10).

- [ ] **Step 1: Replace `app/pages/index.vue`**

```vue
<script setup lang="ts">
import { projects } from '~/data/projects.config'
import { buildDashboard } from '~/utils/dashboard'
import history from '~~/data/history.json'
import type { History } from '~~/shared/stats'

const dashboard = buildDashboard(projects, history as History)
const nf = new Intl.NumberFormat('en-US')
const updated = computed(() => dashboard.generatedAt ? new Date(dashboard.generatedAt).toLocaleString() : 'never')

useSeoMeta({ title: 'trackage', description: 'Download and star stats for my npm and Packagist packages.' })
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">
          trackage
        </h1>
        <p class="text-sm text-muted">
          {{ nf.format(dashboard.totalDownloads) }} downloads · {{ nf.format(dashboard.totalStars) }} stars · updated {{ updated }}
        </p>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ProjectTile v-for="project in dashboard.projects" :key="project.name" :project="project" />
    </div>
  </UContainer>
</template>
```

- [ ] **Step 2: Rebrand `app/app.vue`**

Remove `<TemplateMenu />` from the header `#left`, change the logo link/title, and point the GitHub buttons at the trackage repo. Minimal edit: delete the `<TemplateMenu />` line and replace the two `to="https://github.com/nuxt-ui-templates/starter"` values with `to="https://github.com/kocal/trackage"`. Replace the footer text with `trackage`.

- [ ] **Step 3: Delete the scaffold menu component**

```bash
git rm app/components/TemplateMenu.vue
```

- [ ] **Step 4: Run the dev server and eyeball it**

Run: `pnpm dev`
Open http://localhost:3000. Expected: a header line with aggregate totals, a responsive grid of tiles; grouped projects (Webpack Encore, Reprise, UX Vue…) show a combined headline, a sparkline, and per-package rows with npm/packagist icons + star counts. Toggle dark mode.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm lint --fix && pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: dashboard page and app shell"
```

---

### Task 12: Cloudflare build config

**Files:**
- Modify: `nuxt.config.ts`

**Interfaces:**
- Produces: a Nitro build targeting Cloudflare Pages, `/` prerendered.

- [ ] **Step 1: Add the Cloudflare preset to `nuxt.config.ts`**

Add a `nitro` block (keep existing `routeRules`):

```ts
  nitro: {
    preset: 'cloudflare-pages',
    prerender: {
      routes: ['/']
    }
  },
```

- [ ] **Step 2: Build locally**

Run: `pnpm build`
Expected: build succeeds, produces a Cloudflare Pages output with a prerendered `/`.

- [ ] **Step 3: Commit**

```bash
git add nuxt.config.ts
git commit -m "chore: target cloudflare pages"
```

---

### Task 13: Daily stats GitHub Action

**Files:**
- Create: `.github/workflows/update-stats.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: update-stats

on:
  schedule:
    - cron: '0 4 * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Install pnpm
        uses: pnpm/action-setup@v6

      - name: Install node
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Fetch stats
        run: pnpm stats
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Commit updated history
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/history.json
          git diff --staged --quiet || git commit -m "chore: update stats $(date -u +%F)"
          git push
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/update-stats.yml
git commit -m "ci: daily stats update workflow"
```

---

### Task 14: Docs — README + manual wiring

**Files:**
- Modify: `README.md` (replace the Nuxt-template boilerplate)

**Interfaces:** documents the two steps only the repo owner can do.

- [ ] **Step 1: Rewrite `README.md`**

Cover: what trackage is; `pnpm install`, `pnpm dev`, `pnpm stats`, `pnpm test`; how stats update (daily Action commits `data/history.json` → Cloudflare Pages rebuild); how to add a package (edit `app/data/projects.config.ts`). Include a **Setup (owner)** section:

1. `git remote add origin git@github.com:kocal/trackage.git && git push -u origin main`
2. In Cloudflare dashboard: Pages → connect the GitHub repo, framework preset **Nuxt**, build command `pnpm build`, output directory `dist` (Nitro `cloudflare-pages` preset writes there), auto-deploy on push to `main`.
3. Enable read/write workflow permissions (Settings → Actions → General → Workflow permissions) so the cron can push.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for trackage"
```

---

## Self-Review

**Spec coverage:**
- Data pipeline (script → JSON → Action → Pages) → Tasks 4–7, 12, 13. ✓
- Config single source of truth → Task 3. ✓
- Data model `data/history.json` with daily snapshots + backfill → Tasks 2, 7 (npm range backfills history from 2015; note: Packagist gives only current point values, so packagist sparklines fill in from day 1 forward — acceptable, npm carries deep history). ✓
- npm range/chunking, packagist fields, github stars per package → Tasks 4, 5, 6. ✓
- UI: single page, tile grid, combined headline (labeled), sparkline, per-package breakdown, stars → Tasks 9, 10, 11. ✓
- Cloudflare SSG → Task 12. ✓
- Verification (dev, spot-check, lint/typecheck, preview) → embedded per task + Task 14 manual steps. ✓

**Known limitation surfaced by review:** Packagist exposes no historical time series, so packagist packages' sparklines start empty and grow one point per day of cron runs; npm packages get a full backfilled sparkline immediately. The combined project sparkline is therefore npm-weighted at first. This matches the spec's "accumulate our own snapshots" approach and is acceptable.

**Placeholder scan:** no TBD/TODO; all code steps contain full code. The only intentional runtime verification is the `@symfony/ux-*` npm-existence check in Task 3/7 (documented, with a concrete `curl` command and fallback).

**Type consistency:** `Snapshot`/`History`/`Registry` defined once in `shared/stats.ts` (Task 2) and reused everywhere. `packageKey` signature consistent across Tasks 2, 7, 8. `ProjectView`/`PackageView` defined in Task 8, consumed in Tasks 10, 11. ✓

---

## Revision 1 — day-by-day data model + per-package repos (2026-07-21)

Two user directives after Tasks 1–7 landed:
1. **Stars from each package's own GitHub repo**, not the shared `symfony/ux` monorepo. All 9 Symfony UX packages have their own split repos (`symfony/ux-vue`, `symfony/ux-map`, …, all verified 200). kocal repos need correct casing from each Packagist `repository` field.
2. **Persist per-day downloads; compute last-30 app-side.** Store the **full all-time daily series** per package; the app derives `total`/`last30`/sparkline from it.

Both npm (`/downloads/range/`) and Packagist (`/stats/all.json?average=daily&from=<date>` → `{ labels:[dates], values:{ "<pkg>":[counts] } }`) expose daily time series, so full backfill is possible for both. **Display metrics: `total`, `last30`, 30-day sparkline, GitHub stars.** (No 7d/yesterday shown; last-7 is trivially derivable if wanted later.)

This **supersedes Tasks 2, 4, 5, 7, 8**. Re-executed as R1/R2/R3 below. Tasks 1, 3 (config data, with corrected repos), 6 (github) stay; Tasks 9–14 build on the new view-model.

### New data model — `data/history.json`
```json
{
  "generatedAt": "2026-07-21T04:00:00.000Z",
  "packages": {
    "npm:@symfony/ux-vue": {
      "total": 12345678,
      "stars": 42,
      "daily": { "2021-03-01": 5, "2026-07-21": 130 }
    }
  }
}
```
`total` = authoritative all-time scalar (npm: sum of full range; Packagist: `downloads.total`). `stars` = latest from the package's own repo. `daily` = full all-time date→downloads map.

### Fixed contracts (Revision 1)
- `shared/stats.ts`:
  - `type Registry = 'npm' | 'packagist'`
  - `interface PackageHistory { total: number; stars: number; daily: Record<string, number> }`
  - `interface History { generatedAt: string; packages: Record<string, PackageHistory> }`
  - `interface PackageUpdate { total: number; stars: number; daily: Record<string, number> }`
  - `packageKey(registry, name): string` (unchanged)
  - `mergePackage(existing: PackageHistory | undefined, update: PackageUpdate): PackageHistory` — `daily: { ...existing?.daily, ...update.daily }` (new dates overwrite same date), `total`/`stars` taken from `update`.
  - `sumLastNDays(daily, n): number` — sum of the values for the n most-recent dates (ascending sort by date key, take last n).
  - `sparklineSeries(daily, n = 30): number[]` — the n most-recent daily values in ascending date order.

### R1 — data model + libs (supersedes Tasks 2, 4, 5; folds in Task 3 repo fixes)

**Files:** `shared/stats.ts` (rewrite), `scripts/lib/npm.ts` (harden + daily helper), `scripts/lib/packagist.ts` (total + new daily fetch), `app/data/projects.config.ts` (repo slugs), + their tests. TDD throughout.

- `shared/stats.ts`: implement the contracts above. Tests: `mergePackage` (merge/overwrite/undefined), `sumLastNDays`, `sparklineSeries`.
- `scripts/lib/npm.ts`: keep `chunkRanges`/`aggregate`/`fetchNpmDays`. **Add throttle + HTTP-429 retry with exponential backoff** (timing injectable so tests stay instant: options `{ delayMs, sleep }`, tests pass `delayMs: 0`/no-op sleep). Add `dailyMap(days: NpmDay[]): Record<string, number>`. Strengthen the `fetchNpmDays` test to vary per-chunk responses and assert merge; add a 429-retry test.
- `scripts/lib/packagist.ts`: `fetchPackagistTotal(name, fetchFn?): Promise<{ total: number }>` from `packages/{name}.json` `downloads.total`. `fetchPackagistDaily(name, from, fetchFn?): Promise<Record<string, number>>` from `packages/{name}/stats/all.json?average=daily&from={from}`, zipping `labels` with `values[name]`. Throw on non-ok. Tests with sample payloads (incl. the `values` keyed by package name).
- `app/data/projects.config.ts`: repoint every UX package (npm + packagist entries) to its own split repo (`symfony/ux-vue`, `symfony/ux-translator`, `symfony/ux-react`, `symfony/ux-native`, `symfony/ux-leaflet-map`, `symfony/ux-google-map`, `symfony/ux-map`, `symfony/ux-toolkit`, `symfony/ux-calendar-link`); fix kocal repos to `Kocal/BiomeJsBundle`, `Kocal/SymfonyMailerTesting`, `Kocal/OxcBundle`, `Kocal/phpstan-symfony-ux`. Webpack Encore + Reprise unchanged.

### R2 — orchestrator + full seed (supersedes Task 7)

**Files:** `scripts/fetch-stats.ts` (rewrite), `data/history.json` (regenerated).

Per package: npm → `fetchNpmDays` → `daily = dailyMap(days)`, `total = aggregate(days).total`; packagist → `total = fetchPackagistTotal(name)`, `daily = fetchPackagistDaily(name, from)`; `stars = fetchStars(repo, token)` for all. `mergePackage` into the file.

Two modes via a `BACKFILL` env flag:
- **Backfill (seed):** npm range from `2015-01-10`, Packagist daily from `2012-01-01` → full history.
- **Incremental (cron default):** npm range + Packagist daily for the **last ~35 days** only, merged into the accumulated file (older days already persisted). Keeps the daily cron light and avoids 429s.

Then run `BACKFILL=1 GITHUB_TOKEN="$(gh auth token)" pnpm stats` once to seed. Verify all 23 packages have a `daily` map + `total` + `stars`; UX packages have their own (distinct) star counts; kocal packages non-zero stars. Spot-check `packagist:symfony/webpack-encore-bundle` `total` vs live.

### R3 — dashboard view-model (supersedes Task 8)

**Files:** `app/utils/dashboard.ts`, `test/dashboard.test.ts`.

`buildDashboard(projects, history)` derives per package `{ registry, name, repo, total, last30 (sumLastNDays(daily,30)), sparkline (sparklineSeries(daily,30)), stars }`; per project `{ name, combinedTotal, combinedLast30, packages, sparkline }` where the project sparkline = per-date sum of package daily maps over the last 30 dates; dashboard `{ generatedAt, totalDownloads, totalStars, projects }`. Tests cover combine, per-package derivation, dashboard totals, empty history.

**Downstream:** Task 10 (`ProjectTile.vue`) drops the "24h/lastDay" row; shows total headline + `combinedLast30` (labeled "30d · npm + Packagist") + sparkline + per-package rows (registry icon, total, stars). Task 11 header shows total downloads + total stars + updated time. The `PackageView`/`ProjectView` field names above are the fixed contract for Tasks 10–11.
