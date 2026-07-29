import type { Registry } from '../../shared/stats'

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
      { registry: 'packagist', name: 'symfony/ux-vue', repo: 'symfony/ux-vue' },
      { registry: 'npm', name: '@symfony/ux-vue', repo: 'symfony/ux-vue' }
    ]
  },
  {
    name: 'UX Translator',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-translator', repo: 'symfony/ux-translator' },
      { registry: 'npm', name: '@symfony/ux-translator', repo: 'symfony/ux-translator' }
    ]
  },
  {
    name: 'UX Toolkit',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-toolkit', repo: 'symfony/ux-toolkit' }
    ]
  },
  {
    name: 'UX React',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-react', repo: 'symfony/ux-react' },
      { registry: 'npm', name: '@symfony/ux-react', repo: 'symfony/ux-react' }
    ]
  },
  {
    name: 'UX Native',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-native', repo: 'symfony/ux-native' },
      { registry: 'npm', name: '@symfony/ux-native', repo: 'symfony/ux-native' }
    ]
  },
  {
    name: 'UX Leaflet Map',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-leaflet-map', repo: 'symfony/ux-leaflet-map' },
      { registry: 'npm', name: '@symfony/ux-leaflet-map', repo: 'symfony/ux-leaflet-map' }
    ]
  },
  {
    name: 'UX Google Map',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-google-map', repo: 'symfony/ux-google-map' },
      { registry: 'npm', name: '@symfony/ux-google-map', repo: 'symfony/ux-google-map' }
    ]
  },
  {
    name: 'UX Map',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-map', repo: 'symfony/ux-map' }
    ]
  },
  {
    name: 'UX Calendar Link',
    packages: [
      { registry: 'packagist', name: 'symfony/ux-calendar-link', repo: 'symfony/ux-calendar-link' }
    ]
  },
  {
    name: 'PHPStan Symfony UX',
    packages: [
      { registry: 'packagist', name: 'kocal/phpstan-symfony-ux', repo: 'Kocal/phpstan-symfony-ux' }
    ]
  },
  {
    name: 'Biome.js Bundle',
    packages: [
      { registry: 'packagist', name: 'kocal/biome-js-bundle', repo: 'Kocal/BiomeJsBundle' }
    ]
  },
  {
    name: 'Symfony Mailer Testing',
    packages: [
      { registry: 'packagist', name: 'kocal/symfony-mailer-testing', repo: 'Kocal/SymfonyMailerTesting' }
    ]
  },
  {
    name: 'Oxc Bundle',
    packages: [
      { registry: 'packagist', name: 'kocal/oxc-bundle', repo: 'Kocal/OxcBundle' }
    ]
  }
]
