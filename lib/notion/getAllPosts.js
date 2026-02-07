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

  // FIX: Notion API farklı formatlarda dönebiliyor
  // Format 1: block[id] = { value: {...}, role: "..." }
  // Format 2: block[id] = { id, type, ... }
  const blockData = block[id]
  
  if (!blockData) {
    throw new Error(`Cannot find block data for ID: ${id}. Check if the Notion page ID is correct and accessible.`)
  }

  // Her iki formatı da destekle
  const rawMetadata = blockData.value || blockData

  if (!rawMetadata) {
    throw new Error(`Block data structure is invalid for ID: ${id}`)
  }

  // Check Type
  if (
    rawMetadata.type !== 'collection_view_page' &&
    rawMetadata.type !== 'collection_view'
  ) {
    console.error('Block data structure:', JSON.stringify(blockData, null, 2))
    throw new Error(`Page ID '${id}' type is '${rawMetadata.type}' but expected 'collection_view_page' or 'collection_view'. This must be a Notion database.`)
  }

  // Construct Data
  const pageIds = getAllPageIds(collectionQuery)
  const data = []
  for (let i = 0; i < pageIds.length; i++) {
    const id = pageIds[i]
    const properties = (await getPageProperties(id, block, schema)) || null

    // Her iki formatı destekle
    const pageBlock = block[id]
    const pageValue = pageBlock?.value || pageBlock
    
    // Add fullwidth to properties
    properties.fullWidth = pageValue?.format?.page_full_width ?? false
    // Convert date (with timezone) to unix milliseconds timestamp
    properties.date = (
      properties.date?.start_date
        ? dayjs.tz(properties.date?.start_date)
        : dayjs(pageValue?.created_time)
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