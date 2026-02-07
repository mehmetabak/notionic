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
    console.error('━━━ FULL RESPONSE DEBUG ━━━')
    console.error('Available block IDs:', Object.keys(block))
    console.error('Looking for ID:', id)
    console.error('Original ID:', BLOG.notionPageId)
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━')
    throw new Error(`Cannot find block data for ID: ${id}`)
  }

  // Tüm olası yolları dene
  const rawMetadata = blockData.value?.value || blockData.value || blockData

  console.error('━━━ METADATA DEBUG ━━━')
  console.error('blockData keys:', Object.keys(blockData))
  console.error('blockData.value exists:', !!blockData.value)
  console.error('blockData.value?.value exists:', !!blockData.value?.value)
  console.error('rawMetadata keys:', Object.keys(rawMetadata))
  console.error('rawMetadata.type:', rawMetadata.type)
  console.error('Full rawMetadata:', JSON.stringify(rawMetadata, null, 2).substring(0, 500))
  console.error('━━━━━━━━━━━━━━━━━━━━━━')

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

    const pageBlock = block[id]
    const pageValue = pageBlock?.value?.value || pageBlock?.value || pageBlock
    
    properties.fullWidth = pageValue?.format?.page_full_width ?? false
    properties.date = (
      properties.date?.start_date
        ? dayjs.tz(properties.date?.start_date)
        : dayjs(pageValue?.created_time)
    ).valueOf()

    data.push(properties)
  }

  const posts = filterPublishedPosts({
    posts: data,
    onlyNewsletter,
    onlyPost,
    onlyHidden
  })

  if (BLOG.sortByDate) {
    posts.sort((a, b) => b.date - a.date)
  }
  return posts
}