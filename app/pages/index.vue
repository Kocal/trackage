<script setup lang="ts">
import { provideSparklineHover } from '~/composables/sparklineHover'
import { projects } from '~/data/projects.config'
import { buildDashboard } from '~/utils/dashboard'
import type { History } from '~~/shared/stats'

const { data: dashboard } = await useAsyncData('dashboard', async () => {
  const history = (await import('~~/data/history.json')).default as History
  return buildDashboard(projects, history)
})

provideSparklineHover(dashboard.value?.dates ?? [])

const nf = new Intl.NumberFormat('en-US')
const updated = computed(() => dashboard.value?.generatedAt ? new Date(dashboard.value.generatedAt).toLocaleDateString() : 'never')

useSeoMeta({ title: 'trackage', description: 'Download and star stats for my npm and Packagist packages.' })
</script>

<template>
  <div
    v-if="dashboard"
    class="mx-auto w-full max-w-[120rem] px-4 py-8 sm:px-6 lg:px-8"
  >
    <div class="mb-6">
      <h1 class="text-2xl font-bold">
        trackage
      </h1>
      <p class="text-sm text-muted">
        {{ nf.format(dashboard.totalDownloads) }} downloads · {{ nf.format(dashboard.totalStars) }} stars · updated {{ updated }}
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      <ProjectTile
        v-for="project in dashboard.projects"
        :key="project.name"
        :project="project"
      />
    </div>
  </div>
</template>
