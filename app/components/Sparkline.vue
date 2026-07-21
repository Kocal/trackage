<script setup lang="ts">
import { useSparklineHover } from '~/composables/sparklineHover'

// eslint-disable-next-line vue/multi-word-component-names -- sparkline is a deliberate one-word name
defineOptions({ name: 'Sparkline' })

const props = withDefaults(defineProps<{
  values: number[]
  width?: number
  height?: number
}>(), {
  width: 140,
  height: 36
})

const hover = useSparklineHover()
const nf = new Intl.NumberFormat('en-US')
const svgEl = ref<SVGSVGElement | null>(null)

const geometry = computed(() => {
  const values = props.values
  if (values.length < 2) {
    return null
  }
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const stepX = props.width / (values.length - 1)
  const points = values.map((value, i) => ({
    x: i * stepX,
    y: props.height - ((value - min) / span) * props.height
  }))
  return {
    points,
    path: points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }
})

const active = computed(() => {
  const geo = geometry.value
  const i = hover.index.value
  if (!geo || i === null || i < 0 || i >= geo.points.length) {
    return null
  }
  const point = geo.points[i]
  const value = props.values[i]
  if (!point || value === undefined) {
    return null
  }
  return {
    x: point.x,
    y: point.y,
    value,
    date: hover.dates[i] ?? ''
  }
})

const tooltipDate = computed(() => {
  if (!active.value?.date) {
    return ''
  }
  return new Date(active.value.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})

const tooltipStyle = computed(() => {
  const a = active.value
  const el = svgEl.value
  if (!a || !el) {
    return null
  }
  const rect = el.getBoundingClientRect()
  return { left: `${rect.left + a.x}px`, top: `${rect.top + a.y}px` }
})

function onMove(event: PointerEvent) {
  const values = props.values
  if (values.length < 2) {
    return
  }
  const rect = (event.currentTarget as Element).getBoundingClientRect()
  const frac = (event.clientX - rect.left) / rect.width
  hover.index.value = Math.max(0, Math.min(values.length - 1, Math.round(frac * (values.length - 1))))
}

function onLeave() {
  hover.index.value = null
}
</script>

<template>
  <div
    class="relative"
    :style="{ width: `${width}px`, height: `${height}px` }"
  >
    <svg
      ref="svgEl"
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      class="text-primary overflow-visible"
      preserveAspectRatio="none"
      @pointermove="onMove"
      @pointerleave="onLeave"
    >
      <line
        v-if="active"
        :x1="active.x"
        :x2="active.x"
        y1="0"
        :y2="height"
        stroke="currentColor"
        stroke-width="1"
        class="text-muted"
        opacity="0.6"
      />
      <path
        v-if="geometry"
        :d="geometry.path"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
      <circle
        v-if="active"
        :cx="active.x"
        :cy="active.y"
        r="2.5"
        fill="currentColor"
      />
    </svg>
    <Teleport to="body">
      <div
        v-if="tooltipStyle && active"
        class="pointer-events-none fixed z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-inverted px-1.5 py-0.5 text-xs text-inverted shadow-lg"
        :style="{ ...tooltipStyle, transform: 'translate(-50%, calc(-100% - 6px))' }"
      >
        <span class="font-semibold tabular-nums">{{ nf.format(active.value) }}</span>
        <span class="opacity-70"> · {{ tooltipDate }}</span>
      </div>
    </Teleport>
  </div>
</template>
