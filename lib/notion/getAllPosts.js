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
  const response = await api.getPage(id)

  id = idToUuid(id)
  const collection = Object.values(response.collection)[0]?.value
  const collectionQuery = response.collection_query
  const block = response.block
  const schema = collection?.schema

  // --- KRİTİK DÜZELTME & YAMA BAŞLANGIÇ ---
  // Sorun: Notion API ana sayfanın blok verisini (block[id].value) undefined gönderiyor.
  // Bu durum index.js ve diğer sayfaların "id okunamadı" hatası vermesine sebep oluyor.
  // Çözüm: Eğer ana blok boşsa, kodun geri kalanı patlamasın diye oraya sahte/boş bir blok verisi enjekte ediyoruz.
  
  if (!block[id] || !block[id].value) {
    console.log(`--- UYARI: Ana sayfa blok verisi eksik. Yapay veri oluşturuluyor... ---`);
    block[id] = {
      role: 'reader',
      value: {
        id: id,
        type: 'collection_view_page', // Kodun beklediği tip
        version: 1,
        format: {
          page_full_width: true
        },
        properties: {
          title: [['Ana Sayfa (Kurtarılmış)']]
        },
        created_time: Date.now(),
        last_edited_time: Date.now(),
        parent_id: collection?.parent_id || id,
        parent_table: 'space',
        alive: true
      }
    };
  }
  // --- KRİTİK DÜZELTME BİTİŞ ---

  const rawMetadata = block[id].value

  // Check Type (Artık yukarıda düzelttiğimiz için burası hata vermeyecektir)
  if (
    rawMetadata?.type !== 'collection_view_page' &&
    rawMetadata?.type !== 'collection_view'
  ) {
    console.log(`pageId '${id}' is not a database`)
    return null
  } else {
    // Construct Data
    const pageIds = getAllPageIds(collectionQuery)
    const data = []
    
    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i] // id değişken ismi çakışmasını önlemek için pageId yaptık
      
      // Alt sayfaların blok verisi yoksa atla
      if (!block[pageId] || !block[pageId].value) {
          continue; 
      }

      const properties = (await getPageProperties(pageId, block, schema)) || null

      if (!properties) continue;

      // Add fullwidth to properties
      properties.fullWidth = block[pageId].value?.format?.page_full_width ?? false
      // Convert date (with timezone) to unix milliseconds timestamp
      properties.date = (
        properties.date?.start_date
          ? dayjs.tz(properties.date?.start_date)
          : dayjs(block[pageId].value?.created_time)
      ).valueOf()

      data.push(properties)
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
    return posts
  }
}