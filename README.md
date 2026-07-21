# trackage

A personal dashboard that shows download and star stats for my npm and Packagist packages in one place.

It's a single static page with one tile per project. Projects that ship a linked PHP (Packagist) + JS (npm) package are grouped into one tile with a combined headline. Each tile shows total downloads, downloads over the last 30 days, GitHub stars, and a 30-day sparkline. Hovering any sparkline shows a synchronized crosshair and tooltip across every chart.

## Stack

Nuxt 4 + Nuxt UI v4 + Tailwind 4, TypeScript, pnpm. Deployed on Cloudflare Workers (static assets, with the page prerendered at build via SSG).

## How the data works

`scripts/fetch-stats.ts` fetches the full day-by-day download history (npm via the `/downloads/range` API, Packagist via its daily stats endpoint) plus GitHub stars, and writes `data/history.json`.

A daily GitHub Action (`.github/workflows/update-stats.yml`) runs it in incremental mode (last ~35 days) and commits the updated JSON. That push triggers a Cloudflare Workers build and redeploy.

The app imports the committed JSON at build time and computes totals, last-30-days, and sparklines in the browser-facing view-model. The raw ~500KB daily history is code-split out so it never ships to the client -> the page payload is ~12KB.

## Commands

- `pnpm install` - install deps
- `pnpm dev` - dev server at http://localhost:3000
- `pnpm test` - run the vitest unit tests
- `pnpm lint` / `pnpm typecheck` - the CI gates
- `pnpm stats` - fetch the last ~35 days and update `data/history.json` (needs `GITHUB_TOKEN` in the env for GitHub stars; the daily Action provides it)
- `BACKFILL=1 pnpm stats` - one-off full re-seed of all-time daily history (npm from 2015, Packagist from 2012)
- `pnpm build` - production build (Cloudflare Workers output in `.output/`; `wrangler.jsonc` points `wrangler deploy` at it)

## Tracking a package

Edit `app/data/projects.config.ts`. Each project lists its packages as `{ registry: 'npm' | 'packagist', name, repo }`, where `repo` is the `owner/name` of the GitHub repo whose stars to show.

Symfony UX packages each use their own split repo (e.g. `symfony/ux-vue`), not the `symfony/ux` monorepo.

## Setup (owner-only, one time)

1. Add the GitHub remote and push: `git remote add origin git@github.com:kocal/trackage.git` then `git push -u origin main`.
2. In the Cloudflare dashboard: Workers -> import the GitHub repo (Workers Builds), build command `pnpm build`, deploy command `npx wrangler deploy` (it reads `wrangler.jsonc`). It then redeploys on every push to `main`.
3. In the GitHub repo: Settings -> Actions -> General -> Workflow permissions -> **Read and write**, so the daily cron can commit and push `data/history.json`.
