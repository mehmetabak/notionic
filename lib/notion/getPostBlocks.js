import BLOG from '@/blog.config'
import { NotionAPI } from './notionApi'
import { getPreviewImageMap } from './previewImages'
import { retryWithBackoff } from './retryWithBackoff'

export async function getPostBlocks(id) {
  const authToken = BLOG.notionAccessToken || null
  const api = new NotionAPI({ authToken })

  try {
    const pageBlock = await retryWithBackoff(() => api.getPage(id))

    if (!pageBlock) return null

    if (BLOG.previewImagesEnabled) {
      try {
        const previewImageMap = await getPreviewImageMap(pageBlock)
        pageBlock.preview_images = previewImageMap
      } catch (err) {
        console.warn('[notion] previewImages warning:', err.message)
      }
    }

    return pageBlock
  } catch (error) {
    console.error('Error in getPostBlocks:', error)
    return null
  }
}