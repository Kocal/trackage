export default defineEventHandler(async (event) => {
  const slugWithExt = getRouterParam(event, 'slug.json')
  const slug = slugWithExt?.replace(/\.json$/, '')
  const item = await useStorage('assets:history').getItem(`${slug}.json`)
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'not found' })
  }
  return item
})
