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
        console.warn(`[getAllPosts] Veritabanı bulunamadı.`)
        return []
    }

    const rawMetadata = block[id]?.value

    // Sayfa türü uyarısı (İşleyişi durdurmaz)
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
      const uuid = idToUuid(rawId)
      const simpleId = rawId.replace(/-/g, '')
      
      // 1. DOĞRU BLOK ANAHTARINI BULMA
      let mapKey = null;
      if (block[rawId]) mapKey = rawId;
      else if (block[uuid]) mapKey = uuid;
      else if (block[simpleId]) mapKey = simpleId;

      // Blok yoksa atla
      if (!mapKey || !block[mapKey] || !block[mapKey].value) {
          continue;
      }

      const postBlock = block[mapKey];
      let properties = null;

      // 2. ÖZELLİKLERİ ÇEKMEYİ DENE
      try {
          properties = (await getPageProperties(mapKey, block, schema)) || null
      } catch (err) {
          // console.error(`[getAllPosts] Özellikler okunamadı (${mapKey}), manuel moda geçiliyor.`);
      }

      // 3. MANUEL KURTARMA (FALLBACK)
      // Eğer getPageProperties başarısız olduysa, veriyi ham bloktan biz üretiriz.
      if (!properties) {
          const val = postBlock.value;
          
          // Başlığı bulmaya çalış (farklı formatlarda olabilir)
          const title = val.properties?.title?.[0]?.[0] || 
                        val.properties?.Name?.[0]?.[0] || 
                        'Başlıksız Yazı';

          // Slug bulmaya çalış, yoksa ID kullan
          const slug = val.properties?.slug?.[0]?.[0] || 
                       val.properties?.Slug?.[0]?.[0] || 
                       mapKey;

          // Tarih
          const createdTime = val.created_time || Date.now();

          properties = {
              id: mapKey,
              title: title,
              slug: slug,
              date: { start_date: dayjs(createdTime).format('YYYY-MM-DD') },
              status: ['Published'], // Yayınlanmış varsayıyoruz
              type: ['Post'],        // Post varsayıyoruz
              tags: [],
              page_cover: val.format?.page_cover || '',
              page_icon: val.format?.page_icon || ''
          };
          console.log(`[getAllPosts] Yazı kurtarıldı: ${title}`);
      }

      // 4. VERİYİ STANDARTLAŞTIR VE EKLE
      if (properties) {
        // Fullwidth ayarı
        properties.fullWidth = postBlock.value?.format?.page_full_width ?? false
        
        // Tarihi timestamp'e çevir (Sıralama için gerekli)
        try {
            properties.date = (
              properties.date?.start_date
                ? dayjs.tz(properties.date?.start_date)
                : dayjs(postBlock.value?.created_time)
            ).valueOf()
        } catch (e) {
            properties.date = dayjs(postBlock.value?.created_time).valueOf();
        }

        data.push(properties)
      }
    }

    // 5. FİLTRELEME
    // Filtrelemeden önce, eğer hiç published yazı yoksa, kurtardığımız yazıları zorla geçirebiliriz.
    // Ancak şimdilik standart filtreyi kullanalım.
    const posts = filterPublishedPosts({
      posts: data,
      onlyNewsletter,
      onlyPost,
      onlyHidden
    })

    // 6. SIRALAMA
    if (BLOG.sortByDate) {
      posts.sort((a, b) => b.date - a.date)
    }
    
    // 7. TEMİZLİK (Serialization Hatası Önlemi)
    return JSON.parse(JSON.stringify(posts));

  } catch (err) {
    console.error('[getAllPosts] Kritik Hata:', err)
    return [] 
  }
}