import BLOG from '@/blog.config'
import { NotionAPI } from './notionApi'
import { getPreviewImageMap } from './previewImages'
import { retryWithBackoff } from './retryWithBackoff'

export async function getPostBlocks(id) {
  const authToken = BLOG.notionAccessToken || null
  const api = new NotionAPI({ authToken })

  try {
    const pageBlock = await retryWithBackoff(() => api.getPage(id))

    // --- FIX BAŞLANGICI: Veri Yapısını Düzeltme ---
    // Notion API bazen verileri .value.value içine gömüyor.
    // react-notion-x bu yapıyı okurken 'replace' hatası veriyor.
    // Bu yüzden veriyi burada normalize ediyoruz.
    if (pageBlock) {
      // Blokları kontrol et ve düzelt
      if (pageBlock.block) {
        Object.keys(pageBlock.block).forEach((key) => {
          const item = pageBlock.block[key]
          if (item?.value?.value) {
            item.value = item.value.value
          }
        })
      }

      // Koleksiyonları (Database) kontrol et ve düzelt
      if (pageBlock.collection) {
        Object.keys(pageBlock.collection).forEach((key) => {
          const item = pageBlock.collection[key]
          if (item?.value?.value) {
            item.value = item.value.value
          }
        })
      }
    }
    // --- FIX BİTİŞİ ---

    // Mevcut mantık aynen devam ediyor
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