import BLOG from '@/blog.config'
import Layout from '@/layouts/layout'
import { getAllPosts, getPostBlocks } from '@/lib/notion'
import { useRouter } from 'next/router'

import { getAllPagesInSpace, getPageBreadcrumbs, idToUuid } from 'notion-utils'
import { defaultMapPageUrl } from 'react-notion-x'

import Loading from '@/components/Loading'
import NotFound from '@/components/NotFound'

const Post = ({ post, blockMap, pageId }) => {
  const router = useRouter()

  if (router.isFallback) {
    return <Loading notionSlug={router.asPath.split('/')[2]} />
  }

  if (!post) {
    return <NotFound statusCode={404} />
  }

  return (
    <Layout
      blockMap={blockMap}
      frontMatter={post}
      fullWidth={post.fullWidth}
      pageId={pageId}
    />
  )
}

export async function getStaticPaths() {
  try {
    const mapPageUrl = defaultMapPageUrl(BLOG.notionPageId)

    const pages = await getAllPagesInSpace(
      BLOG.notionPageId,
      BLOG.notionSpacesId,
      getPostBlocks,
      {
        traverseCollections: false
      }
    )

    const subpageIds = Object.keys(pages)
      .map((pageId) => '/s' + mapPageUrl(pageId))
      .filter((path) => path && path !== '/s/')

    const [posts, heros] = await Promise.all([
      getAllPosts({ onlyNewsletter: false }),
      getAllPosts({ onlyHidden: true })
    ])

    const postIds = posts.map((post) => '/s' + mapPageUrl(post.id))
    const heroIds = heros.map((hero) => '/s' + mapPageUrl(hero.id))

    const filteredSubpages = subpageIds.filter(
      (id) => !postIds.includes(id) && !heroIds.includes(id)
    )

    const allPaths = [...filteredSubpages, ...heroIds]

    return {
      paths: allPaths,
      fallback: true
    }
  } catch (error) {
    console.error('Error in getStaticPaths:', error)
    return {
      paths: [],
      fallback: true
    }
  }
}

// Module-level cache: the spaceId of the blog root page.
let _cachedRootSpaceId = null

async function getRootSpaceId() {
  if (_cachedRootSpaceId) return _cachedRootSpaceId
  try {
    const rootBlockMap = await getPostBlocks(BLOG.notionPageId)
    if (rootBlockMap?.block) {
      for (const block of Object.values(rootBlockMap.block)) {
        if (block?.spaceId) {
          _cachedRootSpaceId = block.spaceId
          break
        }
        if (block?.value?.space_id) {
          _cachedRootSpaceId = block.value.space_id
          break
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch root page spaceId for pageAllowed check:', err.message)
  }
  return _cachedRootSpaceId
}

export async function getStaticProps({ params: { subpage } }) {
  if (!subpage || typeof subpage !== 'string' || subpage.length < 10) {
    return {
      props: {
        post: null,
        blockMap: null,
        pageId: null
      }
    }
  }

  try {
    const [blockMap, allPosts] = await Promise.all([
      getPostBlocks(subpage),
      getAllPosts({ onlyNewsletter: false })
    ])

    if (!blockMap || !blockMap.block) {
      return {
        props: {
          post: null,
          blockMap: null,
          pageId: null
        }
      }
    }

    const currentPageId = idToUuid(subpage)
    const breadcrumbs = getPageBreadcrumbs(blockMap, currentPageId) || []
    const activeCrumb = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null

    // Walk leaf -> root to find nearest ancestor in known posts
    let ancestorPost = null
    for (let i = breadcrumbs.length - 1; i >= 0; i--) {
      ancestorPost = allPosts.find((t) => t.id === breadcrumbs[i]?.block?.id)
      if (ancestorPost) break
    }

    let post
    if (ancestorPost) {
      post = { ...ancestorPost, title: activeCrumb?.title || ancestorPost.title }
    } else {
      post = {
        type: ['Page'],
        title: activeCrumb?.title || breadcrumbs[0]?.title || 'Untitled',
        id: activeCrumb?.block?.id || currentPageId,
        slug: null,
        status: ['Published'],
        date: null,
        createdTime: new Date().toISOString(),
        fullWidth: false
      }
    }

    const NOTION_SPACES_ID = BLOG.notionSpacesId
    const rootSpaceId = await getRootSpaceId()

    const pageAllowed = (page) => {
      const foundSpaceIds = new Set()
      Object.values(page.block || {}).forEach((block) => {
        if (block?.spaceId) foundSpaceIds.add(block.spaceId)
        if (block?.value?.space_id) foundSpaceIds.add(block.value.space_id)
      })

      if (foundSpaceIds.size === 0) return true

      for (const id of foundSpaceIds) {
        if (
          NOTION_SPACES_ID &&
          (NOTION_SPACES_ID.includes(id) || id.includes(NOTION_SPACES_ID))
        ) {
          return true
        }
        if (rootSpaceId && id === rootSpaceId) {
          return true
        }
      }
      return false
    }

    if (!pageAllowed(blockMap)) {
      return {
        props: {
          post: null,
          blockMap: null,
          pageId: null
        }
      }
    }

    return {
      props: {
        post: cleanPostData(post),
        blockMap: cleanBlockMapData(blockMap),
        pageId: activeCrumb?.block?.id ?? currentPageId
      },
      revalidate: 1
    }
  } catch (err) {
    console.error(`Error in getStaticProps for subpage ${subpage}:`, err)
    return {
      props: {
        post: null,
        blockMap: null,
        pageId: null
      }
    }
  }
}

function cleanPostData(post) {
  if (!post) return null
  const cleaned = { ...post }
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      cleaned[key] = null
    }
  })
  return cleaned
}

function cleanBlockMapData(blockMap) {
  if (!blockMap) return null
  const cleaned = { ...blockMap }
  if (cleaned.block) {
    Object.keys(cleaned.block).forEach((blockId) => {
      const block = cleaned.block[blockId]
      if (block && block.value) {
        Object.keys(block.value).forEach((key) => {
          if (block.value[key] === undefined) {
            delete block.value[key]
          }
        })
      }
    })
  }
  return cleaned
}

export default Post