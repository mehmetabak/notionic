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
  let id = BLOG.notionPageId
  const authToken = BLOG.notionAccessToken || null
  const api = new NotionAPI({ authToken })
  
  // Hata yakalama bloğu ekleyelim ki API hatasında bile boş dizi dönsün
  try {
    const response = await api.getPage(id)
    id = idToUuid(id)
    
    // Veritabanı içeriğini kontrol et
    const collection = Object.values(response.collection)[0]?.value
    const collectionQuery = response.collection_query
    const block = response.block
    const schema = collection?.schema

    // --- BLOK KURTARMA OPERASYONU ---
    // Eğer ana sayfa bloğu yoksa veya bozuksa, manuel olarak oluşturuyoruz.
    if (!block[id] || !block[id].value) {
      console.log(`--- UYARI: Ana Blok Yok. Yapay Blok Oluşturuluyor... ---`)
      block[id] = {
        role: 'reader',
        value: {
          id: id,
          type: 'collection_view_page',
          version: 1,
          format: { page_full_width: true },
          properties: { title: [['Kurtarılan Veritabanı']] },
          created_time: Date.now(),
          last_edited_time: Date.now(),
          parent_id: collection?.parent_id || id,
          parent_table: 'space',
          alive: true
        }
      }
    }

    const rawMetadata = block[id].value

    // --- KRİTİK DEĞİŞİKLİK ---
    // Eski kod burada "type" kontrolü yapıp "return null" diyordu.
    // Biz bunu İPTAL ediyoruz. Eğer "collection" varsa, type ne olursa olsun devam et.
    
    if (!collection) {
        // Sadece ve sadece veritabanı içeriği YOKSA dur.
        console.log(`pageId '${id}' veritabanı içeriği bulunamadı.`)
        return [] // Null yerine boş dizi dönüyoruz.
    }

    // Eğer type yanlışsa bile sadece log bas, çalışmayı DURDURMA.
    if (
      rawMetadata?.type !== 'collection_view_page' &&
      rawMetadata?.type !== 'collection_view'
    ) {
      console.log(`Uyarı: pageId '${id}' tipi '${rawMetadata?.type}' olarak görünüyor ama işleme devam ediliyor.`)
      // return null; // <--- BU SATIRI SİLDİK. ASLA NULL DÖNMEYECEĞİZ.
    }

    // Verileri Oluştur
    const pageIds = getAllPageIds(collectionQuery)
    const data = []
    
    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i]
      
      // Döngü içinde hata koruması
      try {
        // Eğer o satırın verisi henüz yüklenmediyse atla
        if (!block[pageId] || !block[pageId].value) {
            continue
        }

        const properties = (await getPageProperties(pageId, block, schema)) || null

        if (properties) {
          // Add fullwidth to properties
          properties.fullWidth = block[pageId].value?.format?.page_full_width ?? false
          // Convert date
          properties.date = (
            properties.date?.start_date
              ? dayjs.tz(properties.date?.start_date)
              : dayjs(block[pageId].value?.created_time)
          ).valueOf()

          data.push(properties)
        }
      } catch (err) {
        // Tek bir postta hata olursa tüm siteyi patlatma, o postu atla
        console.error(`Post işlenirken hata (ID: ${pageId}):`, err)
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
    
    return posts

  } catch (err) {
    console.error('getAllPosts Kritik Hata:', err)
    return [] // En kötü senaryoda site çökmesin diye boş dizi dön.
  }
}