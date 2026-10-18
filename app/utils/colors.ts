import type { Registry } from '~~/shared/stats'

export const CORE_COLOR = '#71717a'

export const REGISTRY_COLORS: Record<Registry, string> = {
  npm: '#00DC82',
  packagist: '#F28D1A'
}

const BRIDGE_PALETTE = ['#3b82f6', '#f59e0b', '#a855f7', '#ec4899']

export function bridgeColor(index: number): string {
  return BRIDGE_PALETTE[index % BRIDGE_PALETTE.length] as string
}
