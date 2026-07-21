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
