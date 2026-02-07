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
    
    // Schema nested yapıda olabilir, her iki durumu da kontrol et
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

    // FIX: Check Type - Esnek Kontrol
    // Eğer type undefined ise ama collectionId ve schema varsa devam et.
    if (
      rawMetadata?.type !== 'collection_view_page' &&
      rawMetadata?.type !== 'collection_view' &&
      !collectionId
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
      
      // FIX: Blok kontrolü
      // pageId listesinde olup block map'inde olmayan (undefined) sayfalar hataya sebep olur.
      const pageBlock = block[pageId]
      if (!pageBlock || !pageBlock.value) {
        continue
      }

      try {
        const properties = await getPageProperties(pageId, block, schema)
        
        if (!properties) {
          continue
        }

        // properties.id'nin kesin olduğundan emin olalım
        properties.id = idToUuid(pageId)

        properties.fullWidth = pageBlock.value?.format?.page_full_width ?? false
        
        properties.date = (
          properties.date?.start_date
            ? dayjs.tz(properties.date.start_date)
            : dayjs(pageBlock.value?.created_time)
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

    // FIX: Serialization Error Çözümü
    // Next.js 'undefined' verileri serialize edemez. 
    // JSON.stringify/parse yöntemi undefined alanları temizler.
    return JSON.parse(JSON.stringify(posts))

  } catch (error) {
    console.error('Error in getAllPosts:', error.message)
    console.error('Stack:', error.stack)
    return []
  }
}