# Project Detail Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a project tile opens a modal with a full all-time downloads chart (one line per package, draggable-bounds zoom) plus links, per-package breakdown, all-time stats, and period totals.

**Architecture:** The full daily history stays out of the page payload. A prerendered static asset `/history.json` is fetched once on the first modal open (memoized in `useHistory`). A pure `buildProjectDetail` util turns a project + history into a chart dataset and stats. `ProjectDetailModal.vue` renders a vue-data-ui `VueUiXy` chart (client-only) plus info blocks. Tiles become clickable triggers.

**Tech Stack:** Nuxt 4.4, Nuxt UI v4, Tailwind 4, TypeScript, vitest, vue-data-ui 3.x, Cloudflare Workers (SSG).

## Global Constraints

- Package manager: **pnpm** (`pnpm@11.13.1`). Never use npm/yarn.
- Node 22. Every task must leave `pnpm lint`, `pnpm typecheck`, and `pnpm test` green; run `pnpm lint --fix` before committing.
- ESLint stylistic: `commaDangle: 'never'`, `braceStyle: '1tbs'`.
- No code comments unless the "why" is non-obvious (project convention).
- Path aliases: `~` = `app/`, `~~` = repo root. Package key is `` `${registry}:${name}` `` via `packageKey` from `~~/shared/stats`.
- Data model (`~~/shared/stats`): `PackageHistory { total: number; stars: number; daily: Record<string, number> }`, `History { generatedAt: string; packages: Record<string, PackageHistory> }`. `daily` stores positive days only.
- vue-data-ui: import `{ VueUiXy } from 'vue-data-ui'`, CSS `vue-data-ui/style.css`. Version pinned by this plan is **3.22.14**; `VueUiXyDatasetItem.series` is `Array<{ x: number; y: number }>`. Any browser-only chart lib is used **only inside `<ClientOnly>`** and imported via `defineAsyncComponent` so it never loads during prerender.

---

### Task 1: `/history.json` data asset + `useHistory` composable

**Files:**
- Create: `server/routes/history.json.get.ts`
- Create: `app/composables/useHistory.ts`
- Modify: `nuxt.config.ts` (add `/history.json` to `nitro.prerender.routes`)

**Interfaces:**
- Consumes: `~~/data/history.json`, `History` from `~~/shared/stats`.
- Produces: a GET `/history.json` endpoint (prerendered to a static asset); `useHistory()` returning `{ history: Ref<History | null>, pending: Ref<boolean>, error: Ref<Error | null>, load: () => Promise<void> }`. `load()` fetches once and memoizes (no-op if already loaded).

This task is thin runtime glue; it is verified by running the dev server, not by a unit test.

- [ ] **Step 1: Create the data route — `server/routes/history.json.get.ts`**

```ts
import history from '~~/data/history.json'

export default defineEventHandler(() => history)
```

- [ ] **Step 2: Add `/history.json` to the prerender routes — `nuxt.config.ts`**

Change the `nitro` block's prerender routes:

```ts
  nitro: {
    preset: 'cloudflare_module',
    prerender: {
      routes: ['/', '/history.json']
    }
  },
```

- [ ] **Step 3: Create the composable — `app/composables/useHistory.ts`**

```ts
import type { History } from '~~/shared/stats'

let inflight: Promise<void> | null = null

export function useHistory() {
  const history = useState<History | null>('history', () => null)
  const pending = useState<boolean>('history-pending', () => false)
  const error = useState<Error | null>('history-error', () => null)

  async function load(): Promise<void> {
    if (history.value) {
      return
    }
    if (inflight) {
      return inflight
    }
    pending.value = true
    error.value = null
    inflight = $fetch<History>('/history.json')
      .then((data) => {
        history.value = data
      })
      .catch((err) => {
        error.value = err as Error
      })
      .finally(() => {
        pending.value = false
        inflight = null
      })
    return inflight
  }

  return { history, pending, error, load }
}
```

- [ ] **Step 4: Verify the endpoint serves the history**

