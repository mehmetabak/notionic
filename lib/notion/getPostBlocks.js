import BLOG from '@/blog.config'
import { NotionAPI } from './notionApi'
import { getPreviewImageMap } from './previewImages'
import { retryWithBackoff } from './retryWithBackoff'

function normalizeRecordMapValues(recordMap) {
  if (!recordMap) return
  if (recordMap.block) {
    Object.keys(recordMap.block).forEach((key) => {
      const item = recordMap.block[key]
      if (item?.value?.value) item.value = item.value.value
    })
  }
  if (recordMap.collection) {
    Object.keys(recordMap.collection).forEach((key) => {
      const item = recordMap.collection[key]
      if (item?.value?.value) item.value = item.value.value
    })
  }
  if (recordMap.collection_view) {
    Object.keys(recordMap.collection_view).forEach((key) => {
      const item = recordMap.collection_view[key]
      if (item?.value?.value) item.value = item.value.value
    })
  }
}

export async function getPostBlocks(id) {
  const authToken = BLOG.notionAccessToken || null
  const api = new NotionAPI({ authToken })

  try {
    const pageBlock = await retryWithBackoff(() => api.getPage(id))

    if (!pageBlock) return null

    // İlk normalize işlemi
    normalizeRecordMapValues(pageBlock)

    // Ensure collection_query is initialized
    pageBlock.collection_query = pageBlock.collection_query || {}

    // Sayfa içindeki collection_view (database / projects) bloklarını tespit et ve verilerini çek
    const blockKeys = Object.keys(pageBlock.block || {})
    for (const key of blockKeys) {
      const blockItem = pageBlock.block[key]
      const blockVal = blockItem?.value || blockItem

      if (
        blockVal &&
        (blockVal.type === 'collection_view' || blockVal.type === 'collection_view_page')
      ) {
        const collectionId = blockVal.collection_id
        const viewIds = blockVal.view_ids || []

        for (const collectionViewId of viewIds) {
          if (
            collectionId &&
            collectionViewId &&
            !pageBlock.collection_query?.[collectionId]?.[collectionViewId]
          ) {
            try {
              const collectionViewObj =
                pageBlock.collection_view?.[collectionViewId]?.value ||
                pageBlock.collection_view?.[collectionViewId]

              const collectionData = await retryWithBackoff(() =>
                api.getCollectionData(
                  collectionId,
                  collectionViewId,
                  collectionViewObj
                )
              )

              if (collectionData?.recordMap) {
                if (collectionData.recordMap.block) {
                  Object.assign(pageBlock.block, collectionData.recordMap.block)
                }
                if (collectionData.recordMap.collection) {
                  pageBlock.collection = pageBlock.collection || {}
                  Object.assign(pageBlock.collection, collectionData.recordMap.collection)
                }
                if (collectionData.recordMap.collection_view) {
                  pageBlock.collection_view = pageBlock.collection_view || {}
                  Object.assign(pageBlock.collection_view, collectionData.recordMap.collection_view)
                }
                if (collectionData.recordMap.notion_user) {
                  pageBlock.notion_user = pageBlock.notion_user || {}
                  Object.assign(pageBlock.notion_user, collectionData.recordMap.notion_user)
                }
              }

              if (!pageBlock.collection_query[collectionId]) {
                pageBlock.collection_query[collectionId] = {}
              }

              pageBlock.collection_query[collectionId][collectionViewId] =
                collectionData?.result?.reducerResults ||
                collectionData?.result ||
                {}
            } catch (err) {
              console.warn(
                `Failed to fetch collection data for collection ${collectionId}, view ${collectionViewId}:`,
                err.message
              )
            }
          }
        }
      }
    }

    // Yeni gelen tüm blokları da normalize et
    normalizeRecordMapValues(pageBlock)

    if (BLOG.previewImagesEnabled) {
      const previewImageMap = await getPreviewImageMap(pageBlock)
      pageBlock.preview_images = previewImageMap
    }

    return pageBlock
  } catch (error) {
    console.error('Error in getPostBlocks:', error)
    return null
  }
}