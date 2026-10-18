# Bridge Families Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One dashboard card per family (core package + its bridges) whose headline is the core's installs, with one row and one sparkline per bridge, and a modal that keeps one chart line per package.

**Architecture:** Families are declared in `projects.config.ts` by nesting `bridges` under the core project. Each card keeps a single `data/history/<slug>.json`, so the bridge history files are merged into their core's file once. The pure view-models (`buildDashboard`, `buildProjectDetail`) compute family figures from the core only and expose per-bridge views with a color; the components only render them.

**Tech Stack:** Nuxt 4.4, Nuxt UI v4, Tailwind 4, TypeScript, vitest, vue-data-ui 3.22.x, jq, Cloudflare Workers (SSG).

**Spec:** `docs/superpowers/specs/2026-10-18-bridge-families-design.md`

## Global Constraints

- Package manager: **pnpm**. Every task leaves `pnpm lint`, `pnpm typecheck` and `pnpm test` green; run `pnpm lint --fix` before committing.
- ESLint stylistic: `commaDangle: 'never'`, `braceStyle: '1tbs'`.
- No code comments unless the "why" is non-obvious and absent from the code.
- Path aliases: `~` = `app/`, `~~` = repo root. Package key = `packageKey(registry, name)` from `~~/shared/stats`.
- Data manipulation in shell: jq, never ad-hoc Python.
- UI strings stay in English.
- Headline of a family = the core packages only. Bridges are never added to it. Bridges' npm downloads are shown aside, never added to installs.
- Family stars = sum over distinct repos of core + bridges.
- Projects without bridges must render and compute exactly as today (card and modal).
- One commit per task, conventional prefix (`feat:`, `refactor:`, `chore:`).

## Review Focus

- A bridge declared in the config but absent from history (added before the cron ran) -> zeros and a flat sparkline, no crash. Pinned by tests in Task 2 and Task 3.
- The migration silently dropping a package's backfilled daily history -> every old package entry must be byte-equal in the merged file. Pinned by the jq check in Task 1.
- Dashed npm lines erased by the `stroke-dasharray: 0 !important` override in `app/assets/css/main.css` (selectors `.vue-data-ui-line-animated`, `.line-animated`) -> npm lines must visibly render dashed. Checked in Task 5.
- Hover with no matching sparkline value (empty axis, index out of range) -> the bridge row falls back to its total, never shows `undefined`/`NaN`. Pinned in Task 4.
- Bridge colors unreadable in light or dark mode -> dots, sparklines and chart lines distinguishable in both. Checked in Task 4 and Task 5.

---

### Task 1: Families in the config, history migration, fetch script

**Files:**
- Modify: `app/data/projects.config.ts`
- Modify: `scripts/fetch-stats.ts`
- Modify: `data/history/ux-map.json`, `data/history/ux-image.json`
- Delete: `data/history/ux-leaflet-map.json`, `ux-google-map.json`, `ux-cloudflare-image.json`, `ux-cloudinary-image.json`, `ux-imgix-image.json`, `ux-keycdn-image.json`
- Test: `test/projects-config.test.ts`

**Interfaces:**
- Produces:
  - `interface TrackedBridge { name: string, packages: TrackedPackage[] }`
  - `interface TrackedProject { name: string, packages: TrackedPackage[], bridges?: TrackedBridge[] }` (for a family, `packages` = the core packages)
  - `allPackages(project: TrackedProject): TrackedPackage[]` — core packages first, then each bridge's packages in config order.

- [ ] **Step 1: Write the failing tests in `test/projects-config.test.ts`**

Change `'has no duplicate package keys'` to collect keys with `projects.flatMap(p => allPackages(p).map(...))`. Add:

