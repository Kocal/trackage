import type { InjectionKey, Ref } from 'vue'

export interface SparklineHover {
  index: Ref<number | null>
  dates: string[]
}

const SPARKLINE_HOVER: InjectionKey<SparklineHover> = Symbol('sparkline-hover')

export function provideSparklineHover(dates: string[]): SparklineHover {
  const state: SparklineHover = { index: ref<number | null>(null), dates }
  provide(SPARKLINE_HOVER, state)
  return state
}

export function useSparklineHover(): SparklineHover {
  return inject(SPARKLINE_HOVER, { index: ref<number | null>(null), dates: [] })
}
