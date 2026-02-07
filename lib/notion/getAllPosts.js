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

  const blockData = block[id]
  
  if (!blockData) {
    throw new Error(`Cannot find block data for ID: ${id}. Check if the Notion page ID is correct and accessible.`)
  }

  // FIX: Notion API yapısı - block[id].value.value
  const rawMetadata = blockData.value?.value || blockData.value || blockData

  if (!rawMetadata || !rawMetadata.type) {
    throw new Error(`Block data structure is invalid for ID: ${id}. Type field is missing.`)
  }

  // Check Type
  if (
    rawMetadata.type !== 'collection_view_page' &&
    rawMetadata.type !== 'collection_view'
  ) {
    throw new Error(`Page ID '${id}' type is '${rawMetadata.type}' but expected 'collection_view_page' or 'collection_view'. This must be a Notion database.`)
  }

  // Construct Data
  const pageIds = getAllPageIds(collectionQuery)
  const data = []

  for (let i = 0; i < pageIds.length; i++) {
    const id = pageIds[i]
    const properties = (await getPageProperties(id, block, schema)) || null

    // FIX: Eğer properties null ise bu sayfayı atla
    if (!properties) {
      console.warn(`Skipping page ${id} - properties is null`)
      continue
    }

    const pageBlock = block[id]
    const pageValue = pageBlock?.value?.value || pageBlock?.value || pageBlock
    
    // Güvenli erişim - pageValue null olabilir
    if (pageValue) {
      properties.fullWidth = pageValue.format?.page_full_width ?? false
      properties.date = (
        properties.date?.start_date
          ? dayjs.tz(properties.date?.start_date)
          : dayjs(pageValue.created_time)
      ).valueOf()
    } else {
      // pageValue yoksa varsayılan değerler
      console.warn(`Page ${id} has no pageValue, using defaults`)
      properties.fullWidth = false
      properties.date = Date.now()
    }

    data.push(properties)
  }

  // remove all the the items doesn't meet requirements
  const posts = filterPublishedPosts({
    posts: data,
    onlyNewsletter,
    onlyPost,
    onlyHidden
  })

  // CRITICAL FIX: filterPublishedPosts sonrası null/undefined temizliği
  const validPosts = (posts || []).filter(post => {
    if (!post) {
      console.warn('Filtered out null/undefined post')
      return false
    }
    if (!post.id) {
      console.warn('Filtered out post without id:', post)
      return false
    }
    return true
  })

  // Sort by date
  if (BLOG.sortByDate) {
    validPosts.sort((a, b) => b.date - a.date)
  }
  
  console.log(`getAllPosts returning ${validPosts.length} valid posts`)
  return validPosts
}