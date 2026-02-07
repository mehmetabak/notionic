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

    // --- KRİTİK DÜZELTME: Veri Normalizasyonu ---
    // Notion API bazen verileri .value.value içine gömüyor. 
    // getPageProperties gibi yardımcı fonksiyonlar bunu göremediği için
    // veriyi en başta standart yapıya (flatten) çeviriyoruz.
    if (response.block) {
      Object.keys(response.block).forEach(key => {
        const blockItem = response.block[key]
        if (blockItem?.value?.value) {
          blockItem.value = blockItem.value.value
        }
      })
    }

    // Collection verisini de normalize et
    const collectionKey = Object.keys(response.collection || {})[0]
    const collectionObj = collectionKey ? response.collection[collectionKey] : null
    if (collectionObj?.value?.value) {
      collectionObj.value = collectionObj.value.value
    }

    const collectionData = collectionObj?.value
    const schema = collectionData?.schema
    const collectionQuery = response.collection_query
    const block = response.block

    // Validasyonlar
    if (!collectionData || !schema || !collectionQuery || !block || !block[id]) {
      console.warn('Notion data structure is missing required fields.')
      return []
    }

    const rawMetadata = block[id].value

    // Type Check
    if (
      !rawMetadata ||
      (rawMetadata.type !== 'collection_view_page' && rawMetadata.type !== 'collection_view')
    ) {
      console.warn(`Page '${id}' is not a database. Type: ${rawMetadata?.type}`)
      return []
    }

    // --- Veri İşleme ---
    const pageIds = getAllPageIds(collectionQuery)
    const data = []

    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i]
      const blockValue = block[pageId]?.value

      if (!blockValue) continue

      try {
        const properties = await getPageProperties(pageId, block, schema)

        // Özellikler alınamadıysa bu post'u atla
        if (!properties) continue
        
        // ID'yi manuel ve güvenli bir şekilde ekle
        properties.id = idToUuid(pageId)

        // Full Width ve Tarih özelliklerini güvenli nesneden al
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

    // Filtreleme
    const posts = filterPublishedPosts({
      posts: data,
      onlyNewsletter,
      onlyPost,
      onlyHidden
    })

    // Sıralama
    if (BLOG.sortByDate) {
      posts.sort((a, b) => b.date - a.date)
    }

    // Serialization Hatası Çözümü (Undefined temizliği)
    return JSON.parse(JSON.stringify(posts))

  } catch (error) {
    console.error('Error in getAllPosts:', error.message)
    return []
  }
}