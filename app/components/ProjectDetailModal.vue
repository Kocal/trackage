<script setup lang="ts">
import type { ProjectView } from '~/utils/dashboard'
import { buildProjectDetail } from '~/utils/projectDetail'
import { useHistory } from '~/composables/useHistory'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ project: ProjectView | null }>()

const VueUiXy = defineAsyncComponent(() => import('vue-data-ui/vue-ui-xy'))

const { history, pending, error, load } = useHistory()
const nf = new Intl.NumberFormat('en-US')

watch(open, (value) => {
  if (value) {
    load()
  }
})

const detail = computed(() => {
  if (!props.project || !history.value) {
    return null
  }
  return buildProjectDetail(props.project, history.value)
})

const dataset = computed(() => {
  const d = detail.value
  if (!d) {
    return []
  }
  return d.packages.map(p => ({
    name: `${p.registry} · ${p.name}`,
    type: 'line' as const,
    color: p.registry === 'npm' ? '#00DC82' : '#F28D1A',
    series: p.series.map((y, x) => ({ x, y }))
  }))
})

const chartConfig = computed(() => ({
  responsive: true,
  chart: {
    backgroundColor: 'transparent',
    zoom: {
      show: true,
      minimap: {
        show: true,
        compact: true,
        handleType: 'grab' as const
      }
    },
    grid: {
      labels: {
        xAxisLabels: {
          show: true,
          values: detail.value?.dates ?? [],
          showOnlyFirstAndLast: true
        }
      }
    }
  }
}))

const periodCards = computed(() => {
  const t = detail.value?.totals
  if (!t) {
    return []
  }
  return [
    { label: '7 days', value: t.d7 },
    { label: '30 days', value: t.d30 },
    { label: '90 days', value: t.d90 },
    { label: '1 year', value: t.d365 },
    { label: 'All time', value: t.all }
  ]
})

function registryIcon(registry: string) {
  return registry === 'npm' ? 'i-simple-icons-npm' : 'i-simple-icons-packagist'
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="project?.name ?? ''"
    :ui="{ content: 'max-w-5xl' }"
  >
    <template #body>
      <div
        v-if="detail"
        class="space-y-6"
      >
        <div class="flex flex-wrap items-baseline gap-2">
          <span class="text-2xl font-bold tabular-nums">{{ nf.format(detail.combinedTotal) }}</span>
          <span class="text-sm text-muted">total downloads · {{ nf.format(detail.totalStars) }} stars</span>
        </div>

        <ClientOnly>
          <div
            v-if="dataset.length"
            class="h-80 w-full"
          >
            <VueUiXy
              :dataset="dataset"
              :config="chartConfig"
            />
          </div>
          <template #fallback>
            <USkeleton class="h-80 w-full" />
          </template>
        </ClientOnly>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div
            v-for="card in periodCards"
            :key="card.label"
            class="rounded-lg bg-elevated/50 p-3"
          >
            <div class="text-xs text-muted">
              {{ card.label }}
            </div>
            <div class="text-lg font-semibold tabular-nums">
              {{ nf.format(card.value) }}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            Peak day:
            <span class="font-semibold tabular-nums">{{ detail.peakDay ? `${nf.format(detail.peakDay.downloads)} on ${detail.peakDay.date}` : '—' }}</span>
          </div>
          <div>
            Avg/day: <span class="font-semibold tabular-nums">{{ nf.format(detail.averagePerDay) }}</span>
          </div>
          <div>
            First tracked: <span class="font-semibold">{{ detail.firstTrackedDate ?? '—' }}</span>
          </div>
        </div>

        <div class="space-y-2">
          <div
            v-for="pkg in detail.packages"
            :key="`${pkg.registry}:${pkg.name}`"
            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default p-3 text-sm"
          >
            <div class="flex min-w-0 items-center gap-2">
              <UIcon :name="registryIcon(pkg.registry)" />
              <span class="truncate font-mono text-xs">{{ pkg.name }}</span>
            </div>
            <div class="flex items-center gap-4 tabular-nums text-muted">
              <span>{{ nf.format(pkg.total) }} total</span>
              <span>{{ nf.format(pkg.last7) }} 7d</span>
              <span>{{ nf.format(pkg.last30) }} 30d</span>
              <span class="flex items-center gap-0.5">
                <UIcon
                  name="i-lucide-star"
                  class="text-warning"
                />
                {{ nf.format(pkg.stars) }}
              </span>
              <UButton
                :to="pkg.packageUrl"
                target="_blank"
                size="xs"
                variant="ghost"
                color="neutral"
                :icon="registryIcon(pkg.registry)"
                :aria-label="`${pkg.name} on ${pkg.registry}`"
              />
              <UButton
                :to="pkg.githubUrl"
                target="_blank"
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-simple-icons-github"
                :aria-label="`${pkg.name} on GitHub`"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="pending"
        class="space-y-4"
      >
        <USkeleton class="h-64 w-full" />
      </div>

      <div
        v-else-if="error"
        class="flex items-center gap-3 text-sm text-error"
      >
        Failed to load chart data.
        <UButton
          size="xs"
          variant="soft"
          @click="load"
        >
          Retry
        </UButton>
      </div>
    </template>
  </UModal>
</template>
