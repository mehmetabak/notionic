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

    // Veritabanı yoksa boş dön, ama hatayı temizle
    if (!collection) {
        console.warn(`[getAllPosts] Veritabanı bulunamadı.`);
        return []
    }

    const rawMetadata = block[id]?.value

    // Type kontrolü (Hata vermiyoruz, sadece uyarı)
    if (
      rawMetadata?.type !== 'collection_view_page' &&
      rawMetadata?.type !== 'collection_view'
    ) {
      console.log(`[getAllPosts] Uyarı: Sayfa tipi '${rawMetadata?.type}' görünüyor. İşleme devam ediliyor.`)
    }

    const pageIds = getAllPageIds(collectionQuery)
    const data = []
    
    for (let i = 0; i < pageIds.length; i++) {
      const rawId = pageIds[i]
      const uuid = idToUuid(rawId) // Tireli ID
      
      // --- İYİLEŞTİRME: ID EŞLEŞTİRME ---
      // Notion bazen tireli, bazen tiresiz ID kullanır. İkisini de dene.
      let postBlock = block[rawId] || block[uuid];
      
      if (!postBlock) {
          // Eğer blok bulunamadıysa bir de "replace" ile tiresiz halini zorla dene
          const simpleId = rawId.replace(/-/g, '');
          postBlock = block[simpleId];
      }

      // Hala blok yoksa veya içi boşsa atla
      if (!postBlock || !postBlock.value) {
          continue;
      }

      // getPageProperties fonksiyonuna doğru ID'yi gönderiyoruz
      // Not: postBlock.value.id en güvenilir ID'dir.
      const trueId = postBlock.value.id || uuid;
      
      try {
          const properties = (await getPageProperties(trueId, block, schema)) || null
          
          if (properties) {
            // Add fullwidth to properties
            properties.fullWidth = postBlock.value?.format?.page_full_width ?? false
            // Convert date
            properties.date = (
              properties.date?.start_date
                ? dayjs.tz(properties.date?.start_date)
                : dayjs(postBlock.value?.created_time)
            ).valueOf()

            data.push(properties)
          }
      } catch (err) {
          console.error(`[getAllPosts] Post işlenirken hata (${trueId}):`, err)
          continue
      }
    }

    // remove all the the items doesn't meet requirements
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
    
    // --- KESİN ÇÖZÜM: SERIALIZATION TEMİZLİĞİ ---
    // İçindeki tüm undefined değerleri temizle. Next.js hatasını engeller.
    return JSON.parse(JSON.stringify(posts));

  } catch (err) {
    console.error('[getAllPosts] Kritik Hata:', err)
    return [] // Hata durumunda site çökmesin diye boş dizi dön
  }
}