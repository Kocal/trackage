# trackage — package-stats dashboard (design)

Date: 2026-07-21
Status: approved

> **Note (2026-07-28):** deployment later moved from Cloudflare Pages to Cloudflare **Workers** (static assets, Nitro `cloudflare_module` preset, `wrangler.jsonc` with an `ASSETS` binding). The "Cloudflare Pages" and `cloudflare-pages` references below are historical. The build-on-push-to-`main` -> SSG model is unchanged.

## Context

I maintain a set of PHP (Packagist) and JS (npm) packages, several of them linked (a PHP bundle plus its JS counterpart). Today I check download counts and GitHub stars one package page at a time. `trackage` is a single dashboard that shows all of them at a glance: total / last-30-days / last-day downloads, GitHub stars, and a 30-day trend sparkline per package, with linked PHP+JS packages grouped into one tile.

Stats are refreshed by a daily GitHub Action that commits a JSON history file to the repo. Committing to `main` triggers a Cloudflare Pages rebuild; the Nuxt app reads the committed JSON at build time (SSG). No runtime data fetch, no database.

Stack (already scaffolded): Nuxt 4.4, Nuxt UI v4, Tailwind 4, pnpm, ESLint. Deploy: Cloudflare Pages.

## Decisions (locked with the user)

- **Rendering**: static SSG, rebuilt on each cron commit. Cloudflare Pages auto-builds on push to `main`.
- **Metrics per package**: total downloads, last 30 days, last full day ("yesterday", the closest available to "24h"), 30-day sparkline, GitHub stars.
- **GitHub stars**: per package, repeated — packages that share a monorepo (e.g. `symfony/ux`) each display that repo's star count.
- **Grouping**: linked PHP+JS packages render as one tile with a combined headline download number plus a per-package breakdown.

## Architecture

```
app/data/projects.config.ts ─┐
                             ├─►  scripts/fetch-stats.ts  ──►  data/history.json (committed)
GitHub Action (daily cron) ──┘        npm + Packagist + GitHub APIs        │
                                                                           ▼
                 git push main ──► Cloudflare Pages build ──► Nuxt SSG reads JSON ──► deploy
```

### Data pipeline

