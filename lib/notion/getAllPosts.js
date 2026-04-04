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
      console.error('BLOG.notionPageId eksik.')
      return []
    }

    const api = new NotionAPI({ authToken })
    const response = await api.getPage(id)

    // Yanıtın geçerli bir nesne olduğundan emin olalım
    if (!response || typeof response !== 'object') {
      console.error('Notion API\'den geçersiz yanıt alındı.')
      return []
    }

    id = idToUuid(id)

    // --- FIX 1: Veri Normalizasyonu ve Güvenli Tip Kontrolü ---
    if (response.block && typeof response.block === 'object') {
      Object.keys(response.block).forEach(key => {
        const blockItem = response.block[key]
        if (blockItem?.value?.value) {
          blockItem.value = blockItem.value.value
        }
      })
    }

    // collection undefined ise Object.keys çökmesin diye ekstra güvenlik
    const collectionKey = response.collection && typeof response.collection === 'object' 
        ? Object.keys(response.collection)[0] 
        : null
    const collectionObj = collectionKey ? response.collection[collectionKey] : null
    
    if (collectionObj?.value?.value) {
      collectionObj.value = collectionObj.value.value
    }

    const collectionData = collectionObj?.value
    const schema = collectionData?.schema
    const collectionQuery = response.collection_query
    const block = response.block

    // Gerekli objelerin varlığını sıkı bir şekilde kontrol ediyoruz
    if (!collectionData || !schema || !collectionQuery || !block || !block[id]) {
      console.warn('Notion veri yapısında gerekli alanlar eksik.')
      return []
    }

    const rawMetadata = block[id]?.value

    if (
      !rawMetadata ||
      (rawMetadata.type !== 'collection_view_page' && rawMetadata.type !== 'collection_view')
    ) {
      console.warn(`'${id}' ID'li sayfa bir veritabanı değil. Tür: ${rawMetadata?.type}`)
      return []
    }

    // --- Veri İşleme ---
    const pageIds = getAllPageIds(collectionQuery) || []
    const data = []

    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i]
      const blockValue = block[pageId]?.value

      if (!blockValue) continue

      try {
        const properties = await getPageProperties(pageId, block, schema)

        // Özellikler alınamadıysa veya boşsa atla
        if (!properties || Object.keys(properties).length === 0) continue
        
        // --- FIX 2: ID Formatlama Düzeltmesi ---
        if (pageId) {
          properties.id = idToUuid(pageId.replace(/-/g, ''))
        }

        // Full Width ve Tarih güvenli atamaları
        properties.fullWidth = blockValue?.format?.page_full_width ?? false
        
        const startDate = properties.date?.start_date
        const createdTime = blockValue?.created_time

        properties.date = (
          startDate
            ? dayjs.tz(startDate)
            : dayjs(createdTime || new Date())
        ).valueOf()

        data.push(properties)
      } catch (err) {
        console.warn(`Sayfa atlanıyor ${pageId}: ${err.message}`)
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
      posts.sort((a, b) => (b?.date || 0) - (a?.date || 0))
    }

    // --- FIX 3: Next.js Serileştirme (Serialization) Temizliği ---
    // JSON.stringify içindeki replacer fonksiyonu ile tüm 'undefined' değerleri
    // 'null'a çeviriyoruz. Bu hamle Next.js'in sayfa oluştururken çökmesini engeller.
    return JSON.parse(JSON.stringify(posts, (key, value) => 
      value === undefined ? null : value
    ))

  } catch (error) {
    console.error('Error in getAllPosts:', error.message)
    // Hata ne olursa olsun Vercel'in çökmemesi için boş dizi dönüyoruz.
    return []
  }
}