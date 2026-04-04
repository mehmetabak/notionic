import BLOG from '@/blog.config'
import { NotionAPI } from 'notion-client'
import { idToUuid } from 'notion-utils'
import dayjs from '@/lib/day'
import getAllPageIds from './getAllPageIds'
import getPageProperties from './getPageProperties'
import filterPublishedPosts from './filterPublishedPosts'

export async function getAllPosts({
  onlyNewsletter = false,
  onlyPost = false,
  onlyHidden = false
}) {
  try {
    let id = BLOG.notionPageId
    const authToken = BLOG.notionAccessToken || null

    if (!id) {
      console.error('BLOG.notionPageId is missing')
      return []
    }

    const api = new NotionAPI({ authToken })
    const response = await api.getPage(id)

    if (!response || typeof response !== 'object') {
      console.error('Invalid response from Notion API')
      return []
    }

    id = idToUuid(id)

    // Notion API bazen verileri .value.value içine gömüyor.
    // PRE-NORM snapshot — normalizasyon content'i siliyor mu kontrol et
    console.log('PRE-NORM block[id] content:', JSON.stringify(block[id]?.value?.content)?.slice(0, 200))

    if (response.block) {
      Object.keys(response.block).forEach(key => {
        const blockItem = response.block[key]
        if (blockItem?.value?.value) {
          blockItem.value = blockItem.value.value
        }
      })
    }

    const collectionKey = Object.keys(response.collection || {})[0]
    const collectionObj = collectionKey ? response.collection[collectionKey] : null
    if (collectionObj?.value?.value) {
      collectionObj.value = collectionObj.value.value
    }

    // POST-NORM snapshot — normalizasyon sonrası content hâlâ var mı?
    console.log('POST-NORM block[id] content:', JSON.stringify(block[id]?.value?.content)?.slice(0, 200))

    const collectionData = collectionObj?.value
    const schema = collectionData?.schema
    const collectionQuery = response.collection_query
    const block = response.block

    // 👇 Diagnostic logs
    console.log('Looking up block id:', id)
    console.log('Block keys sample:', Object.keys(block || {}).slice(0, 5))
    console.log('block[id] exists:', !!block?.[id])
    console.log('block[id].value:', JSON.stringify(block?.[id]?.value)?.slice(0, 300))

    if (!collectionData || !schema || !block || !block[id]) {
      console.warn('Notion data structure is missing required fields.')
      return []
    }

    const rawMetadata = block[id].value

    if (
      !rawMetadata ||
      (rawMetadata.type !== 'collection_view_page' && rawMetadata.type !== 'collection_view')
    ) {
      console.warn(`Page '${id}' is not a database. Type: ${rawMetadata?.type}`)
      return []
    }

    // collection_query boş gelirse (Notion API değişimi), block content'ten fallback al
    const pageIds = getAllPageIds(collectionQuery)
    const resolvedPageIds = pageIds.length > 0
      ? pageIds
      : (block[id]?.value?.content ?? [])

    console.log('resolvedPageIds count:', resolvedPageIds.length)
    console.log('resolvedPageIds sample:', resolvedPageIds.slice(0, 3))

    const data = []

    for (let i = 0; i < resolvedPageIds.length; i++) {
      const pageId = resolvedPageIds[i]
      const blockValue = block[pageId]?.value

      if (!blockValue) continue

      try {
        const properties = await getPageProperties(pageId, block, schema)

        if (!properties) continue

        properties.id = idToUuid(pageId.replace(/-/g, ''))
        properties.fullWidth = blockValue.format?.page_full_width ?? false
        properties.date = (
          properties.date?.start_date
            ? dayjs.tz(properties.date.start_date)
            : dayjs(blockValue.created_time)
        ).valueOf()

        data.push(properties)
      } catch (err) {
        console.warn(`Skipping page ${pageId}: ${err.message}`)
        continue
      }
    }

    console.log('data collected:', data.length)

    const posts = filterPublishedPosts({
      posts: data,
      onlyNewsletter,
      onlyPost,
      onlyHidden
    })

    console.log('posts after filter:', posts.length)

    if (BLOG.sortByDate) {
      posts.sort((a, b) => b.date - a.date)
    }

    return JSON.parse(JSON.stringify(posts))

  } catch (error) {
    console.error('Error in getAllPosts:', error.message)
    return []
  }
}