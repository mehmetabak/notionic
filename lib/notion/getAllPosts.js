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
  
  try {
    const response = await api.getPage(id)
    id = idToUuid(id)
    
    const collection = Object.values(response.collection)[0]?.value
    const collectionQuery = response.collection_query
    const block = response.block
    const schema = collection?.schema

    const rawMetadata = block[id]?.value

    // --- KODDAKİ SORUNU ÇÖZEN KISIM ---
    // Eski kod burada: "Eğer sayfa tipi 'collection_view_page' değilse DUR" diyordu.
    // Sorun: Notion bazen bu tipi göndermiyor ama içerik (collection) aslında orada.
    // Çözüm: Tipi kontrol etmiyoruz. Eğer elimizde 'collection' (veri yığını) varsa devam ediyoruz.
    
    if (!collection) {
        // Sadece veri yığını gerçekten yoksa dur.
        console.warn(`[getAllPosts] Sayfa (${id}) bir veritabanı içeriği barındırmıyor.`);
        return []
    }

    // Metadata tipini sadece logluyoruz, akışı kesmiyoruz.
    if (rawMetadata?.type !== 'collection_view_page' && rawMetadata?.type !== 'collection_view') {
        console.log(`[getAllPosts] Uyarı: Sayfa tipi '${rawMetadata?.type}' olarak görünüyor, ancak veritabanı içeriği mevcut. İşleniyor...`)
    }

    // Verileri İnşa Et
    const pageIds = getAllPageIds(collectionQuery)
    const data = []
    
    for (let i = 0; i < pageIds.length; i++) {
      const rawId = pageIds[i]
      const uuid = idToUuid(rawId)
      
      // Notion ID karmaşasını çözmek için hem ham ID'ye hem UUID'ye bakıyoruz
      const postBlock = block[rawId] || block[uuid];

      // Eğer o satırın verisi yüklenmediyse atla (Hata verme, sadece atla)
      if (!postBlock || !postBlock.value) {
          continue;
      }

      // ID'yi garantiye al
      const trueId = postBlock.value.id || uuid;

      try {
          const properties = (await getPageProperties(trueId, block, schema)) || null

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
          // Tekil post hatası tüm siteyi patlatmasın
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
    
    // Serialization Hatası Önlemi: undefined değerleri temizle
    return JSON.parse(JSON.stringify(posts));

  } catch (err) {
    console.error('[getAllPosts] Kritik API Hatası:', err)
    // Hata olsa bile boş dizi dön ki index.js "map of undefined" hatası verip çökmesin
    return [] 
  }
}