Run: `pnpm dev` (background), then `curl -s http://localhost:3000/history.json | head -c 120`
Expected: JSON starting with `{"generatedAt":`. Stop the dev server.

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm lint --fix && pnpm typecheck`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add server/routes/history.json.get.ts app/composables/useHistory.ts nuxt.config.ts
git commit -m "feat: serve history.json as a static asset with a memoized useHistory composable"
```

---

### Task 2: `buildProjectDetail` view-model (TDD)

**Files:**
- Create: `app/utils/projectDetail.ts`
- Create: `test/project-detail.test.ts`
- Modify: `app/utils/dashboard.ts` (export the existing `mergeDaily` helper for reuse)

**Interfaces:**
- Consumes: `TrackedProject` from `~/data/projects.config`, `History`/`Registry`/`packageKey` from `~~/shared/stats`, `mergeDaily` from `~/utils/dashboard`. Accepts anything structurally matching `{ name, packages: { registry, name, repo }[] }` — a `ProjectView` from `~/utils/dashboard` is compatible and is what the modal passes.
- Produces:
  - `interface PackageDetail { registry: Registry; name: string; repo: string; packageUrl: string; githubUrl: string; total: number; last7: number; last30: number; stars: number; series: number[] }`
  - `interface ProjectDetail { name: string; dates: string[]; packages: PackageDetail[]; combinedTotal: number; totalStars: number; totals: { d7: number; d30: number; d90: number; d365: number; all: number }; peakDay: { date: string; downloads: number } | null; averagePerDay: number; firstTrackedDate: string | null }`
  - `buildProjectDetail(project: TrackedProject, history: History): ProjectDetail`

Semantics: `dates` is a continuous daily axis from the earliest to the latest recorded day across the project's packages (zero-filled gaps). Each package `series` is aligned to `dates`. `total` per package is the authoritative `entry.total` (not the daily sum). `totals.all` equals `combinedTotal` (authoritative). `totals.d7/d30/d90/d365` sum the trailing N entries of the combined aligned series. `peakDay` is the max combined day. `averagePerDay = round(sum(combinedAligned) / dates.length)`. `totalStars` dedupes by repo.