- `.github/workflows/update-stats.yml`: schedule `0 4 * * *` + `workflow_dispatch`, permissions `contents: write`. Installs deps, runs `pnpm tsx scripts/fetch-stats.ts`, commits `data/history.json` if changed, pushes to `main`.
- `scripts/fetch-stats.ts`: for every package in the config, fetch current stats, append a dated snapshot to `data/history.json`, dedupe by date (idempotent — a second run same day overwrites that day's entry rather than duplicating).
- The push to `main` is what triggers the Cloudflare Pages build. The workflow does not deploy directly.

### Config — `app/data/projects.config.ts` (single source of truth)

One entry per project; a project bundles one or more packages and their repos.

```ts
export interface TrackedPackage {
  registry: 'npm' | 'packagist'
  name: string        // '@symfony/webpack-encore' | 'symfony/webpack-encore-bundle'
  repo: string        // 'owner/name' on GitHub
}
export interface TrackedProject {
  name: string
  packages: TrackedPackage[]
}
```

Projects to track (npm counterpart existence to be verified while wiring — flagged below):

Grouped (PHP + JS):
- **Webpack Encore** — npm `@symfony/webpack-encore` (repo `symfony/webpack-encore`) + packagist `symfony/webpack-encore-bundle` (repo `symfony/webpack-encore-bundle`)
- **Reprise** — npm `@symfony/reprise` + packagist `symfony/reprise` (repo `symfony/reprise`)
- **UX Vue** — packagist `symfony/ux-vue` + npm `@symfony/ux-vue` (repo `symfony/ux`)
- **UX Translator** — packagist `symfony/ux-translator` + npm `@symfony/ux-translator` (repo `symfony/ux`)
- **UX Toolkit** — packagist `symfony/ux-toolkit` + npm `@symfony/ux-toolkit`? (repo `symfony/ux`)
- **UX React** — packagist `symfony/ux-react` + npm `@symfony/ux-react` (repo `symfony/ux`)
- **UX Native** — packagist `symfony/ux-native` + npm `@symfony/ux-native`? (repo `symfony/ux`)
- **UX Leaflet Map** — packagist `symfony/ux-leaflet-map` + npm `@symfony/ux-leaflet-map` (repo `symfony/ux`)
- **UX Google Map** — packagist `symfony/ux-google-map` + npm `@symfony/ux-google-map` (repo `symfony/ux`)
- **UX Map** — packagist `symfony/ux-map` + npm `@symfony/ux-map` (repo `symfony/ux`)
- **UX Calendar Link** — packagist `symfony/ux-calendar-link` + npm `@symfony/ux-calendar-link`? (repo `symfony/ux`)

PHP-only:
- **PHPStan Symfony UX** — packagist `kocal/phpstan-symfony-ux` (repo `kocal/phpstan-symfony-ux`)
- **Biome.js bundle** — packagist `kocal/biome-js-bundle` (repo `kocal/biome-js-bundle`)
- **Symfony Mailer Testing** — packagist `kocal/symfony-mailer-testing` (repo `kocal/symfony-mailer-testing`)
- **Oxc bundle** — packagist `kocal/oxc-bundle` (repo `kocal/oxc-bundle`)

Packages marked `?` get their npm counterpart included only if it actually resolves on the registry; otherwise the project is PHP-only.

### Data model — `data/history.json`

```json
{
  "generatedAt": "2026-07-21T04:00:00.000Z",
  "packages": {
    "npm:@symfony/webpack-encore": [
      { "date": "2026-07-21", "total": 12345678, "last30": 456789, "lastDay": 15678, "stars": 880 }
    ],
    "packagist:symfony/webpack-encore-bundle": [
      { "date": "2026-07-21", "total": 98765432, "last30": 234567, "lastDay": 8901, "stars": 700 }
    ]
  }
}
```

- Package key = `<registry>:<name>`.
- One snapshot per day per package; the array is the time series that feeds sparklines (last 30 entries) and deltas.
- Small, diff-friendly, human-readable.
- **Init backfill**: on first run, seed the last ~30 days of daily history from npm `/downloads/range` and Packagist so sparklines are populated immediately instead of after 30 days of cron runs.

### Fetching (grounded in the user's reference links)

- **npm** — use `https://api.npmjs.org/downloads/range/{start}:{end}/{pkg}`, chunked at ~500 days from 2015 to today, summing daily values for `total`. The naive `/downloads/point/` endpoint silently truncates at 18 months (per the TanStack article) and must not be used for all-time totals. `last30` and `lastDay` are derived from the tail of the range series. Scoped names (`@symfony/...`) work per-package on the range endpoint.
- **Packagist** — `https://packagist.org/packages/{vendor}/{pkg}.json` -> `downloads.{total,monthly,daily}`, `favers` (stars), `repository`. `last30 ≈ monthly`, `lastDay ≈ daily`.
- **GitHub stars** — `GET https://api.github.com/repos/{owner}/{repo}` -> `stargazers_count`, authenticated with the Action's built-in `GITHUB_TOKEN` for rate limits.
- Rate-limit handling: sequential with light backoff; the whole run is a handful of requests per package, once per day.

### UI — single page `/`, Nuxt UI v4

- Header: aggregate totals across all projects + "updated {relative time}" from `generatedAt`. Color mode toggle already present.
- Responsive **tile grid** of projects.
- **Grouped tile** contents:
  - Project name.
  - Combined headline download number, explicitly labeled to signal it mixes ecosystems (e.g. "installs · npm + Packagist"), plus a 30-day **sparkline**.
  - Per-package rows: registry icon (simple-icons npm / packagist-or-php, github), total / last-30d / yesterday, star count.
- **Sparkline**: dependency-free inline **SVG** component `app/components/Sparkline.vue` (Nuxt UI ships no chart component). Unovis is a possible later upgrade if richer charts are wanted.
- Data flow: `app/pages/index.vue` imports `data/history.json` and `projects.config.ts` at build, derives the per-project view model (combined totals, latest snapshot, sparkline series, deltas).

### Cloudflare

- Nitro `cloudflare-pages` preset (or Pages auto-detection). Keep `routeRules { '/': { prerender: true } }`.
- Cloudflare Pages project connected to the GitHub repo; build command `pnpm build`, output the Nuxt static dir. Auto-build on push to `main`.

## Known caveat

The combined headline sums npm + Composer downloads, which are different units. It is a rough "reach" indicator, not a precise metric, and the UI labels it as such. The per-package breakdown carries the accurate, comparable numbers.

## Non-goals (YAGNI)

- No database, no runtime API, no user accounts, no auth.
- No hourly granularity (neither registry exposes it).
- No historical charts beyond a 30-day sparkline.
- No alerting/notifications.

## Verification

- `pnpm dev` renders all tiles from a committed sample `data/history.json`.
- `pnpm tsx scripts/fetch-stats.ts` locally produces valid JSON with numbers matching the npm/Packagist web pages for a spot-checked package.
- `pnpm lint && pnpm typecheck` green (matches CI).
- Cloudflare Pages preview deploy renders the dashboard.
- Manually dispatch `update-stats.yml` once to confirm the commit-and-push loop works end to end.

## Revision 1 (2026-07-21)

Two design changes agreed after initial implementation:

1. **GitHub stars per package's own repo.** Symfony UX packages are read-only split repos (`symfony/ux-vue`, `symfony/ux-map`, …), each with its own star count — use those, not the `symfony/ux` monorepo. kocal repos use exact casing from their Packagist `repository` field (`Kocal/BiomeJsBundle`, etc.).
2. **Day-by-day data model.** Persist the **full all-time daily download series** per package; compute `last30` (and total, sparkline) **application-side**. Both npm (`/downloads/range/`) and Packagist (`/stats/all.json?average=daily&from=<date>`) provide daily series, so both are fully backfilled at seed. This also removes the earlier "sparklines start empty" limitation.

New `data/history.json` shape: `packages[<key>] = { total, stars, daily: { "YYYY-MM-DD": downloads } }`. Displayed metrics: **total, last-30-days, 30-day sparkline, stars** (no 7d/yesterday shown). The daily fetch runs in two modes — full backfill for the seed, last-~35-days incremental for the daily cron — to keep scheduled runs light and avoid npm 429 rate-limiting. See the plan's "Revision 1" section for the exact contracts and task breakdown (R1/R2/R3).
