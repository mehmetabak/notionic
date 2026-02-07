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

    // --- FIX 1: Veri Yapısını Güvenli Çözümleme (Unwrapping) ---
    // Notion verisi bazen .value içinde, bazen de .value.value içinde geliyor.
    
    // 1. Collection Verisi
    const collectionKey = Object.keys(response.collection || {})[0]
    const rawCollection = collectionKey ? response.collection[collectionKey] : null
    const collectionData = rawCollection?.value?.value || rawCollection?.value
    const schema = collectionData?.schema

    // 2. Ana Blok Verisi
    const rawBlock = response.block?.[id]
    const rootBlockValue = rawBlock?.value?.value || rawBlock?.value

    const collectionQuery = response.collection_query
    const block = response.block

    // Validasyonlar
    if (!collectionData || !schema || !collectionQuery || !block || !rootBlockValue) {
      console.warn('Notion data structure is missing required fields (Collection, Schema or Block).')
      return []
    }

    // Tip Kontrolü
    if (
      rootBlockValue.type !== 'collection_view_page' &&
      rootBlockValue.type !== 'collection_view'
    ) {
      console.warn(`Page '${id}' is not a database. Type: ${rootBlockValue.type}`)
      return []
    }

    // --- Veri İşleme ---
    const pageIds = getAllPageIds(collectionQuery)
    const data = []

    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i]
      const rawPageBlock = block[pageId]
      
      // FIX 2: Sayfa bloğu için de güvenli veri alma
      const pageBlockValue = rawPageBlock?.value?.value || rawPageBlock?.value

      if (!pageBlockValue) continue

      try {
        const properties = await getPageProperties(pageId, block, schema)

        // Eğer özellikler alınamazsa veya id yoksa atla
        if (!properties || !properties.id) continue

        // Full Width ve Tarih özelliklerini güvenli nesneden al
        properties.fullWidth = pageBlockValue.format?.page_full_width ?? false
        
        properties.date = (
          properties.date?.start_date
            ? dayjs.tz(properties.date.start_date)
            : dayjs(pageBlockValue.created_time)
        ).valueOf()

        data.push(properties)
      } catch (err) {
        // Hatalı tek bir sayfayı atla, tüm build'i kırma
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

    // --- FIX 3: Serialization Hatası Çözümü ---
    // Next.js 'undefined' değerleri kabul etmez. Bu işlem onları temizler.
    return JSON.parse(JSON.stringify(posts))

  } catch (error) {
    console.error('Error in getAllPosts:', error.message)
    // Hata durumunda boş dizi dönerek build'in çökmesini engelle
    return []
  }
}