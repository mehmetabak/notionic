import { idToUuid } from 'notion-utils'

export default function getAllPageIds(collectionQuery, viewId) {
  // ✅ Guard: collectionQuery must be a non-empty object
  if (!collectionQuery || typeof collectionQuery !== 'object') {
    console.warn('getAllPageIds: collectionQuery is missing or invalid')
    return []
  }

  const viewsEntry = Object.values(collectionQuery)[0]

  // ✅ Guard: the first collection entry must exist
  if (!viewsEntry || typeof viewsEntry !== 'object') {
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