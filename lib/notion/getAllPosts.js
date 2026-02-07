import BLOG from '@/blog.config'
import { NotionAPI } from 'notion-client'
import { idToUuid } from 'notion-utils'
import dayjs from '@/lib/day'
import getAllPageIds from './getAllPageIds'
import getPageProperties from './getPageProperties'
import filterPublishedPosts from './filterPublishedPosts'

/**
 * @param {{ onlyNewsletter: boolean }} - false: all types / true: newsletter only
 * @param {{ onlyPost: boolean }} - false: all types / true: post only
 * @param {{ onlyHidden: boolean }} - false: all types / true: hidden only
 */
export async function getAllPosts({
  onlyNewsletter = false,
  onlyPost = false,
  onlyHidden = false
}) {
  try {
    let id = BLOG.notionPageId
    const authToken = BLOG.notionAccessToken || null
    
    // Validate notionPageId
    if (!id) {
      console.error('BLOG.notionPageId is missing')
      return []
    }

    const api = new NotionAPI({ authToken })
    const response = await api.getPage(id)
    
    // Debug - response yapısını kontrol et
    console.log('Response structure:', {
      hasCollection: !!response?.collection,
      hasCollectionQuery: !!response?.collection_query,
      hasBlock: !!response?.block,
      collectionKeys: response?.collection ? Object.keys(response.collection) : []
    })

    // Validate response
    if (!response || typeof response !== 'object') {
      console.error('Invalid response from Notion API:', response)
      return []
    }

    id = idToUuid(id)
    
    // Safely access nested properties
    const collection = response.collection 
      ? Object.values(response.collection)[0]?.value 
      : null
    const collectionQuery = response.collection_query
    const block = response.block
    const schema = collection?.schema

    // Validation checks
    if (!collection) {
      console.error('Collection not found in response')
      return []
    }

    if (!collectionQuery) {
      console.error('Collection query not found in response')
      return []
    }

    if (!block || !block[id]) {
      console.error('Block not found for id:', id)
      return []
    }

    if (!schema) {
      console.error('Schema not found in collection')
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
      
      try {
        const properties = await getPageProperties(pageId, block, schema)
        
        if (!properties) {
          console.warn(`Properties not found for page ${pageId}`)
          continue
        }

        // Add fullwidth to properties
        properties.fullWidth = block[pageId]?.value?.format?.page_full_width ?? false
        
        // Convert date (with timezone) to unix milliseconds timestamp
        properties.date = (
          properties.date?.start_date
            ? dayjs.tz(properties.date.start_date)
            : dayjs(block[pageId]?.value?.created_time)
        ).valueOf()
        
        data.push(properties)
      } catch (err) {
        console.error(`Error processing page ${pageId}:`, err)
        continue
      }
    }

    // Remove all the items that don't meet requirements
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
    console.error('Error in getAllPosts:', error)
    return []
  }
}