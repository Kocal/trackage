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
