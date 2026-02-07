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

  const rawMetadata = block[id]?.value

  // --- DEBUG BAŞLANGIÇ ---
  if (!rawMetadata || (rawMetadata?.type !== 'collection_view_page' && rawMetadata?.type !== 'collection_view')) {
    console.log(`--- DEBUG: Type Mismatch or Missing Metadata ---`)
    console.log(`Page ID: ${id}`)
    console.log(`Block Type: ${rawMetadata?.type}`)
    console.log(`Collection Exists: ${!!collection}`)
  }
  // --- DEBUG BİTİŞ ---

  // Eğer Metadata yoksa ama Collection varsa, Collection üzerinden devam etmeye çalışacağız.
  // Eğer Collection da yoksa o zaman yapacak bir şey yok, çıkış yap.
  if (
    (!rawMetadata || 
    (rawMetadata?.type !== 'collection_view_page' && rawMetadata?.type !== 'collection_view')) &&
    !collection
  ) {
    console.log(`pageId '${id}' is not a database`)
    return null
  } else {
    // Construct Data
    const pageIds = getAllPageIds(collectionQuery)
    const data = []
    
    for (let i = 0; i < pageIds.length; i++) {
      const id = pageIds[i]
      
      // EKLENEN GÜVENLİK KONTROLÜ:
      // Döngü içindeki blok verisi var mı diye kontrol ediyoruz.
      if (!block[id] || !block[id].value) {
          continue; // Bu satırın verisi bozuksa atla, diğer yazıya geç
      }

      const properties = (await getPageProperties(id, block, schema)) || null

      // Properties null geldiyse işlemi atla
      if (!properties) continue;

      // Add fullwidth to properties
      // ?. operatörleri ile hata almayı engelliyoruz
      properties.fullWidth = block[id].value?.format?.page_full_width ?? false
      
      // Convert date (with timezone) to unix milliseconds timestamp
      properties.date = (
        properties.date?.start_date
          ? dayjs.tz(properties.date?.start_date)
          : dayjs(block[id].value?.created_time)
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