- [ ] **Step 1: Write the failing test — `test/project-detail.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import type { TrackedProject } from '~/data/projects.config'
import { buildProjectDetail } from '~/utils/projectDetail'
import type { History } from '~~/shared/stats'

describe('buildProjectDetail', () => {
  it('builds a continuous zero-filled axis and aligns a package series to it', () => {
    const project: TrackedProject = {
      name: 'X',
      packages: [{ registry: 'npm', name: '@x/x', repo: 'x/x' }]
    }
    const history: History = {
      generatedAt: '2026-07-04T00:00:00Z',
      packages: {
        'npm:@x/x': { total: 999, stars: 7, daily: { '2026-07-01': 10, '2026-07-03': 5 } }
      }
    }

    const detail = buildProjectDetail(project, history)

    expect(detail.dates).toEqual(['2026-07-01', '2026-07-02', '2026-07-03'])
    expect(detail.packages[0]?.series).toEqual([10, 0, 5])
    expect(detail.packages[0]?.total).toBe(999)
    expect(detail.packages[0]?.last7).toBe(15)
    expect(detail.packages[0]?.packageUrl).toBe('https://www.npmjs.com/package/@x/x')
    expect(detail.packages[0]?.githubUrl).toBe('https://github.com/x/x')
    expect(detail.combinedTotal).toBe(999)
    expect(detail.totals.all).toBe(999)
    expect(detail.totals.d7).toBe(15)
    expect(detail.peakDay).toEqual({ date: '2026-07-01', downloads: 10 })
    expect(detail.averagePerDay).toBe(5)
    expect(detail.firstTrackedDate).toBe('2026-07-01')
    expect(detail.totalStars).toBe(7)
  })

  it('combines packages, dedupes stars by shared repo, and honors trailing windows', () => {
    const project: TrackedProject = {
      name: 'UX Vue',
      packages: [
        { registry: 'packagist', name: 'symfony/ux-vue', repo: 'symfony/ux-vue' },
        { registry: 'npm', name: '@symfony/ux-vue', repo: 'symfony/ux-vue' }
      ]
    }
    const history: History = {
      generatedAt: '2026-07-21T00:00:00Z',
      packages: {
        'packagist:symfony/ux-vue': { total: 1000, stars: 35, daily: { '2026-06-01': 100, '2026-07-20': 20 } },
        'npm:@symfony/ux-vue': { total: 500, stars: 35, daily: { '2026-07-19': 3, '2026-07-20': 5 } }
      }
    }

    const detail = buildProjectDetail(project, history)

    expect(detail.dates).toHaveLength(50) // 2026-06-01 .. 2026-07-20 inclusive
    expect(detail.firstTrackedDate).toBe('2026-06-01')
    expect(detail.combinedTotal).toBe(1500)
    expect(detail.totalStars).toBe(35) // deduped: both packages share symfony/ux-vue
    expect(detail.totals.d7).toBe(28) // 07-19 (3) + 07-20 (25)
    expect(detail.totals.d30).toBe(28)
    expect(detail.totals.d90).toBe(128) // + 06-01 (100)
    expect(detail.totals.d365).toBe(128)
    expect(detail.peakDay).toEqual({ date: '2026-06-01', downloads: 100 })
    expect(detail.averagePerDay).toBe(3) // round(128 / 50)
    const npm = detail.packages.find(p => p.registry === 'npm')
    expect(npm?.total).toBe(500) // authoritative, not the daily sum (8)
    expect(npm?.packageUrl).toBe('https://www.npmjs.com/package/@symfony/ux-vue')
  })

  it('returns empty structures for a project with no history', () => {
    const detail = buildProjectDetail({ name: 'E', packages: [] }, { generatedAt: '', packages: {} })

    expect(detail.dates).toEqual([])
    expect(detail.packages).toEqual([])
    expect(detail.combinedTotal).toBe(0)
    expect(detail.totals).toEqual({ d7: 0, d30: 0, d90: 0, d365: 0, all: 0 })
    expect(detail.peakDay).toBeNull()
    expect(detail.averagePerDay).toBe(0)
    expect(detail.firstTrackedDate).toBeNull()
    expect(detail.totalStars).toBe(0)
  })

  it('yields zeros and an empty series for a package missing from history', () => {
    const project: TrackedProject = {
      name: 'Ghost',
      packages: [{ registry: 'npm', name: '@x/ghost', repo: 'x/ghost' }]
    }

    const detail = buildProjectDetail(project, { generatedAt: '', packages: {} })

    expect(detail.dates).toEqual([])
    expect(detail.packages[0]?.total).toBe(0)
    expect(detail.packages[0]?.series).toEqual([])
    expect(detail.combinedTotal).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm test test/project-detail.test.ts`
Expected: FAIL (cannot find module `~/utils/projectDetail`).

- [ ] **Step 3: Export the shared helper, then implement `app/utils/projectDetail.ts`**

First, in `app/utils/dashboard.ts`, export the existing `mergeDaily` helper for reuse — change its declaration `function mergeDaily(` to `export function mergeDaily(`. Do not duplicate its body anywhere.

Then create `app/utils/projectDetail.ts`:

