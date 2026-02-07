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

    // FIX: More robust collection retrieval
    const collection = Object.values(response.collection || {})[0]?.value
    const collectionQuery = response.collection_query
    const block = response.block
    const schema = collection?.schema

    // Validations
    if (!collection) {
      console.error('Collection data not found')
      return []
    }

    if (!schema) {
      console.error('Schema not found in collection')
      return []
    }

    if (!collectionQuery) {
      console.error('Collection query not found')
      return []
    }

    if (!block || !block[id]) {
      console.error('Block not found for id:', id)
      return []
    }

    const rawMetadata = block[id].value

    // Check Type
    if (
      rawMetadata?.type !== 'collection_view_page' &&
      rawMetadata?.type !== 'collection_view'
    ) {
      console.error(`pageId '${id}' is not a database. Type: ${rawMetadata?.type}`)
      return []
    }

    // Construct Data
    const pageIds = getAllPageIds(collectionQuery)
    
    if (!pageIds || pageIds.length === 0) {
      console.warn('No page IDs found in collection')
      return []
    }

    const data = []
    
    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i]
      
      // CRITICAL FIX: Skip "Ghost" blocks
      // Sometimes Notion returns an ID in the query but doesn't return the block data.
      // Accessing block[pageId] when it is undefined causes the "reading 'id'" error.
      if (!block[pageId]) {
        console.warn(`Block missing for pageId: ${pageId}. Skipping.`)
        continue
      }

      try {
        const properties = await getPageProperties(pageId, block, schema)
        
        if (!properties) {
          continue
        }

        properties.fullWidth = block[pageId]?.value?.format?.page_full_width ?? false
        
        properties.date = (
          properties.date?.start_date
            ? dayjs.tz(properties.date.start_date)
            : dayjs(block[pageId]?.value?.created_time)
        ).valueOf()
        
        data.push(properties)
      } catch (err) {
        console.error(`Error processing page ${pageId}:`, err.message)
        continue
      }
    }

    // Filter posts
    const posts = filterPublishedPosts({
      posts: data,
      onlyNewsletter,
      onlyPost,
      onlyHidden
    })

    // Sort by date
    if (BLOG.sortByDate) {
      posts.sort((a, b) => b.date - a.date)
    }

    // CRITICAL FIX: Serialization
    // Removes any 'undefined' values that cause Next.js build to fail
    return JSON.parse(JSON.stringify(posts))

  } catch (error) {
    console.error('Error in getAllPosts:', error.message)
    console.error('Stack:', error.stack)
    return []
  }
}