```ts
it('nests the map and image bridges under their core', () => {
  const byName = (name: string) => projects.find(p => p.name === name)
  expect(byName('UX Map')?.bridges?.map(b => b.name)).toEqual(['Leaflet', 'Google Maps'])
  expect(byName('UX Image')?.bridges?.map(b => b.name)).toEqual(['Cloudflare', 'Cloudinary', 'Imgix', 'KeyCDN'])
  for (const gone of ['UX Leaflet Map', 'UX Google Map', 'UX Cloudflare Image', 'UX Cloudinary Image', 'UX Imgix Image', 'UX KeyCDN Image']) {
    expect(byName(gone)).toBeUndefined()
  }
})

it('every bridge has a name and valid packages', () => {
  for (const bridge of projects.flatMap(p => p.bridges ?? [])) {
    expect(bridge.name.length).toBeGreaterThan(0)
    expect(bridge.packages.length).toBeGreaterThan(0)
    for (const pkg of bridge.packages) {
      expect(['npm', 'packagist']).toContain(pkg.registry)
      expect(pkg.repo).toMatch(/^[^/]+\/[^/]+$/)
    }
  }
})

it('allPackages lists core packages first, then bridges in order', () => {
  const uxMap = projects.find(p => p.name === 'UX Map')!
  expect(allPackages(uxMap).map(p => packageKey(p.registry, p.name))).toEqual([
    'packagist:symfony/ux-map',
    'packagist:symfony/ux-leaflet-map',
    'npm:@symfony/ux-leaflet-map',
    'packagist:symfony/ux-google-map',
    'npm:@symfony/ux-google-map'
  ])
})
```

- [ ] **Step 2: Run `pnpm test -- projects-config` -> FAIL (`allPackages` not exported)**

- [ ] **Step 3: Update `app/data/projects.config.ts`**

Add the types and `allPackages`. Remove the 6 top-level bridge projects and nest them:
- `UX Map` (core `packagist symfony/ux-map`): bridges `Leaflet` (packagist `symfony/ux-leaflet-map` + npm `@symfony/ux-leaflet-map`), `Google Maps` (packagist `symfony/ux-google-map` + npm `@symfony/ux-google-map`).
- `UX Image` (core `packagist symfony/ux-image`): bridges `Cloudflare`, `Cloudinary`, `Imgix`, `KeyCDN`, each one packagist package `symfony/ux-<cloudflare|cloudinary|imgix|keycdn>-image`.
Every package keeps `repo` = its own split repo (`symfony/ux-leaflet-map`, `symfony/ux-keycdn-image`, ...). Keep the families where their core project sits today.

- [ ] **Step 4: In `scripts/fetch-stats.ts`, iterate `allPackages(project)` instead of `project.packages`**

- [ ] **Step 5: Run `pnpm test` -> PASS**

- [ ] **Step 6: Merge the bridge history files into their core's file**

```bash
cd data/history
jq -s '{generatedAt: (map(.generatedAt) | max), packages: (map(.packages) | add)}' ux-map.json ux-leaflet-map.json ux-google-map.json > ux-map.json.new && mv ux-map.json.new ux-map.json
jq -s '{generatedAt: (map(.generatedAt) | max), packages: (map(.packages) | add)}' ux-image.json ux-cloudflare-image.json ux-cloudinary-image.json ux-imgix-image.json ux-keycdn-image.json > ux-image.json.new && mv ux-image.json.new ux-image.json
```

- [ ] **Step 7: Verify nothing was lost, before deleting anything**

```bash
cd data/history
for pair in ux-map:ux-leaflet-map ux-map:ux-google-map ux-image:ux-cloudflare-image ux-image:ux-cloudinary-image ux-image:ux-imgix-image ux-image:ux-keycdn-image; do
  jq -n --slurpfile new "${pair%%:*}.json" --slurpfile old "${pair##*:}.json" '$old[0].packages | to_entries | all(.value == $new[0].packages[.key])'
done
jq -r '.packages | keys[]' ux-map.json ux-image.json
```

Expected: six `true`, then the 5 UX Map keys and the 5 UX Image keys. Also check the core entries are unchanged: `git diff --stat` shows only additions in the two files' `packages` (plus `generatedAt`).

- [ ] **Step 8: `git rm` the 6 bridge history files, then run `pnpm build`**

Expected: build succeeds and the prerender log no longer lists the 6 bridge routes (`Prerendered 18 routes`, was 24).

- [ ] **Step 9: Commit**

```bash
git add app/data/projects.config.ts scripts/fetch-stats.ts test/projects-config.test.ts data/history
git commit -m "refactor: nest bridges under their core project and merge their history"
```

---

### Task 2: Family dashboard view-model

**Files:**
- Create: `app/utils/colors.ts`
- Modify: `app/utils/dashboard.ts`
- Test: `test/dashboard.test.ts`, `test/colors.test.ts`

