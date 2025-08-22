import BLOG from '@/blog.config'
import got from 'got'
import lqip from '../lqip.js'
import pMap from 'p-map'
import pMemoize from 'p-memoize'

import { defaultMapImageUrl } from 'react-notion-x'
import { getPageImageUrls } from 'notion-utils'

// In-memory cache for better reliability
const previewImageCache = new Map()
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

export async function getPreviewImageMap(recordMap) {
  const urls = getPageImageUrls(recordMap, {
    mapImageUrl: defaultMapImageUrl
  }).filter((url) => url && !url.includes('.svg') && !url.includes(`${BLOG.ogImageGenerateHost}`))

  // Check cache first
  const cachedResults = new Map()
  const urlsToProcess = []

  for (const url of urls) {
    const cached = previewImageCache.get(url)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      cachedResults.set(url, cached.data)
    } else {
      urlsToProcess.push(url)
    }
  }

  // Process uncached URLs
  let newResults = new Map()
  if (urlsToProcess.length > 0) {
    const processedResults = await pMap(urlsToProcess, async (url) => {
      try {
        const result = await getPreviewImage(url)
        // Cache the result
        previewImageCache.set(url, {
          data: result,
          timestamp: Date.now()
        })
        return [url, result]
      } catch (error) {
        console.warn('Failed to process preview image:', url, error.message)
        return [url, null]
      }
    }, {
      concurrency: 8
    })
    
    newResults = new Map(processedResults)
  }

  // Combine cached and new results
  const previewImagesMap = Object.fromEntries([
    ...Array.from(cachedResults.entries()),
    ...Array.from(newResults.entries())
  ])

  return previewImagesMap
}

async function createPreviewImage(url) {
  try {
    // Add timeout and retry logic
    const { body } = await got(url, { 
      responseType: 'buffer',
      timeout: {
        request: 10000 // 10 seconds
      },
      retry: {
        limit: 2
      }
    })
    
    const result = await lqip(body)
    
    // Ensure all required fields are present
    if (!result || !result.metadata) {
      return null
    }

    return {
      originalWidth: result.metadata.originalWidth || 0,
      originalHeight: result.metadata.originalHeight || 0,
      dataURIBase64: result.metadata.dataURIBase64 || null
    }
  } catch (err) {
    if (err.message === 'Input buffer contains unsupported image format') {
      return null
    }

    // Handle different error types
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
      console.warn('Network timeout for preview image', url)
      return null
    }

    console.warn('Failed to create preview image', url, err.message)
    return null
  }
}

// Enhanced memoization with better cache control
export const getPreviewImage = pMemoize(createPreviewImage, {
  maxAge: CACHE_DURATION,
  cacheKey: (url) => url
})

// Cache cleanup function
export function clearPreviewImageCache() {
  previewImageCache.clear()
  getPreviewImage.clear?.()
}