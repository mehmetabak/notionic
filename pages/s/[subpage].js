// [subpage].js - Optimized version
import BLOG from '@/blog.config'
import Layout from '@/layouts/layout'
import { getAllPosts, getPostBlocks } from '@/lib/notion'
import { useRouter } from 'next/router'

import { getAllPagesInSpace, getPageBreadcrumbs, idToUuid } from 'notion-utils'
import { defaultMapPageUrl } from 'react-notion-x'

import Loading from '@/components/Loading'
import NotFound from '@/components/NotFound'

const Post = ({ post, blockMap }) => {
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
    />
  )
}

export async function getStaticPaths() {
  try {
    const mapPageUrl = defaultMapPageUrl(BLOG.notionPageId)

    // Tüm sayfaları al
    const pages = await getAllPagesInSpace(
      BLOG.notionPageId,
      BLOG.notionSpacesId,
      getPostBlocks,
      {
        traverseCollections: false
      }
    )

    // Subpage ID'lerini oluştur
    const subpageIds = Object.keys(pages)
      .map((pageId) => '/s' + mapPageUrl(pageId))
      .filter((path) => path && path !== '/s/')

    // Post ve hero ID'lerini paralel olarak al
    const [posts, heros] = await Promise.all([
      getAllPosts({ onlyNewsletter: false }),
      getAllPosts({ onlyHidden: true })
    ])

    // Post ID'lerini mapla
    const postIds = posts.map((post) => '/s' + mapPageUrl(post.id))
    
    // Hero ID'lerini mapla
    const heroIds = heros.map((hero) => '/s' + mapPageUrl(hero.id))

    // Filtreleme işlemini optimize et
    const filteredSubpages = subpageIds.filter(id => 
      !postIds.includes(id) && !heroIds.includes(id)
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

export async function getStaticProps({ params: { subpage } }) {
  try {
    // BlockMap ve posts'u paralel olarak al
    const [blockMap, posts] = await Promise.all([
      getPostBlocks(subpage),
      getAllPosts({ onlyNewsletter: false })
    ])

    const id = idToUuid(subpage)
    const breadcrumbs = getPageBreadcrumbs(blockMap, id)
    
    // Post'u bul veya manuel olarak oluştur
    let post = posts.find((t) => t.id === breadcrumbs[0]?.block?.id)
    
    if (!post && breadcrumbs[0]) {
      post = {
        type: ['Page'],
        title: breadcrumbs[0].title,
        id: breadcrumbs[0].block?.id || id
      }
    }

    // Sayfa izin kontrolü
    if (!isPageAllowed(blockMap)) {
      return { 
        props: { 
          post: null, 
          blockMap: null 
        } 
      }
    }

    return {
      props: { 
        post, 
        blockMap 
      },
      revalidate: 1
    }
  } catch (err) {
    console.error(`Error in getStaticProps for subpage ${subpage}:`, err)
    return { 
      props: { 
        post: null, 
        blockMap: null 
      } 
    }
  }
}

// Yardımcı fonksiyon - sayfa izin kontrolü
function isPageAllowed(blockMap) {
  const NOTION_SPACES_ID = BLOG.notionSpacesId
  
  // Blokları kontrol et
  for (const block of Object.values(blockMap.block)) {
    if (block.value?.space_id && NOTION_SPACES_ID.includes(block.value.space_id)) {
      return true
    }
  }
  
  return false
}

export default Post