# trackage — project detail modal (design)

Date: 2026-07-28
Status: approved

## Context

Tiles today show a summary only: combined total, last 7d, last 30d, per-package total + stars, and a 30-day sparkline. There is no way to drill into a project. We want a click on a tile to open a detailed view with:

- a **full all-time downloads chart**, one line per package (npm vs Packagist), with a draggable-bounds zoom to inspect any window precisely;
- richer info: links to each package + repo, a per-package breakdown, all-time stats, and download totals per period.

Hard constraint from the existing architecture: the full day-by-day history (~500KB) is **deliberately code-split out** of the page payload. `app/pages/index.vue` derives a 30-day view-model at prerender time via `buildDashboard`, so the page ships ~12KB and the raw `daily` maps never reach the client. The detail view needs the full series, so it must **fetch it lazily on demand** instead of bloating the page.

## Decisions (locked with the user)

- **Presentation**: a modal (Nuxt UI `UModal`), not a dedicated route. Opens instantly, stays on the page, closes on Esc.
- **Chart**: one line per package, all-time daily values, rendered with **vue-data-ui** `VueUiXy`, using its **zoom minimap with draggable handles** (`config.chart.zoom`) for precise range selection.
- **Data delivery**: a prerendered static asset `/history.json`, fetched **once** on the first modal open and memoized in a composable, shared across all modals.
- **Extra info** (all four): package links (npm/Packagist/GitHub), per-package breakdown, all-time stats, period totals.
- **Per-version: OUT of scope** — see Non-goals for the full rationale (npm exposes no per-version history and cannot be backfilled).

## Architecture

```
tile click
   -> index.vue sets selectedProject + open
      -> ProjectDetailModal
         -> useHistory()  --(1x, memoized)-->  GET /history.json  (prerendered static asset)
         -> buildProjectDetail(project, history)  --> { chart dataset, per-package rows, stats, totals }
         -> VueUiXy (ClientOnly) + info blocks
```

New files:
- `server/routes/history.json.get.ts` — returns the imported `~~/data/history.json`; `/history.json` added to `nitro.prerender.routes` so it is emitted as a static asset (served by the Workers `ASSETS` binding).
- `app/composables/useHistory.ts` — single memoized fetch of `/history.json` (module-level `ref` / `useState`), with loading + error state; returns the shared `History`.
- `app/utils/projectDetail.ts` — `buildProjectDetail(project, history)`, pure + unit-tested.
- `app/components/ProjectDetailModal.vue` — the modal UI.
- `test/project-detail.test.ts`.

Modified files:
- `app/components/ProjectTile.vue` — the card becomes an interactive, keyboard-accessible trigger that emits open.
- `app/pages/index.vue` — holds `selectedProject` + open state; renders a single `<ProjectDetailModal>`.
- `nuxt.config.ts` — add `'vue-data-ui/style.css'` to `css`, add `/history.json` to `nitro.prerender.routes`, and `build.transpile: ['vue-data-ui']` if the build requires it.
- `package.json` — add the `vue-data-ui` dependency.

## Data delivery

`server/routes/history.json.get.ts` simply returns the build-time import of `~~/data/history.json`. Because `/history.json` is listed in `nitro.prerender.routes`, Nitro writes it as a static file at build; on Cloudflare Workers it is served by the `ASSETS` binding — no runtime compute.

`useHistory()` performs one `$fetch('/history.json')`, stores the result in a module-scoped ref (or `useState`) so every subsequent modal open reuses it (also browser-cached). The index page is unchanged: it keeps deriving the 30-day dashboard at prerender and shipping ~12KB. The ~500KB `/history.json` (~120KB gzipped) is fetched only when a user first opens a modal.

## View-model — `buildProjectDetail`

```ts
buildProjectDetail(project: TrackedProject, history: History): ProjectDetail
```

Reuses the date-axis / daily-merge logic already in `app/utils/dashboard.ts` (`mergeDaily`, the latest-date/axis helpers) — extract the shared bits into small exported helpers rather than duplicating.

Produces:
- **Chart axis**: a continuous daily axis from the project's earliest recorded date to the latest, so lines are continuous. Per package, the `daily` map (positive days only) is aligned to this axis, zero-filling gaps. vue-data-ui downsampling + the zoom minimap handle the large point count.
- **Per package** `{ registry, name, repo, total, last7, last30, stars, series: number[] }` (+ npm/Packagist/GitHub URLs).
- **Project stats**: period totals (7 / 30 / 90 / 365 / all) from the combined daily map; **peak day** `{ date, downloads }` (combined); **average per day** over the active range; **first tracked date**.

Missing package (absent from history) -> empty series, zeroed stats. Empty project -> empty axis, everything zero.

## Chart — `VueUiXy` (vue-data-ui)

- Import: `import { VueUiXy } from 'vue-data-ui'`; CSS `vue-data-ui/style.css` registered globally in `nuxt.config.ts`.
- `dataset`: one item per package, `{ name: '<registry> <shortname>', type: 'line', series, color }`, distinct color per registry. Exact dataset-item keys (whether `series` is `number[]` with x-labels supplied via config, or `{x,y}[]`) are **pinned against the installed `VueUiXyDatasetItem` TS type** at implementation.
- `config`: `chart.zoom.show = true` with the **minimap draggable handle** (the `vue-ui-zoom-compact-minimap-handle` style; `handleType` etc.); x-axis labels = the date axis; theme aligned to the app palette. Exact zoom/minimap keys pinned against the installed types.
- Rendered inside `<ClientOnly>` with a skeleton fallback, so the SSG prerender never touches browser APIs. In practice the modal body only mounts on a client click anyway.

## Extra info blocks (modal body)

- **Links**: npm `https://www.npmjs.com/package/<name>`, Packagist `https://packagist.org/packages/<name>`, GitHub `https://github.com/<repo>`.
- **Per-package breakdown**: total, last 7d, last 30d, stars.
- **All-time stats**: peak day (date + count), average downloads/day, first tracked date.
- **Period totals**: 7d / 30d / 90d / 1y / all (combined project).

## Error handling & SSG

- `/history.json` fetch fails -> modal shows an error state with a retry button; the tile and the rest of the page keep working.
- Chart wrapped in `<ClientOnly>` -> no browser API access during prerender.
- Package missing from history -> empty series and zeroed numbers, no crash.

## Non-goals (YAGNI)

- **Per-version downloads.** Verified directly against the APIs: npm exposes per-version data only as a **rolling last-7-days snapshot** (`/versions/<pkg>/last-week`; `last-day` and `last-month` return 404, and there is no per-version range endpoint), so there is **no true daily and no historical/backfillable** per-version series on the npm side. Packagist does expose true per-version daily history, but a per-version view that works for only one of the two registries — and starts empty on the npm side with a non-standard "trailing-7-day" metric — is not worth the schema growth, heavier cron, and extra UI right now. Explicitly deferred.
- **Stars over time** — only the latest star count is stored, not a series.
- No new runtime API, no database; the app stays SSG on Cloudflare Workers.

## Testing & verification

- **Unit** (`test/project-detail.test.ts`, vitest, mirrors `test/dashboard.test.ts`): period-total boundaries (7/30/90/365/all), peak day, average/day, first tracked date, sparse-day alignment on the continuous axis, and the missing-package / empty-project cases.
- **Manual** (`pnpm dev`): open a modal, drag the zoom bounds, confirm one line per package, and spot-check a number (e.g. `symfony/webpack-encore-bundle` total) against its package page.
- `pnpm lint && pnpm typecheck && pnpm test` green (matches CI, which now runs tests).
