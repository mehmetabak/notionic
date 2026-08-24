import { getTextContent, getDateValue } from 'notion-utils'
import { NotionAPI } from './notionApi'
import { defaultMapImageUrl } from 'react-notion-x'
import BLOG from '@/blog.config'
import { normalizePageBlock } from './normalizeNotionData'

function getBlockValue(blockItem) {
  if (!blockItem) return null
  return (
    normalizePageBlock(blockItem) ||
    blockItem?.value?.value ||
    blockItem?.value ||
    blockItem
  )
}

async function getPageProperties(id, block, schema, authToken) {
  const api = new NotionAPI({ authToken })
  const blockValue = getBlockValue(block?.[id])
  const rawProperties = Object.entries(blockValue?.properties || {})
  const excludeProperties = ['date', 'select', 'multi_select', 'status', 'person']
  const properties = {}

  for (let i = 0; i < rawProperties.length; i++) {
    const [key, val] = rawProperties[i]
    properties.id = id
    const schemaField = schema?.[key]

    if (schemaField?.type && !excludeProperties.includes(schemaField.type)) {
      properties[schemaField.name] = getTextContent(val)
    } else if (schemaField?.type) {
      switch (schemaField.type) {
        case 'date': {
          const dateProperty = getDateValue(val)
          if (dateProperty) {
            delete dateProperty.type
            properties[schemaField.name] = dateProperty
          }
          break
        }
        case 'status':
        case 'select':
        case 'multi_select': {
          const selects = getTextContent(val)
          if (selects && selects.length) {
            properties[schemaField.name] = selects.split(',').map((s) => s.trim())
          }
          break
        }
        case 'person': {
          const rawUsers = val.flat()
          const users = []
          for (let u = 0; u < rawUsers.length; u++) {
            if (rawUsers[u]?.[1]) {
              const userId = rawUsers[u]
              try {
                const res = await api.getUsers(userId)
                const resValue =
                  res?.recordMapWithRoles?.notion_user?.[userId[1]]?.value
                if (resValue) {
                  users.push({
                    id: resValue?.id,
                    first_name: resValue?.given_name,
                    last_name: resValue?.family_name,
                    profile_photo: resValue?.profile_photo
                  })
                }
              } catch (err) {
                console.warn('Error fetching user info:', err.message)
              }
            }
          }
          properties[schemaField.name] = users
          break
        }
        default:
          break
      }
    }
  }

  // Get cover image
  function getPostCover(blockItem) {
    const bv = getBlockValue(blockItem)
    const pageCover = bv?.format?.page_cover
    if (pageCover && pageCover.startsWith('/')) {
      return 'https://www.notion.so' + pageCover
    } else if (pageCover && pageCover.startsWith('http')) {
      return defaultMapImageUrl(pageCover, bv)
    } else {
      return BLOG?.defaultCover
    }
  }

  properties.page_cover = getPostCover(block?.[id])
  delete properties.content
  return properties
}

export { getPageProperties as default }
