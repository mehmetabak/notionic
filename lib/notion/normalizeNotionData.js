/**
 * Unwrap metadata that may have extra `.value` nesting from Notion API changes.
 * Old format: block[pageId].value = { type: 'collection_view_page', ... }
 * New format: block[pageId].value = { value: { type: 'collection_view_page', ... } }
 */
export function normalizeNotionMetadata(block, pageId) {
  let current = block?.[pageId]
  if (!current) return null

  for (let i = 0; i < 4; i++) {
    if (!current) break
    if (current.type === 'collection_view_page' || current.type === 'collection_view' || current.type === 'page') {
      return current
    }
    if (current.value) {
      current = current.value
      continue
    }
    break
  }

  return current?.type ? current : (current?.value ?? null)
}

/**
 * Unwrap collection to find the actual object containing `.schema`.
 * Peels up to 4 layers to find the object with `schema`.
 */
export function normalizeCollection(collection) {
  if (!collection) return {}
  let current = collection

  if (!current.schema && !current.value && typeof current === 'object') {
    const firstVal = Object.values(current)[0]
    if (firstVal) current = firstVal
  }

  for (let i = 0; i < 4; i++) {
    if (!current) break
    if (current.schema) {
      return current
    }
    if (current.value) {
      current = current.value
      continue
    }
    break
  }

  return current ?? {}
}

/**
 * Ensure all schema fields have `name` and `type` with fallback defaults.
 */
export function normalizeSchema(schema = {}) {
  if (!schema) return {}
  const result = {}

  Object.entries(schema).forEach(([key, value]) => {
    result[key] = {
      ...value,
      name: value?.name || '',
      type: value?.type || ''
    }
  })

  return result
}

/**
 * Unwrap a page block entry to find the actual page data with { type: 'page', properties }.
 * Peels up to 4 layers of `.value` wrapping.
 */
export function normalizePageBlock(blockItem) {
  if (!blockItem) return null
  let current = blockItem

  for (let i = 0; i < 4; i++) {
    if (!current) return null
    if (current.type === 'page' || current.properties) {
      return current
    }
    if (current.value) {
      current = current.value
      continue
    }
    break
  }

  return current?.type ? current : (current?.value ?? current)
}
