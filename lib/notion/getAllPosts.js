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

    const collectionData = collectionObj?.value
    const schema = collectionData?.schema
    const collectionQuery = response.collection_query
    const block = response.block

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

    const posts = filterPublishedPosts({
      posts: data,
      onlyNewsletter,
      onlyPost,
      onlyHidden
    })

    if (BLOG.sortByDate) {
      posts.sort((a, b) => b.date - a.date)
    }

    return JSON.parse(JSON.stringify(posts))

  } catch (error) {
    console.error('Error in getAllPosts:', error.message)
    return []
  }
}