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

    // --- FIX 1: Collection ve Schema'yı Garantili Alma ---
    const collectionKey = Object.keys(response.collection || {})[0]
    const collectionObj = collectionKey ? response.collection[collectionKey] : null
    
    // Notion bazen veriyi .value içine, bazen .value.value içine koyar.
    const collectionData = collectionObj?.value?.value || collectionObj?.value
    const schema = collectionData?.schema

    const collectionQuery = response.collection_query
    const block = response.block

    if (!collectionData || !schema || !collectionQuery || !block || !block[id]) {
      console.error('Missing required Notion data structure (Collection, Schema, or Block missing).')
      return []
    }

    // --- FIX 2: Ana Database Bloğunu Kontrol Etme ---
    const rootBlock = block[id]
    // Ana blok verisi de iç içe olabilir
    const rawMetadata = rootBlock.value?.value || rootBlock.value

    // Type Check (Veri yoksa veya tip uyumsuzsa dur)
    if (
      !rawMetadata ||
      (rawMetadata.type !== 'collection_view_page' && rawMetadata.type !== 'collection_view')
    ) {
      console.error(`pageId '${id}' is not a database. Type: ${rawMetadata?.type}`)
      return []
    }

    // --- Veri İnşası ---
    const pageIds = getAllPageIds(collectionQuery)
    const data = []

    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i]
      const blockItem = block[pageId]
      
      // --- FIX 3: Hatalı/Boş Blokları Atla ---
      if (!blockItem) continue

      // Blok verisi .value veya .value.value içinde olabilir
      const blockValue = blockItem.value?.value || blockItem.value

      if (!blockValue) continue

      try {
        const properties = await getPageProperties(pageId, block, schema)

        // Eğer özellikler alınamadıysa bu gönderiyi atla
        if (!properties) continue

        // Full Width kontrolü
        properties.fullWidth = blockValue.format?.page_full_width ?? false
        
        // Tarih kontrolü
        properties.date = (
          properties.date?.start_date
            ? dayjs.tz(properties.date.start_date)
            : dayjs(blockValue.created_time)
        ).valueOf()

        data.push(properties)
      } catch (err) {
        // Tek bir sayfada hata varsa sadece onu logla ve devam et (Build'i kırma)
        console.warn(`Skipping page ${pageId} due to error:`, err.message)
        continue
      }
    }

    // --- Filtreleme ---
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

    // --- FIX 4: Serialization Temizliği ---
    // Next.js 'undefined' değer içeren objeleri kabul etmez. 
    // JSON.stringify undefined alanları otomatik siler.
    return JSON.parse(JSON.stringify(posts))

  } catch (error) {
    console.error('Critical Error in getAllPosts:', error.message)
    // Hata durumunda boş dizi dönerek build'in çökmesini engelle
    return []
  }
}