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
    
    // FIX: Schema extraction updated to handle nested 'value' wrapper
    const collectionId = Object.keys(response.collection || {})[0]
    const rawCollection = collectionId ? response.collection[collectionId] : null
    
    // Attempt to get the value. Based on your logs, the structure is deeper than expected.
    let collectionData = rawCollection?.value

    // Check if we need to unwrap one level deeper
    if (collectionData && collectionData.value && collectionData.value.schema) {
      collectionData = collectionData.value
    }

    const schema = collectionData?.schema
    
    const collectionQuery = response.collection_query
    const block = response.block

    // Debug log - daha detaylı
    console.log('Response structure:', {
      hasCollection: !!response.collection,
      hasCollectionQuery: !!response.collection_query,
      hasBlock: !!response.block,
      collectionKeys: Object.keys(response.collection || {}),
      collectionId,
      hasSchema: !!schema,
      schemaKeys: schema ? Object.keys(schema) : []
    })

    // Validations
    if (!collectionData) {
      console.error('Collection data not found')
      return []
    }

    if (!schema) {
      console.error('Schema not found in collection. Collection data:', 
        JSON.stringify(collectionData, null, 2))
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
    if (!schema) {
      console.error('Full collection object:', 
        JSON.stringify(response.collection, null, 2))
      return []
    }
    
    if (!pageIds || pageIds.length === 0) {
      console.warn('No page IDs found in collection')
      return []
    }

    const data = []
    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i]
      
      try {
        const properties = await getPageProperties(pageId, block, schema)
        
        if (!properties) {
          console.warn(`Properties not found for page ${pageId}`)
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

    return posts

  } catch (error) {
    console.error('Error in getAllPosts:', error.message)
    console.error('Stack:', error.stack)
    return []
  }
}