const files = import.meta.glob('~~/data/history/*.json', { eager: true, import: 'default' })

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  const match = Object.entries(files).find(([path]) => path.endsWith(`/${slug}.json`))
  if (!match) {
    throw createError({ statusCode: 404, statusMessage: 'not found' })
  }
  return match[1]
})
