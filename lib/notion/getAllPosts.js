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

    // Collection verisini güvenli şekilde al
    const collectionId = Object.keys(response.collection || {})[0]
    const collectionObj = collectionId ? response.collection[collectionId] : null
    // FIX 1: Veri yapısı bazen .value içinde .value olarak gelebiliyor
    const collectionData = collectionObj?.value?.value || collectionObj?.value
    const schema = collectionData?.schema

    const collectionQuery = response.collection_query
    const block = response.block

    if (!collectionData || !schema || !collectionQuery || !block || !block[id]) {
      console.error('Missing required Notion data structure.')
      return []
    }

    // FIX 2: Block metadata için de aynı esnek kontrolü yap (Type: undefined hatası için)
    const blockObj = block[id]
    const rawMetadata = blockObj.value?.value || blockObj.value

    // Type Check
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
      const blockItem = block[pageId]
      // Sayfa verileri için de esnek kontrol
      const blockValue = blockItem?.value?.value || blockItem?.value

      if (!blockValue) continue

      try {
        const properties = await getPageProperties(pageId, block, schema)

        if (!properties) continue

        properties.fullWidth = blockValue?.format?.page_full_width ?? false
        
        properties.date = (
          properties.date?.start_date
            ? dayjs.tz(properties.date.start_date)
            : dayjs(blockValue?.created_time)
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

    // FIX 3: Serialization hatasını kesin olarak önlemek için temizlik
    // Bu işlem undefined değerleri null yapar veya siler, böylece build patlamaz.
    return JSON.parse(JSON.stringify(posts))

  } catch (error) {
    console.error('Error in getAllPosts:', error.message)
    return []
  }
}