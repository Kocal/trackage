import type { Registry } from '~~/shared/stats'

export interface TrackedPackage {
  registry: Registry
  name: string
  repo: string
}

export interface TrackedProject {
  name: string
  packages: TrackedPackage[]
}

export const projects: TrackedProject[] = [
  {
    name: 'Webpack Encore',
    packages: [
      { registry: 'npm', name: '@symfony/webpack-encore', repo: 'symfony/webpack-encore' },
      { registry: 'packagist', name: 'symfony/webpack-encore-bundle', repo: 'symfony/webpack-encore-bundle' }
    ]
  },
  {
    name: 'Reprise',
    packages: [
      { registry: 'npm', name: '@symfony/reprise', repo: 'symfony/reprise' },
      { registry: 'packagist', name: 'symfony/reprise', repo: 'symfony/reprise' }
    ]
  },
  {
    name: 'UX Vue',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-vue', repo: 'symfony/ux' },
      { registry: 'npm', name: '@symfony/ux-vue', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX Translator',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-translator', repo: 'symfony/ux' },
      { registry: 'npm', name: '@symfony/ux-translator', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX Toolkit',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-toolkit', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX React',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-react', repo: 'symfony/ux' },
      { registry: 'npm', name: '@symfony/ux-react', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX Native',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-native', repo: 'symfony/ux' },
      { registry: 'npm', name: '@symfony/ux-native', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX Leaflet Map',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-leaflet-map', repo: 'symfony/ux' },
      { registry: 'npm', name: '@symfony/ux-leaflet-map', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX Google Map',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-google-map', repo: 'symfony/ux' },
      { registry: 'npm', name: '@symfony/ux-google-map', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX Map',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-map', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'UX Calendar Link',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-calendar-link', repo: 'symfony/ux' }
    ]
  },
  {
    name: 'PHPStan Symfony UX',
    packages: [
      { registry: 'packagist', name: 'kocal/phpstan-symfony-ux', repo: 'kocal/phpstan-symfony-ux' }
    ]
  },
  {
    name: 'Biome.js Bundle',
    packages: [
      { registry: 'packagist', name: 'kocal/biome-js-bundle', repo: 'kocal/biome-js-bundle' }
    ]
  },
  {
    name: 'Symfony Mailer Testing',
    packages: [
      { registry: 'packagist', name: 'kocal/symfony-mailer-testing', repo: 'kocal/symfony-mailer-testing' }
    ]
  },
  {
    name: 'Oxc Bundle',
    packages: [
      { registry: 'packagist', name: 'kocal/oxc-bundle', repo: 'kocal/oxc-bundle' }
    ]
  }
]
