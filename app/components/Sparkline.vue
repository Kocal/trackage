<script setup lang="ts">
// eslint-disable-next-line vue/multi-word-component-names -- sparkline is a deliberate one-word name
defineOptions({ name: 'Sparkline' })

const props = withDefaults(defineProps<{ data: number[], width?: number, height?: number }>(), {
  width: 120,
  height: 32
})

const path = computed(() => {
  const data = props.data
  if (data.length < 2) {
    return ''
  }
  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1
  const stepX = props.width / (data.length - 1)
  return data
    .map((value, i) => {
      const x = i * stepX
      const y = props.height - ((value - min) / span) * props.height
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})
</script>

<template>
  <svg
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    class="text-primary"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path
      v-if="path"
      :d="path"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </svg>
</template>
