import BLOG from '@/blog.config'
import { NotionAPI } from './notionApi'
import { idToUuid } from 'notion-utils'
import dayjs from '@/lib/day'
import getPageProperties from './getPageProperties'
import filterPublishedPosts from './filterPublishedPosts'
import { retryWithBackoff } from './retryWithBackoff'
import {
  normalizeNotionMetadata,
  normalizeCollection,
  normalizeSchema,
  normalizePageBlock
} from './normalizeNotionData'

export async function getAllPosts({
  onlyNewsletter = false,
  onlyPost = false,
  onlyHidden = false
} = {}) {
  try {
    let id = BLOG.notionPageId
    const authToken = BLOG.notionAccessToken || null

    if (!id) {
      console.error('BLOG.notionPageId is missing')
      return []
    }

    const api = new NotionAPI({ authToken })
    const response = await retryWithBackoff(() => api.getPage(id))

    if (!response || typeof response !== 'object') {
      console.error('Invalid response from Notion API')
      return []
    }

    id = idToUuid(id)
    const block = response.block || {}

    // Unwrap root block metadata
    const rootBlock = normalizeNotionMetadata(block, id)

    if (
      !rootBlock ||
      (rootBlock.type !== 'collection_view_page' && rootBlock.type !== 'collection_view')
    ) {
      console.warn(`Page '${id}' is not a database. Type: ${rootBlock?.type}`)
      return []
    }

    // Unwrap collection and schema
    let rawCollection = Object.values(response.collection || {})[0]
    let collectionData = normalizeCollection(rawCollection)
    let schema = normalizeSchema(collectionData?.schema)

    // Retrieve collection_id and view_id from root block
    const collectionId = rootBlock.collection_id
    const viewId = rootBlock.view_ids?.[0]

    if (!collectionId || !viewId) {
      console.warn('collection_id or view_id missing from root block.')
      return []
    }

    let resolvedPageIds = []

    try {
      const collectionResult = await retryWithBackoff(() =>
        api.getCollectionData(
          collectionId,
          viewId,
          {},
          { limit: 9999 }
        )
      )

      if (collectionResult?.recordMap?.block) {
        Object.assign(block, collectionResult.recordMap.block)
      }

      if (collectionResult?.recordMap?.collection) {
        const moreCollections = Object.values(collectionResult.recordMap.collection)
        for (const col of moreCollections) {
          const normCol = normalizeCollection(col)
          if (normCol?.schema) {
            schema = { ...schema, ...normalizeSchema(normCol.schema) }
          }
        }
      }

      // Extract page IDs from collection result
      resolvedPageIds =
        collectionResult?.result?.reducerResults?.collection_group_results?.blockIds ||
        collectionResult?.result?.reducerResults?.results?.blockIds ||
        collectionResult?.result?.blockIds ||
        []
    } catch (err) {
      console.warn('getCollectionData failed:', err.message)
      return []
    }

    if (!schema || Object.keys(schema).length === 0) {
      console.warn('Collection schema missing.')
      return []
    }

    if (resolvedPageIds.length === 0) {
      console.warn('No page IDs returned from collection.')
      return []
    }

    const data = []

    for (let i = 0; i < resolvedPageIds.length; i++) {
      const pageId = resolvedPageIds[i]
      const blockItem = block[pageId]
      const blockValue =
        normalizePageBlock(blockItem) ||
        blockItem?.value?.value ||
        blockItem?.value ||
        blockItem

      if (!blockValue) continue

      try {
        const properties = await getPageProperties(pageId, block, schema, authToken)

        if (!properties || !properties.title) continue

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