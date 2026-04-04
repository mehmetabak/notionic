import BLOG from '@/blog.config'
import { NotionAPI } from 'notion-client'
import { idToUuid } from 'notion-utils'
import dayjs from '@/lib/day'
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

    // Notion API bazen verileri .value.value içine gömüyor — normalize et
    if (response.block) {
      Object.keys(response.block).forEach(key => {
        const blockItem = response.block[key]
        if (blockItem?.value?.value) {
          blockItem.value = blockItem.value.value
        }
      })
    }

    const block = response.block

    if (!block || !block[id]) {
      console.warn('Root block not found in response.')
      return []
    }

    const rootBlock = block[id].value

    if (
      !rootBlock ||
      (rootBlock.type !== 'collection_view_page' && rootBlock.type !== 'collection_view')
    ) {
      console.warn(`Page '${id}' is not a database. Type: ${rootBlock?.type}`)
      return []
    }

    const collectionKey = Object.keys(response.collection || {})[0]
    const collectionObj = collectionKey ? response.collection[collectionKey] : null
    if (collectionObj?.value?.value) {
      collectionObj.value = collectionObj.value.value
    }

    const collectionData = collectionObj?.value
    const schema = collectionData?.schema

    if (!schema) {
      console.warn('Collection schema missing.')
      return []
    }

    // collection_query artık getPage ile gelmiyor.
    // view_ids ve collection_id'yi root block'tan alıp getCollectionData ile çekiyoruz.
    const collectionId = rootBlock.collection_id
    const viewId = rootBlock.view_ids?.[0]

    if (!collectionId || !viewId) {
      console.warn('collection_id or view_id missing from root block.')
      return []
    }

    let resolvedPageIds = []

    try {
      const collectionResult = await api.getCollectionData(
        collectionId,
        viewId,
        {},
        { limit: 9999 }
      )

      // Yeni gelen blokları mevcut block haritasına ekle
      if (collectionResult?.recordMap?.block) {
        Object.assign(block, collectionResult.recordMap.block)
        // Nested value normalizasyonunu yeni bloklar için de uygula
        Object.keys(collectionResult.recordMap.block).forEach(key => {
          const blockItem = block[key]
          if (blockItem?.value?.value) {
            blockItem.value = blockItem.value.value
          }
        })
      }

      // Sayfa ID'lerini çek — önce gruplu görünüm, sonra düz liste
      resolvedPageIds =
        collectionResult?.result?.reducerResults?.collection_group_results?.blockIds ||
        collectionResult?.result?.blockIds ||
        []

      console.log('resolvedPageIds count:', resolvedPageIds.length)
    } catch (err) {
      console.warn('getCollectionData failed:', err.message)
      return []
    }

    if (resolvedPageIds.length === 0) {
      console.warn('No page IDs returned from collection.')
      return []
    }

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