```ts
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
}

export interface ProjectDetail {
  name: string
  dates: string[]
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
      series
    }
  })

  let peakDay: { date: string, downloads: number } | null = null
  for (const [date, downloads] of Object.entries(combinedDaily)) {
    if (!peakDay || downloads > peakDay.downloads) {
      peakDay = { date, downloads }
    }
  }

  const combinedTotal = packages.reduce((sum, p) => sum + p.total, 0)
  const dailySum = combinedAligned.reduce((sum, v) => sum + v, 0)

  return {
    name: project.name,
    dates,
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
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm test test/project-detail.test.ts`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add app/utils/projectDetail.ts test/project-detail.test.ts
git commit -m "feat: derive project detail view-model from full daily history"
```

---

### Task 3: vue-data-ui + `ProjectDetailModal.vue`

**Files:**
- Create: `app/components/ProjectDetailModal.vue`
- Modify: `nuxt.config.ts` (css + `build.transpile`)
- Modify: `package.json` (add `vue-data-ui`)

**Interfaces:**
- Consumes: `useHistory` (Task 1), `buildProjectDetail`/`ProjectDetail` (Task 2), `ProjectView` from `~/utils/dashboard`.
- Produces: `<ProjectDetailModal v-model:open="..." :project="ProjectView | null" />` (auto-imported by Nuxt).

This is a UI task verified by typecheck + manual dev (vue-data-ui is third-party; no unit test).

- [ ] **Step 1: Add the dependency**

Run: `pnpm add vue-data-ui`

- [ ] **Step 2: Register the CSS and transpile — `nuxt.config.ts`**

Set `css` to include the vue-data-ui stylesheet, and add a `build` block:

```ts
  css: ['~/assets/css/main.css', 'vue-data-ui/style.css'],

  build: {
    transpile: ['vue-data-ui']
  },
```

- [ ] **Step 3: Implement `app/components/ProjectDetailModal.vue`**

```vue
<script setup lang="ts">
import type { ProjectView } from '~/utils/dashboard'
import { buildProjectDetail } from '~/utils/projectDetail'
import { useHistory } from '~/composables/useHistory'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ project: ProjectView | null }>()

const VueUiXy = defineAsyncComponent(() => import('vue-data-ui').then(m => ({ default: m.VueUiXy })))

const { history, pending, error, load } = useHistory()
const nf = new Intl.NumberFormat('en-US')

watch(open, (value) => {
  if (value) {
    load()
  }
})

const detail = computed(() => {
  if (!props.project || !history.value) {
    return null
  }
  return buildProjectDetail(props.project, history.value)
})

const dataset = computed(() => {
  const d = detail.value
  if (!d) {
    return []
  }
  return d.packages.map(p => ({
    name: `${p.registry} · ${p.name}`,
    type: 'line' as const,
    color: p.registry === 'npm' ? '#00DC82' : '#F28D1A',
    series: p.series.map((y, x) => ({ x, y }))
  }))
})

const chartConfig = computed(() => ({
  responsive: true,
  style: {
    chart: {
      backgroundColor: 'transparent',
      zoom: {
        show: true,
        compact: true,
        handleType: 'grab'
      },
      layout: {
        grid: {
          xAxis: {
            dataLabels: {
              show: true,
              values: detail.value?.dates ?? [],
              showOnlyFirstAndLast: true
            }
          }
        }
      }
    }
  }
}))

const periodCards = computed(() => {
  const t = detail.value?.totals
  if (!t) {
    return []
  }
  return [
    { label: '7 days', value: t.d7 },
    { label: '30 days', value: t.d30 },
    { label: '90 days', value: t.d90 },
    { label: '1 year', value: t.d365 },
    { label: 'All time', value: t.all }
  ]
})

