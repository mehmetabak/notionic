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
    
    // Get the collection ID and collection data
    const collectionId = Object.keys(response.collection || {})[0]
    const collectionData = response.collection?.[collectionId]
    const collectionValue = collectionData?.value
    
    // Schema fix from previous step
    const schema = collectionValue?.schema || collectionValue?.value?.schema
    
    const collectionQuery = response.collection_query
    const block = response.block

    console.log('Schema check:', {
      hasCollectionId: !!collectionId,
      hasCollectionData: !!collectionData,
      hasCollectionValue: !!collectionValue,
      hasSchema: !!schema,
      schemaKeys: schema ? Object.keys(schema) : []
    })

    // Validations
    if (!collectionId || !collectionValue || !schema || !collectionQuery || !block || !block[id]) {
      console.error('Missing required Notion data', {
        collectionId: !!collectionId,
        collectionValue: !!collectionValue,
        schema: !!schema,
        collectionQuery: !!collectionQuery,
        block: !!block,
        blockId: !!block?.[id]
      })
      return []
    }

    const rawMetadata = block[id].value

    // FIX: Check Type
    // Eğer 'type' undefined geliyorsa ama geçerli bir collectionId ve schema varsa işlemi durdurma.
    // Loglarda 'Type: undefined' hatası alıyoruz, ancak schema var olduğu için veri geçerli.
    if (
      rawMetadata?.type !== 'collection_view_page' &&
      rawMetadata?.type !== 'collection_view' &&
      !collectionId // collectionId varsa tipe takılmadan devam et
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
    console.error('Error in getAllPosts:', error.message)
    console.error('Stack:', error.stack)
    return []
  }
}