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
  let id = BLOG.notionPageId
  const authToken = BLOG.notionAccessToken || null
  const api = new NotionAPI({ authToken })
  
  try {
    const response = await api.getPage(id)
    id = idToUuid(id)
    
    const collection = Object.values(response.collection)[0]?.value
    const collectionQuery = response.collection_query
    const block = response.block
    const schema = collection?.schema

    if (!collection) {
        console.warn(`[getAllPosts] Veritabanı bulunamadı veya erişilemiyor.`)
        return []
    }

    const rawMetadata = block[id]?.value

    // Ana sayfa türü kontrolü (Sadece bilgilendirme amaçlı)
    if (
      rawMetadata?.type !== 'collection_view_page' &&
      rawMetadata?.type !== 'collection_view'
    ) {
      console.log(`[getAllPosts] Bilgi: Sayfa tipi '${rawMetadata?.type}' olarak görünüyor.`)
    }

    const pageIds = getAllPageIds(collectionQuery)
    const data = []
    
    for (let i = 0; i < pageIds.length; i++) {
      const rawId = pageIds[i]
      const uuid = idToUuid(rawId) // Tireli format
      const simpleId = rawId.replace(/-/g, '') // Tiresiz format
      
      // --- KRİTİK DÜZELTME: DOĞRU ANAHTARI BULMA ---
      // Veri 'block' objesinde hangi anahtarla saklanıyorsa onu bulup kullanacağız.
      // Rastgele ID gönderirsek getPageProperties fonksiyonu veriyi bulamaz.
      let mapKey = null;
      
      if (block[rawId]) {
          mapKey = rawId;
      } else if (block[uuid]) {
          mapKey = uuid;
      } else if (block[simpleId]) {
          mapKey = simpleId;
      }

      // Eğer blok bulunamadıysa bu yazıyı atla
      if (!mapKey || !block[mapKey] || !block[mapKey].value) {
          continue;
      }

      const postBlock = block[mapKey];

      try {
          // BURASI ÇOK ÖNEMLİ:
          // getPageProperties'e 'uuid' veya 'rawId' değil, 
          // bizzat yukarıda doğruladığımız 'mapKey'i gönderiyoruz.
          const properties = (await getPageProperties(mapKey, block, schema)) || null
          
          if (properties) {
            properties.fullWidth = postBlock.value?.format?.page_full_width ?? false
            // Tarih dönüşümü
            properties.date = (
              properties.date?.start_date
                ? dayjs.tz(properties.date?.start_date)
                : dayjs(postBlock.value?.created_time)
            ).valueOf()

            data.push(properties)
          }
      } catch (err) {
          // Tek bir yazıda hata olsa bile diğerlerini etkilemesin
          // console.error(`[getAllPosts] Yazı işlenirken hata (${mapKey}):`, err.message)
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
    
    // --- KESİN ÇÖZÜM: SERIALIZATION TEMİZLİĞİ ---
    // Next.js 'undefined' verileri sevmez ve hata verir.
    // Bu işlem tüm undefined alanları temizler.
    return JSON.parse(JSON.stringify(posts));

  } catch (err) {
    console.error('[getAllPosts] Kritik Hata:', err)
    return [] // Hata durumunda site çökmesin diye boş liste dön
  }
}