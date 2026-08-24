import { NotionAPI as BaseNotionAPI } from 'notion-client'
import {
  getBlockCollectionId,
  uuidToId
} from 'notion-utils'
import pMap from 'p-map'

function normalizeRecordMap(recordMap) {
  if (!recordMap) return
  for (const table of ['block', 'collection', 'collection_view', 'notion_user']) {
    const map = recordMap[table]
    if (map) {
      for (const [key, item] of Object.entries(map)) {
        if (!item) continue
        let core = item
        for (let i = 0; i < 4; i++) {
          if (core?.value && typeof core.value === 'object') {
            core = core.value
          } else {
            break
          }
        }
        map[key] = {
          role: item.role || 'reader',
          value: core
        }
      }
    }
  }
}

function getAllContentBlockIds(recordMap) {
  const ids = new Set()
  if (!recordMap?.block) return []
  for (const blockItem of Object.values(recordMap.block)) {
    const blockVal = blockItem?.value || blockItem
    if (Array.isArray(blockVal?.content)) {
      for (const id of blockVal.content) {
        if (id) ids.add(id)
      }
    }
  }
  return Array.from(ids)
}

export class NotionAPI extends BaseNotionAPI {
  async fetch({ endpoint, body, gotOptions, headers }) {
    const customHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      ...headers
    }
    return super.fetch({
      endpoint,
      body,
      gotOptions,
      headers: customHeaders
    })
  }

  async getPage(pageId, {
    concurrency = 3,
    fetchMissingBlocks = true,
    fetchCollections = true,
    signFileUrls = true,
    chunkLimit = 100,
    chunkNumber = 0,
    gotOptions
  } = {}) {
    const raw = await this.getPageRaw(pageId, {
      chunkLimit,
      chunkNumber,
      gotOptions
    })

    const recordMap = raw?.recordMap
    if (!recordMap?.block) {
      throw new Error(`Notion page not found "${uuidToId(pageId)}"`)
    }

    recordMap.collection = recordMap.collection ?? {}
    recordMap.collection_view = recordMap.collection_view ?? {}
    recordMap.notion_user = recordMap.notion_user ?? {}
    recordMap.collection_query = recordMap.collection_query ?? {}
    recordMap.signed_urls = recordMap.signed_urls ?? {}

    normalizeRecordMap(recordMap)

    // 1. Fetch missing child content blocks recursively
    if (fetchMissingBlocks) {
      while (true) {
        const allContentIds = getAllContentBlockIds(recordMap)
        const missingIds = allContentIds.filter((id) => !recordMap.block[id])
        if (missingIds.length === 0) break

        try {
          const blocksRes = await this.getBlocks(missingIds, gotOptions)
          if (blocksRes?.recordMap?.block) {
            Object.assign(recordMap.block, blocksRes.recordMap.block)
            normalizeRecordMap(recordMap)
          } else {
            break
          }
        } catch (err) {
          console.warn('[notion] Failed to fetch missing blocks:', err.message)
          break
        }
      }
    }

    // 2. Fetch collections and collection views
    if (fetchCollections) {
      const collectionEntries = []
      for (const blockItem of Object.values(recordMap.block)) {
        const blockVal = blockItem?.value || blockItem
        if (
          blockVal &&
          (blockVal.type === 'collection_view' || blockVal.type === 'collection_view_page')
        ) {
          const collectionId =
            getBlockCollectionId(blockVal, recordMap) ||
            blockVal.collection_id ||
            blockVal.format?.collection_pointer?.id
          const viewIds = blockVal.view_ids || []
          for (const collectionViewId of viewIds) {
            if (collectionId && collectionViewId) {
              collectionEntries.push({ collectionId, collectionViewId })
            }
          }
        }
      }

      // Also check collection_view table directly for any unattached views
      for (const [viewId, viewItem] of Object.entries(recordMap.collection_view)) {
        const viewVal = viewItem?.value || viewItem
        const parentBlock = recordMap.block?.[viewVal?.parent_id]?.value || recordMap.block?.[viewVal?.parent_id]
        const collectionId =
          viewVal?.format?.collection_pointer?.id ||
          parentBlock?.collection_id ||
          parentBlock?.format?.collection_pointer?.id ||
          (parentBlock ? getBlockCollectionId(parentBlock, recordMap) : null)

        if (
          collectionId &&
          viewId &&
          !collectionEntries.some((e) => e.collectionId === collectionId && e.collectionViewId === viewId)
        ) {
          collectionEntries.push({ collectionId, collectionViewId: viewId })
        }
      }

      await pMap(
        collectionEntries,
        async ({ collectionId, collectionViewId }) => {
          try {
            const collectionViewObj = recordMap.collection_view?.[collectionViewId]?.value
            const collectionData = await this.getCollectionData(
              collectionId,
              collectionViewId,
              collectionViewObj,
              { gotOptions }
            )

            if (collectionData?.recordMap) {
              if (collectionData.recordMap.block) {
                Object.assign(recordMap.block, collectionData.recordMap.block)
              }
              if (collectionData.recordMap.collection) {
                Object.assign(recordMap.collection, collectionData.recordMap.collection)
              }
              if (collectionData.recordMap.collection_view) {
                Object.assign(recordMap.collection_view, collectionData.recordMap.collection_view)
              }
              if (collectionData.recordMap.notion_user) {
                Object.assign(recordMap.notion_user, collectionData.recordMap.notion_user)
              }
              normalizeRecordMap(recordMap)
            }

            if (!recordMap.collection_query[collectionId]) {
              recordMap.collection_query[collectionId] = {}
            }

            recordMap.collection_query[collectionId][collectionViewId] =
              collectionData?.result?.reducerResults ||
              collectionData?.result ||
              {}
          } catch (err) {
            console.warn(`[notion] collectionQuery error for ${collectionId}:`, err.message)
          }
        },
        { concurrency }
      )
    }

    // 3. Sign file URLs
    if (signFileUrls) {
      const allContentIds = getAllContentBlockIds(recordMap)
      try {
        await this.addSignedUrls({
          recordMap,
          contentBlockIds: allContentIds,
          gotOptions
        })
      } catch (err) {
        console.warn('[notion] addSignedUrls warning:', err.message)
      }
    }

    return recordMap
  }
}
