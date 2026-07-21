import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { projects } from '../app/data/projects.config'
import { fetchStars } from './lib/github'
import { dailyMap, fetchNpmDays } from './lib/npm'
import { fetchPackagistDaily, fetchPackagistTotal } from './lib/packagist'
import { packageKey, sumDaily, type History } from '../shared/stats'

const HISTORY_PATH = new URL('../data/history.json', import.meta.url)
const token = process.env.GITHUB_TOKEN ?? ''
const backfill = Boolean(process.env.BACKFILL)
const today = new Date().toISOString().slice(0, 10)

function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

const npmStart = backfill ? '2015-01-10' : daysAgo(35)
const packagistFrom = backfill ? '2012-01-01' : daysAgo(35)

async function loadHistory(): Promise<History> {
  try {
    return JSON.parse(await readFile(HISTORY_PATH, 'utf8')) as History
  } catch {
    return { generatedAt: '', packages: {} }
  }
}

async function main() {
  const history = await loadHistory()
  for (const project of projects) {
    for (const pkg of project.packages) {
      const key = packageKey(pkg.registry, pkg.name)
      try {
        const stars = await fetchStars(pkg.repo, token).catch(() => history.packages[key]?.stars ?? 0)
        const existingDaily = history.packages[key]?.daily ?? {}
        if (pkg.registry === 'npm') {
          const days = await fetchNpmDays(pkg.name, npmStart, today)
          const daily = { ...existingDaily, ...dailyMap(days) }
          history.packages[key] = { total: sumDaily(daily), stars, daily }
        } else {
          const daily = { ...existingDaily, ...(await fetchPackagistDaily(pkg.name, packagistFrom)) }
          const { total } = await fetchPackagistTotal(pkg.name)
          history.packages[key] = { total, stars, daily }
        }
        console.log(`ok  ${key}  total=${history.packages[key].total} stars=${stars} days=${Object.keys(history.packages[key].daily).length}`)
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
