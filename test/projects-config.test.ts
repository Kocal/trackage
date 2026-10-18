import { describe, expect, it } from 'vitest'
import { allPackages, projects } from '../app/data/projects.config'
import { packageKey, projectSlug } from '../shared/stats'

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
    const keys = projects.flatMap(p => allPackages(p).map(pkg => packageKey(pkg.registry, pkg.name)))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('slugs are non-empty and unique', () => {
    const slugs = projects.map(p => projectSlug(p.name))
    for (const slug of slugs) {
      expect(slug.length).toBeGreaterThan(0)
    }
    expect(new Set(slugs).size).toBe(slugs.length)
  })

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
})
