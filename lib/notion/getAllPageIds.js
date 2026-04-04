import { idToUuid } from 'notion-utils'

export default function getAllPageIds(collectionQuery, viewId) {

  if (!collectionQuery || typeof collectionQuery !== 'object') {
    console.warn('getAllPageIds: collectionQuery is missing or invalid')
    return []
  }

  const firstEntry = Object.values(collectionQuery)[0]
  
  // 👇 Add this temporarily to see the actual shape
  console.log('getAllPageIds collectionQuery keys:', Object.keys(collectionQuery))
  console.log('getAllPageIds firstEntry:', JSON.stringify(firstEntry, null, 2)?.slice(0, 500))

  if (!firstEntry || typeof firstEntry !== 'object') {
    console.warn('getAllPageIds: no views found in collectionQuery')
    return []
  }

  let pageIds = []

  if (viewId) {
    const vId = idToUuid(viewId)
    pageIds = viewsEntry[vId]?.blockIds ?? []
  } else {
    const pageSet = new Set()

    Object.values(viewsEntry).forEach((view) => {
      // ✅ Grouped views (e.g. board/gallery with groups)
      view?.collection_group_results?.blockIds?.forEach(id => pageSet.add(id))

      // ✅ Ungrouped views (table, list) — this was commented out but is needed
      view?.blockIds?.forEach(id => pageSet.add(id))
    })

    pageIds = [...pageSet]
  }

  return pageIds
}