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
    
    // FIX 1: Schema ve Collection verisini güvenli alma (Önceki çözüm)
    const collectionId = Object.keys(response.collection || {})[0]
    const rawCollection = collectionId ? response.collection[collectionId] : null
    
    // Notion-client veriyi bazen 'value' içinde paketler
    let collectionData = rawCollection?.value
    let schema = collectionData?.schema

    // Eğer schema yoksa bir katman daha içeri bak
    if (!schema && collectionData?.value?.schema) {
        collectionData = collectionData.value
        schema = collectionData.schema
    }
    
    const collectionQuery = response.collection_query
    const block = response.block

    // Debug log
    console.log('Response structure:', {
      hasCollection: !!response.collection,
      hasCollectionQuery: !!response.collection_query,
      hasBlock: !!response.block,
      collectionKeys: Object.keys(response.collection || {}),
      collectionId,
      hasSchema: !!schema,
      schemaKeys: schema ? Object.keys(schema) : []
    })

    if (!collectionData) {
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

    // FIX 2: Type Kontrolünü Esnetme
    // Loglarda 'Type: undefined' hatası alıyordunuz.
    // Eğer elimizde geçerli bir 'schema' ve 'collectionData' varsa,
    // block type 'undefined' olsa bile bunun bir veritabanı olduğunu kabul edip devam ediyoruz.
    const isDatabase = rawMetadata?.type === 'collection_view_page' || 
                       rawMetadata?.type === 'collection_view' ||
                       (!!schema && !!collectionData); // Fallback: Şema varsa veritabanıdır.

    if (!isDatabase) {
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
    let posts = filterPublishedPosts({
      posts: data,
      onlyNewsletter,
      onlyPost,
      onlyHidden
    })

    // Sort by date
    if (BLOG.sortByDate) {
      posts.sort((a, b) => b.date - a.date)
    }

    // FIX 3: Serialization Hatası Temizliği
    // Build sırasında 'undefined cannot be serialized as JSON' hatasını engellemek için
    // veri içindeki tüm undefined değerleri temizliyoruz.
    if (posts && posts.length > 0) {
        posts = JSON.parse(JSON.stringify(posts))
    }

    return posts

  } catch (error) {
    console.error('Error in getAllPosts:', error.message)
    console.error('Stack:', error.stack)
    return []
  }
}