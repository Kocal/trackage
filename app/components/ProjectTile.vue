<script setup lang="ts">
import type { ProjectView } from '~/utils/dashboard'

defineProps<{ project: ProjectView }>()

const nf = new Intl.NumberFormat('en-US')

function registryIcon(registry: string) {
  return registry === 'npm' ? 'i-simple-icons-npm' : 'i-simple-icons-packagist'
}
</script>

<template>
  <UCard variant="subtle">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-semibold truncate">
          {{ project.name }}
        </h3>
        <Sparkline :values="project.sparkline" />
      </div>
    </template>

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
  </UCard>
</template>