**Interfaces:**
- Consumes: `TrackedProject`, `TrackedBridge`, `allPackages` from Task 1.
- Produces:
  - `app/utils/colors.ts`: `CORE_COLOR = '#71717a'`, `REGISTRY_COLORS: Record<Registry, string> = { npm: '#00DC82', packagist: '#F28D1A' }` (moved from the modal), `bridgeColor(index: number): string` cycling over `['#3b82f6', '#f59e0b', '#a855f7', '#ec4899']`.
  - `interface BridgeView { name: string, color: string, total: number, last30: number, sparkline: number[], stars: number, packages: PackageView[] }` — `total`, `last30`, `sparkline` from the bridge's Packagist packages only; `stars` = distinct repos of the bridge; `packages` = all of the bridge's packages.
  - `ProjectView` gains `bridges: BridgeView[]` (`[]` without bridges), `totalStars: number` (distinct repos of core + bridges), `bridgesNpmTotal: number` (all-time total of the bridges' npm packages, `0` without). Existing fields (`combinedTotal`, `combinedLast7`, `combinedLast30`, `sparkline`, `packages`) are computed from `project.packages` (the core) exactly as today.
  - `Dashboard.totalDownloads` = sum of `combinedTotal` (unchanged code); `Dashboard.totalStars` = distinct repos across `allPackages` of every project.

- [ ] **Step 1: Write the failing tests**

`test/colors.test.ts`: `bridgeColor(0..3)` are 4 distinct values, `bridgeColor(4) === bridgeColor(0)`.

`test/dashboard.test.ts`, new test `'computes a family card from its core and exposes one view per bridge'` with:

```ts
const uxMap: TrackedProject = {
  name: 'UX Map',
  packages: [{ registry: 'packagist', name: 'symfony/ux-map', repo: 'symfony/ux-map' }],
  bridges: [
    { name: 'Leaflet', packages: [
      { registry: 'packagist', name: 'symfony/ux-leaflet-map', repo: 'symfony/ux-leaflet-map' },
      { registry: 'npm', name: '@symfony/ux-leaflet-map', repo: 'symfony/ux-leaflet-map' }
    ] },
    { name: 'Google Maps', packages: [
      { registry: 'packagist', name: 'symfony/ux-google-map', repo: 'symfony/ux-google-map' },
      { registry: 'npm', name: '@symfony/ux-google-map', repo: 'symfony/ux-google-map' }
    ] }
  ]
}
const history: History = {
  generatedAt: '2026-07-21T00:00:00Z',
  packages: {
    'packagist:symfony/ux-map': { total: 1000, stars: 19, daily: { '2026-07-19': 10, '2026-07-20': 20 } },
    'packagist:symfony/ux-leaflet-map': { total: 700, stars: 15, daily: { '2026-07-19': 6, '2026-07-20': 12 } },
    'npm:@symfony/ux-leaflet-map': { total: 40, stars: 15, daily: { '2026-07-20': 4 } },
    'packagist:symfony/ux-google-map': { total: 290, stars: 9, daily: { '2026-07-20': 7 } },
    'npm:@symfony/ux-google-map': { total: 30, stars: 9, daily: { '2026-07-20': 3 } }
  }
}
```

Assertions on `buildDashboard([uxMap], history)`:
- `project.combinedTotal === 1000`, `project.combinedLast30 === 30`, `project.sparkline.slice(-2)` `[10, 20]`, `project.packages` has length 1
- `project.totalStars === 43`, `project.bridgesNpmTotal === 70`
- `project.bridges.map(b => b.name)` `['Leaflet', 'Google Maps']`
- Leaflet: `total 700`, `last30 18`, `sparkline` length 30 and `.slice(-2)` `[6, 12]`, `stars 15`, `packages` length 2, `color === bridgeColor(0)`
- Google Maps: `total 290`, `sparkline.slice(-2)` `[0, 7]`, `stars 9`, `color === bridgeColor(1)`
- `dashboard.totalDownloads === 1000`, `dashboard.totalStars === 43`

Second new test `'yields a zeroed bridge when the bridge is missing from history'`: core `x/core` with `daily: { '2026-07-20': 1 }`, one bridge `Ghost` with packagist `x/ghost` absent from history -> bridge `total 0`, `stars 0`, `last30 0`, `sparkline` equals `Array(30).fill(0)`.

Third: extend an existing project-without-bridges test to assert `bridges` `[]`, `bridgesNpmTotal 0`, and `totalStars 35` for UX Vue (shared repo deduped).

- [ ] **Step 2: Run `pnpm test -- dashboard colors` -> FAIL**

- [ ] **Step 3: Implement `app/utils/colors.ts` and the new fields in `buildDashboard`**

Bridge `sparkline` and `last30` come from `mergeDaily` of the bridge's Packagist dailies aligned on the shared 30-day axis, like the core sparkline.

- [ ] **Step 4: Run `pnpm test` -> PASS (existing dashboard tests unchanged and green)**

- [ ] **Step 5: Commit** — `feat: compute family cards from the core with one view per bridge`

---

### Task 3: Family project detail view-model

**Files:**
- Modify: `app/utils/projectDetail.ts`
- Test: `test/project-detail.test.ts`

**Interfaces:**
- Consumes: `allPackages` (Task 1); `CORE_COLOR`, `REGISTRY_COLORS`, `bridgeColor` (Task 2). `buildProjectDetail` keeps its signature `(project: TrackedProject, history: History)`; the modal passes a `ProjectView`, which stays structurally compatible because `BridgeView` has `name` and `packages`.
- Produces:
  - `PackageDetail` gains `bridge: string | null` (`null` = core package), `color: string`, `dashed: boolean`.
    - Project without bridges: `color = REGISTRY_COLORS[registry]`, `dashed = false`, `bridge = null` (today's look).
    - Family: core -> `CORE_COLOR`; bridge package -> `bridgeColor(bridgeIndex)`; `dashed = registry === 'npm'`.
  - `ProjectDetail` gains `bridgesNpmTotal: number`. `packages` = `allPackages(project)` order.
  - Axis (`dates`, `chartDates`) spans every package of the family. `combinedTotal`, `totals`, `peakDay`, `averagePerDay` come from the core packages only; `totals.all = combinedTotal`; `totalStars` = distinct repos of core + bridges.

- [ ] **Step 1: Write the failing test `'computes family stats from the core and tags bridge packages'`**

Fixture: core `packagist symfony/ux-map` (`total 1000`, `stars 19`, `daily { '2026-07-01': 10, '2026-07-03': 30 }`), bridge `Leaflet` with packagist `symfony/ux-leaflet-map` (`total 700`, `stars 15`, `daily { '2026-07-02': 50 }`) and npm `@symfony/ux-leaflet-map` (`total 40`, `stars 15`, `daily { '2026-07-03': 4 }`).

Assertions:
- `dates` `['2026-07-01', '2026-07-02', '2026-07-03']`
- `combinedTotal 1000`, `totals.all 1000`, `totals.d7 40` (core only, not 94)
- `peakDay` `{ date: '2026-07-03', downloads: 30 }` (the bridge's 50 is ignored)
- `averagePerDay 13` (round(40 / 3))
- `totalStars 34`, `bridgesNpmTotal 40`
- `packages.map(p => [p.name, p.bridge, p.color, p.dashed])` equals `[['symfony/ux-map', null, CORE_COLOR, false], ['symfony/ux-leaflet-map', 'Leaflet', bridgeColor(0), false], ['@symfony/ux-leaflet-map', 'Leaflet', bridgeColor(0), true]]`
- `packages[1].series` `[0, 50, 0]`

Add `'keeps registry colors for a project without bridges'`: UX Vue fixture -> packagist `color '#F28D1A'`, npm `color '#00DC82'`, both `dashed false`, `bridge null`, `bridgesNpmTotal 0`.

Add `'zeroes a bridge package missing from history'`: family whose bridge package is absent -> its `series` is all zeros on the core's axis, `total 0`, no throw.

- [ ] **Step 2: Run `pnpm test -- project-detail` -> FAIL**

- [ ] **Step 3: Implement in `app/utils/projectDetail.ts`**

- [ ] **Step 4: Run `pnpm test` -> PASS (the 5 existing project-detail tests unchanged and green)**

- [ ] **Step 5: Commit** — `feat: compute family detail stats from the core and tag bridge packages`

---

### Task 4: Family card

**Files:**
- Modify: `app/components/Sparkline.vue`
- Modify: `app/components/ProjectTile.vue`

**Interfaces:**
- Consumes: `ProjectView.bridges`, `totalStars`, `bridgesNpmTotal` (Task 2); `useSparklineHover()` from `~/composables/sparklineHover`.
- Produces: `Sparkline` props `color?: string` (applied as the svg's CSS `color`, overriding `text-primary`; default unchanged) and `tooltip?: boolean` (default `true`; `false` hides the teleported value bubble, keeps crosshair and dot).

No component tests exist in this repo; this task is verified in the browser.

- [ ] **Step 1: Add the two props to `Sparkline.vue`**

- [ ] **Step 2: Render the family layout in `ProjectTile.vue` when `project.bridges.length > 0`; keep today's template otherwise**

- Header: name, muted `+ 1 bridge` / `+ N bridges`, `<Sparkline :values="project.sparkline" />` (bubble kept).
- Headline: `combinedTotal` with label `installs`, then a star icon and `totalStars`.
- Sub-line: today's `N last 7 days · N last 30 days`; when `bridgesNpmTotal > 0`, a muted line `+ N npm downloads`.
- One row per bridge: dot in `bridge.color`, `bridge.name`, `<Sparkline :values="bridge.sparkline" :color="bridge.color" :tooltip="false" :width="110" :height="24" />`, the figure, a star icon and `bridge.stars`.
- The figure is `bridge.sparkline[hover.index]` while `hover.index !== null` and that value is defined, else `bridge.total`. Numbers through the existing `Intl.NumberFormat('en-US')`.
- No core package row on a family card.

- [ ] **Step 3: Verify in the browser (`pnpm dev`, http://localhost:3000)**

1. UX Map card headline equals `jq '.packages["packagist:symfony/ux-map"].total' data/history/ux-map.json`; stars equal the sum of the 3 repos' stars in that file.
2. Leaflet and Google Maps rows each show their own sparkline; UX Image shows 4 rows.
3. Hover any sparkline on the page: crosshairs move on every bridge row, each row's figure switches to that day's value and returns to the total on leave, and no bubble covers a bridge row.
4. Cards without bridges (Webpack Encore, UX Vue, UX Router) look exactly as before.
5. Repeat 2-3 in dark and light mode: bridge colors stay distinguishable.

- [ ] **Step 4: `pnpm lint && pnpm typecheck && pnpm test` -> green**

- [ ] **Step 5: Commit** — `feat: render family cards with one sparkline row per bridge`

---

### Task 5: Family modal

**Files:**
- Modify: `app/components/ProjectDetailModal.vue`

**Interfaces:**
- Consumes: `PackageDetail.bridge`, `color`, `dashed`, `ProjectDetail.bridgesNpmTotal`, `totalStars` (Task 3); `ProjectView.bridges` (Task 2) to know the project is a family.

- [ ] **Step 1: Map the chart dataset from the view-model**

Each dataset item: `{ name, type: 'line', color: p.color, dashed: p.dashed, series: p.chartSeries }`. Remove the inline registry color logic (now `REGISTRY_COLORS`, Task 2).

- [ ] **Step 2: Family header and package list**

- Header for a family: `combinedTotal` labelled `installs`, then `+ N npm downloads` when `bridgesNpmTotal > 0`, then `N stars`. Without bridges: today's `total downloads · N stars`.
- Package rows: in a family, prefix each row with a dot in `p.color` and its member label (`p.bridge`, or the project name for the core). Without bridges: unchanged.

- [ ] **Step 3: Verify in the browser**

1. Open UX Map: 5 lines; core neutral, Leaflet and Google in the same colors as their card dots; the two npm lines are visibly dashed. If they render solid, the cause is the `stroke-dasharray: 0 !important` override in `app/assets/css/main.css`: narrow that override so it no longer matches dashed series, without re-enabling the draw animation.
2. Period totals and peak day match the core: `totals.all` equals the card headline.
3. Package list: 5 rows tagged UX Map / Leaflet / Leaflet / Google Maps / Google Maps, links work.
4. Open UX Vue: chart, header and rows identical to before.
5. Check the chart in dark and light mode.

- [ ] **Step 4: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -> green**

- [ ] **Step 5: Commit** — `feat: show bridge-colored lines and member tags in the family modal`