function registryIcon(registry: string) {
  return registry === 'npm' ? 'i-simple-icons-npm' : 'i-simple-icons-packagist'
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="project?.name ?? ''"
    :ui="{ content: 'max-w-5xl' }"
  >
    <template #body>
      <div
        v-if="detail"
        class="space-y-6"
      >
        <div class="flex flex-wrap items-baseline gap-2">
          <span class="text-2xl font-bold tabular-nums">{{ nf.format(detail.combinedTotal) }}</span>
          <span class="text-sm text-muted">total downloads · {{ nf.format(detail.totalStars) }} stars</span>
        </div>

        <ClientOnly>
          <VueUiXy
            v-if="dataset.length"
            :dataset="dataset"
            :config="chartConfig"
          />
          <template #fallback>
            <USkeleton class="h-64 w-full" />
          </template>
        </ClientOnly>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div
            v-for="card in periodCards"
            :key="card.label"
            class="rounded-lg bg-elevated/50 p-3"
          >
            <div class="text-xs text-muted">
              {{ card.label }}
            </div>
            <div class="text-lg font-semibold tabular-nums">
              {{ nf.format(card.value) }}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            Peak day:
            <span class="font-semibold tabular-nums">{{ detail.peakDay ? `${nf.format(detail.peakDay.downloads)} on ${detail.peakDay.date}` : '—' }}</span>
          </div>
          <div>
            Avg/day: <span class="font-semibold tabular-nums">{{ nf.format(detail.averagePerDay) }}</span>
          </div>
          <div>
            First tracked: <span class="font-semibold">{{ detail.firstTrackedDate ?? '—' }}</span>
          </div>
        </div>

        <div class="space-y-2">
          <div
            v-for="pkg in detail.packages"
            :key="`${pkg.registry}:${pkg.name}`"
            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default p-3 text-sm"
          >
            <div class="flex min-w-0 items-center gap-2">
              <UIcon :name="registryIcon(pkg.registry)" />
              <span class="truncate font-mono text-xs">{{ pkg.name }}</span>
            </div>
            <div class="flex items-center gap-4 tabular-nums text-muted">
              <span>{{ nf.format(pkg.total) }} total</span>
              <span>{{ nf.format(pkg.last7) }} 7d</span>
              <span>{{ nf.format(pkg.last30) }} 30d</span>
              <span class="flex items-center gap-0.5">
                <UIcon
                  name="i-lucide-star"
                  class="text-warning"
                />
                {{ nf.format(pkg.stars) }}
              </span>
              <UButton
                :to="pkg.packageUrl"
                target="_blank"
                size="xs"
                variant="ghost"
                color="neutral"
                :icon="registryIcon(pkg.registry)"
                :aria-label="`${pkg.name} on ${pkg.registry}`"
              />
              <UButton
                :to="pkg.githubUrl"
                target="_blank"
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-simple-icons-github"
                aria-label="GitHub repository"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="pending"
        class="space-y-4"
      >
        <USkeleton class="h-64 w-full" />
      </div>

      <div
        v-else-if="error"
        class="flex items-center gap-3 text-sm text-error"
      >
        Failed to load chart data.
        <UButton
          size="xs"
          variant="soft"
          @click="load"
        >
          Retry
        </UButton>
      </div>
    </template>
  </UModal>
</template>
```

- [ ] **Step 4: Reconcile the chart config with the installed types**

The `dataset` item shape and `config` zoom/label key paths above match vue-data-ui **3.22.14**. Confirm against the installed version:

Run: `grep -n "VueUiXyDatasetItem" node_modules/vue-data-ui/dist/types/vue-data-ui.d.ts`
- Confirm `series` is `Array<{ x: number; y: number }>` (used above). If the installed version types it as `number[]`, change `series: p.series.map((y, x) => ({ x, y }))` to `series: p.series`.
- Confirm the zoom keys live under `config.style.chart.zoom` and the x-axis labels under `config.style.chart.layout.grid.xAxis.dataLabels`. Adjust the `chartConfig` object if the installed type differs. The zoom minimap must stay enabled with a draggable `handleType` (`'grab'`).

- [ ] **Step 5: Typecheck**

Run: `pnpm lint --fix && pnpm typecheck`
Expected: green (no errors from `ProjectDetailModal.vue`).

- [ ] **Step 6: Commit**

```bash
git add app/components/ProjectDetailModal.vue nuxt.config.ts package.json pnpm-lock.yaml
git commit -m "feat: add project detail modal with vue-data-ui chart"
```

---

### Task 4: Make tiles open the modal

**Files:**
- Modify: `app/components/ProjectTile.vue` (clickable trigger)
- Modify: `app/pages/index.vue` (selection state + render modal)

**Interfaces:**
- Consumes: `<ProjectDetailModal>` (Task 3), `ProjectView` (from `~/utils/dashboard`).
- Produces: end-to-end behavior — clicking any tile opens the modal for that project.

- [ ] **Step 1: Make the tile an accessible trigger — `app/components/ProjectTile.vue`**

Add an emit to the `<script setup>` block (after the existing `defineProps`):

```ts
const emit = defineEmits<{ open: [] }>()
```

Make the root `<UCard>` clickable and keyboard-operable by adding these attributes to the opening `<UCard variant="subtle">` tag:

```html
  <UCard
    variant="subtle"
    role="button"
    tabindex="0"
    class="cursor-pointer transition hover:ring-2 hover:ring-primary/40"
    @click="emit('open')"
    @keydown.enter="emit('open')"
    @keydown.space.prevent="emit('open')"
  >
```

- [ ] **Step 2: Wire selection + modal into `app/pages/index.vue`**

In `<script setup>`, add the import and state (alongside the existing code):

```ts
import type { ProjectView } from '~/utils/dashboard'

const selected = ref<ProjectView | null>(null)
const detailOpen = ref(false)

function openProject(project: ProjectView) {
  selected.value = project
  detailOpen.value = true
}
```

In the template, add the `@open` handler to `<ProjectTile>` and render the modal after the grid `</div>`:

```html
      <ProjectTile
        v-for="project in dashboard.projects"
        :key="project.name"
        :project="project"
        @open="openProject(project)"
      />
    </div>

    <ProjectDetailModal
      v-model:open="detailOpen"
      :project="selected"
    />
```

- [ ] **Step 3: Manual end-to-end check**

Run: `pnpm dev`, open http://localhost:3000.
Expected:
- Tiles show a hover ring and a pointer cursor.
- Clicking a tile (or focusing it and pressing Enter/Space) opens the modal.
- The modal shows one line per package; dragging the zoom minimap bounds narrows the visible range.
- Period totals, peak day, avg/day, first-tracked, and per-package rows (with npm/Packagist + GitHub link buttons) render.
- Spot-check: for Webpack Encore, the `symfony/webpack-encore-bundle` total roughly matches its Packagist page.
- Reopen a different tile — no second network request for `/history.json` (memoized). Toggle dark mode; the chart stays legible.

Stop the dev server.

- [ ] **Step 4: Lint, typecheck, test**

Run: `pnpm lint --fix && pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 5: Production build sanity check**

Run: `pnpm build`
Expected: build succeeds and emits `/history.json` as a prerendered static asset (look for `history.json` under `.output/public/`).

- [ ] **Step 6: Commit**

```bash
git add app/components/ProjectTile.vue app/pages/index.vue
git commit -m "feat: open the detail modal when a project tile is clicked"
```

---

## Self-Review

**Spec coverage:**
- Modal presentation (`UModal`) -> Task 3. ✓
- Lazy static-asset data delivery (`/history.json` + memoized `useHistory`) -> Task 1. ✓
- `buildProjectDetail` view-model, one line per package, all-time -> Task 2. ✓
- vue-data-ui `VueUiXy` with draggable-bounds zoom minimap, ClientOnly -> Task 3. ✓
- Extra info: links, per-package breakdown, all-time stats, period totals -> Task 2 (data) + Task 3 (UI). ✓
- Clickable/accessible tiles -> Task 4. ✓
- Error/SSG handling (retry state, ClientOnly, missing package) -> Task 1 (error ref), Task 2 (empty/missing cases), Task 3 (retry + ClientOnly). ✓
- Non-goal per-version -> not implemented (correct). ✓
- Testing: unit `buildProjectDetail` + manual chart verification + `pnpm build` -> Tasks 2, 4. ✓

**Placeholder scan:** No TBD/TODO. The only runtime-verification step is Task 3 Step 4 (reconcile vue-data-ui keys against installed types), which includes concrete grep + concrete fallbacks — not a placeholder.

**Type consistency:** `History`/`PackageHistory`/`packageKey` used verbatim from `~~/shared/stats`. `ProjectDetail`/`PackageDetail` defined in Task 2 and consumed in Task 3. `useHistory()` return shape (`history`/`pending`/`error`/`load`) defined in Task 1 and consumed in Task 3. `ProjectView` (from `~/utils/dashboard`) is the modal prop type and the `buildProjectDetail` argument — structurally compatible with `TrackedProject`. Modal open uses `v-model:open` consistently in Tasks 3 and 4.
