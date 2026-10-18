<script setup lang="ts">
import { useSparklineHover } from '~/composables/sparklineHover'
import type { BridgeView, ProjectView } from '~/utils/dashboard'

defineProps<{ project: ProjectView }>()

const emit = defineEmits<{ open: [] }>()

const nf = new Intl.NumberFormat('en-US')
const hover = useSparklineHover()

function registryIcon(registry: string) {
  return registry === 'npm' ? 'i-simple-icons-npm' : 'i-simple-icons-packagist'
}

function bridgeFigure(bridge: BridgeView): number {
  const index = hover.index.value
  const value = index === null ? undefined : bridge.sparkline[index]
  return value ?? bridge.total
}
</script>

<template>
  <UCard
    variant="subtle"
    role="button"
    tabindex="0"
    class="cursor-pointer transition hover:ring-2 hover:ring-primary/40"
    @click="emit('open')"
    @keydown.enter="emit('open')"
    @keydown.space.prevent="emit('open')"
  >
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-semibold truncate">
          {{ project.name }}
          <span
            v-if="project.bridges.length"
            class="text-xs font-normal text-muted"
          >+ {{ project.bridges.length }} {{ project.bridges.length === 1 ? 'bridge' : 'bridges' }}</span>
        </h3>
        <Sparkline :values="project.sparkline" />
      </div>
    </template>

    <template v-if="project.bridges.length">
      <div class="flex items-baseline gap-2">
        <span class="text-2xl font-bold tabular-nums">{{ nf.format(project.combinedTotal) }}</span>
        <span class="text-xs text-muted">installs</span>
        <span class="flex items-center gap-0.5 text-sm text-muted tabular-nums">
          <UIcon
            name="i-lucide-star"
            class="text-warning"
          />
          {{ nf.format(project.totalStars) }}
        </span>
      </div>
      <p class="mt-1 text-sm text-muted tabular-nums">
        {{ nf.format(project.combinedLast7) }} last 7 days · {{ nf.format(project.combinedLast30) }} last 30 days
      </p>
      <p
        v-if="project.bridgesNpmTotal > 0"
        class="text-xs text-muted tabular-nums"
      >
        + {{ nf.format(project.bridgesNpmTotal) }} npm downloads
      </p>

      <div class="@container mt-4 space-y-2">
        <div
          v-for="bridge in project.bridges"
          :key="bridge.name"
          class="flex items-center justify-between gap-2 text-sm"
        >
          <div class="flex items-center gap-1.5 min-w-0">
            <span
              class="size-2 shrink-0 rounded-full"
              :style="{ backgroundColor: bridge.color }"
            />
            <span class="truncate">{{ bridge.name }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0 tabular-nums text-muted">
            <Sparkline
              class="hidden @min-[19.25rem]:block"
              :values="bridge.sparkline"
              :color="bridge.color"
              :tooltip="false"
              :width="80"
              :height="24"
            />
            <span class="w-16 text-right">{{ nf.format(bridgeFigure(bridge)) }}</span>
            <span class="flex w-10 items-center justify-end gap-0.5">
              <UIcon
                name="i-lucide-star"
                class="text-warning"
              />
              {{ nf.format(bridge.stars) }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="flex items-baseline gap-2">
        <span class="text-2xl font-bold tabular-nums">{{ nf.format(project.combinedTotal) }}</span>
        <span class="text-xs text-muted">total downloads</span>
      </div>
      <p class="mt-1 text-sm text-muted tabular-nums">
        {{ nf.format(project.combinedLast7) }} last 7 days · {{ nf.format(project.combinedLast30) }} last 30 days
      </p>

      <div class="mt-4 space-y-2">
        <div
          v-for="pkg in project.packages"
          :key="`${pkg.registry}:${pkg.name}`"
          class="flex items-center justify-between gap-2 text-sm"
        >
          <div class="flex items-center gap-1.5 min-w-0">
            <UIcon :name="registryIcon(pkg.registry)" />
            <span class="truncate font-mono text-xs">{{ pkg.name }}</span>
          </div>
          <div class="flex items-center gap-3 shrink-0 tabular-nums text-muted">
            <span>{{ nf.format(pkg.total) }}</span>
            <span class="flex items-center gap-0.5">
              <UIcon
                name="i-lucide-star"
                class="text-warning"
              />
              {{ nf.format(pkg.stars) }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </UCard>
</template>
