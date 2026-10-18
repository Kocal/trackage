# trackage — bridge families (design)

Date: 2026-10-18
Status: approved

## Context

Some tracked packages are a core package plus bridges: UX Map with its Leaflet and Google Maps bridges, UX Image with its Cloudflare, Cloudinary, Imgix and KeyCDN bridges. Each of them is currently a separate top-level project, so the dashboard shows 9 cards for 2 products and you cannot read a product's cumulative installs and stars.

Every bridge requires its core package (verified on Packagist: `symfony/ux-leaflet-map` and `symfony/ux-google-map` require `symfony/ux-map`; the 4 image bridges require `symfony/ux-image`). So every bridge install is also a core install, and the numbers show it: `symfony/ux-map` has 340,886 installs, `ux-leaflet-map` 258,714 and `ux-google-map` 80,969. Summing the packages would count each app about twice.

## Goal

One card per family (core + its bridges) that shows the family's cumulative installs and stars, while each bridge stays readable on its own, on the card and in the detail modal.

## Decisions (locked with the user)

- **Headline number = the core package's installs.** It is the number of apps using the product, each counted once. Bridges are a breakdown of that number, never added to it. (User picked this over a plain sum of all packages after seeing both with real data.)
- **Stars = summed across every repo of the family** (core + bridges, distinct repos).
- **npm downloads of the bridges are shown aside** ("+ N npm"), never added to the installs headline.
- **Card breakdown = one row per bridge with its own 30-day sparkline** (user picked this over a plain list and over share bars).
- **Modal chart = one line per package of the family, like today.**

## Anti-goals

- The headline double-counts (core + bridges summed).
- The migration loses backfilled history (see Data migration).
- Bridges become indistinguishable from each other or from the core.

## Non-goals

- No share percentages, no stacked share bars.
- No "installs without a bridge" figure (core minus bridges).
- No per-bridge modal: the family has one modal.
- No auto-detection of bridges from composer dependencies; families are declared in the config.
- Cards without bridges (Webpack Encore, Reprise, UX Vue, UX Router, ...) do not change, card or modal.

## Config — `app/data/projects.config.ts`

```ts
export interface TrackedBridge {
  name: string // short label, e.g. 'Leaflet'
  packages: TrackedPackage[]
}

export interface TrackedProject {
  name: string
  packages: TrackedPackage[] // for a family: the core package(s)
  bridges?: TrackedBridge[]
}
```

The 6 top-level bridge projects (UX Leaflet Map, UX Google Map, UX Cloudflare Image, UX Cloudinary Image, UX Imgix Image, UX KeyCDN Image) are removed and nested:

- **UX Map**: core `packagist symfony/ux-map`; bridges `Leaflet` (packagist + npm `ux-leaflet-map`), `Google Maps` (packagist + npm `ux-google-map`).
- **UX Image**: core `packagist symfony/ux-image`; bridges `Cloudflare`, `Cloudinary`, `Imgix`, `KeyCDN` (packagist only, `symfony/ux-<name>-image`).

Each package keeps its own `repo` (bridges have their own split repo, e.g. `symfony/ux-leaflet-map`). A family card sits where its core project sits in the config order today.

A small exported helper returns every package of a project, core then bridges (e.g. `allPackages(project)`), so callers do not each re-flatten the list.

## Data — one history file per card

Each top-level project keeps exactly one `data/history/<slug>.json`, and for a family that file holds the core and all bridge packages. The modal keeps fetching a single `/history/<slug>.json` per card, so `useProjectHistory`, the `[slug].json` server route, the prerender route list (derived from top-level projects) and `/api/dashboard` (which merges every history file) need no structural change.

`scripts/fetch-stats.ts` iterates `allPackages(project)` instead of `project.packages`.

### Data migration (one-off, committed)

The daily cron only refetches the last ~35 days, so the backfilled history of the bridges (years of daily data) exists only in their current files. It must be moved, not re-fetched:

- merge `.packages` of `ux-leaflet-map.json` and `ux-google-map.json` into `ux-map.json`;
- merge `.packages` of `ux-cloudflare-image.json`, `ux-cloudinary-image.json`, `ux-imgix-image.json`, `ux-keycdn-image.json` into `ux-image.json`;
- `generatedAt` = the most recent of the merged files;
- delete the 6 old files.

Use jq. Verify that every package key from the old files is present in the new file with an identical `daily` map and `total`.

## Dashboard view-model — `app/utils/dashboard.ts`

For a family, the existing `ProjectView` fields keep meaning "the card's headline", computed from the core packages only: `combinedTotal`, `combinedLast7`, `combinedLast30`, `sparkline`, `packages`. For a project without bridges they are computed exactly as today.

New fields on `ProjectView`:

- `bridges: BridgeView[]` (empty for a project without bridges), in config order;
- `totalStars`: stars summed over distinct repos of core + bridges;
- `bridgesNpmTotal`: all-time total of the bridges' npm packages (0 when none).

```ts
export interface BridgeView {
  name: string
  color: string
  total: number // the bridge's Packagist packages, all-time
  last30: number
  sparkline: number[] // the bridge's Packagist packages, on the shared 30-day axis
  stars: number
  packages: PackageView[] // all of the bridge's packages, npm included
}
```

Bridge row figures use the bridge's Packagist packages. Its npm packages only feed `bridgesNpmTotal` and the modal.

Dashboard-level totals:

- `totalDownloads` = sum of each card's headline (`combinedTotal`). Bridges' installs are already inside their core; bridges' npm downloads are left out of this total (my call: the header sums what the cards headline).
- `totalStars` = distinct repos across all packages, bridges included.

### Colors

A fixed palette of at least 4 distinct colors, assigned by bridge index within its family. The same color is used for the bridge's dot and sparkline on the card and for its lines in the modal chart. The exact palette is the builder's call, but it must stay readable in light and dark mode.

## Card — `app/components/ProjectTile.vue`

Projects without bridges render exactly as today. A family renders:

- **Header**: family name, a muted "+ N bridges", the core's 30-day sparkline.
- **Headline**: `combinedTotal` labelled "installs", then "★ totalStars".
- **Sub-line**: the existing "N last 7 days · N last 30 days" (core), plus "+ N npm downloads" from `bridgesNpmTotal` when it is above 0.
- **One row per bridge**: colored dot, bridge name, its 30-day sparkline in the bridge color, total installs, ★ stars.

No core package row: the headline is the core. UI strings stay in English like the rest of the app.

`Sparkline.vue` gets an optional color prop (defaults to today's `text-primary`). Bridge sparklines use the same component and the shared `provideSparklineHover` axis, so hovering any sparkline moves the crosshair on every card and every bridge row. A smaller size than the header sparkline is fine (mockup used 110×24).

Hover on bridge rows (decided with the user): bridge sparklines show no floating value bubble, because at ~24px per row each bubble would cover the row above it. `Sparkline.vue` gets a prop to turn its bubble off (crosshair and dot stay). While the shared hover index is set, each bridge row's total shows that day's value from its own sparkline series, and the total returns when the hover ends. The header sparkline of a family card keeps its bubble, as today.

## Modal — `app/utils/projectDetail.ts` + `ProjectDetailModal.vue`

Projects without bridges render exactly as today (lines colored by registry, totals from all packages).

For a family:

- **Chart**: one line per package of the family: the core in a neutral color, then each bridge package in its bridge color, npm packages dashed (`dashed: true` exists on the installed `VueUiXyDatasetItem` type). Weekly bucketing and the zoom minimap stay as today. The color/dash decision lives in the view-model so the component only maps it.
- **Header**: core total labelled "installs", "+ N npm downloads" (bridges), "N stars" (`totalStars`).
- **Period totals** (7d / 30d / 90d / 1y / all), **peak day**, **avg/day**, **first tracked**: computed from the core packages only. For a project without bridges the core is every package, so behaviour is unchanged.
- **Package list**: every package (core, then bridges in config order), each row tagged with its member (core or bridge name, with the bridge's colored dot), keeping total / 7d / 30d / stars and the registry and GitHub links.

`buildProjectDetail` gains the same `totalStars` (core + bridges, distinct repos) and `bridgesNpmTotal` semantics as the dashboard; each `PackageDetail` gains its member, color and dashed flag.

## Testing & verification

- `test/projects-config.test.ts`: duplicate package keys checked across `allPackages`; every bridge has a non-empty name and at least one valid package.
- `test/dashboard.test.ts`: a family's headline equals the core total, not the sum; bridge views carry the right Packagist totals, 30-day series and stars; `totalStars` counts distinct repos including bridges; `bridgesNpmTotal`; dashboard `totalDownloads` excludes bridges; a project without bridges is unchanged.
- `test/project-detail.test.ts`: family period totals / peak day come from the core only; packages include the bridge packages with member, color, and dashed for npm; a project without bridges is unchanged.
- Migration check (jq) as described above.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green; the build prerenders 6 fewer `/history/*.json` routes.
- Manual (`pnpm dev`): UX Map card shows 340,886-ish installs, ★ 43, Leaflet and Google rows with their own sparklines; hovering any sparkline moves the crosshair on every bridge row and swaps each bridge row's total for that day's value, with no bubble overlapping the rows; the modal shows 5 lines (npm dashed) and per-member package rows. UX Image card shows 4 bridge rows.
