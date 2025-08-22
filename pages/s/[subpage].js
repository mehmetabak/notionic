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
  // Geçersiz subpage parametrelerini erken filtrele
  if (!subpage || typeof subpage !== 'string' || subpage.length < 10) {
    return { 
      props: { 
        post: null, 
        blockMap: null 
      } 
    }
  }

  try {
    // BlockMap ve posts'u paralel olarak al
    const [blockMap, posts] = await Promise.all([
      getPostBlocks(subpage),
      getAllPosts({ onlyNewsletter: false })
    ])

    // BlockMap geçerliliğini kontrol et
    if (!blockMap || !blockMap.block) {
      return { 
        props: { 
          post: null, 
          blockMap: null 
        } 
      }
    }

    const id = idToUuid(subpage)
    const breadcrumbs = getPageBreadcrumbs(blockMap, id)
    
    // Breadcrumbs kontrolü
    if (!breadcrumbs || breadcrumbs.length === 0) {
      return { 
        props: { 
          post: null, 
          blockMap: null 
        } 
      }
    }
    
    // Post'u bul veya manuel olarak oluştur
    let post = posts.find((t) => t.id === breadcrumbs[0]?.block?.id)
    
    if (!post && breadcrumbs[0]) {
      post = {
        type: ['Page'],
        title: breadcrumbs[0].title || 'Untitled',
        id: breadcrumbs[0].block?.id || id,
        slug: null,
        status: ['Published'],
        date: null,
        createdTime: new Date().toISOString(),
        fullWidth: false
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

    // Data temizleme
    const cleanedPost = cleanPostData(post)
    const cleanedBlockMap = cleanBlockMapData(blockMap)

    return {
      props: { 
        post: cleanedPost, 
        blockMap: cleanedBlockMap 
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

// Yardımcı fonksiyonlar
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

// Data temizleme fonksiyonları
function cleanPostData(post) {
  if (!post) return null
  
  const cleaned = { ...post }
  
  // Tüm undefined değerleri null ile değiştir
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      cleaned[key] = null
    }
    // Büyük string alanlarını kontrol et
    if (typeof cleaned[key] === 'string' && cleaned[key].length > 10000) {
      console.warn(`Large text field detected in post.${key}`)
    }
  })
  
  return cleaned
}

function cleanBlockMapData(blockMap) {
  if (!blockMap) return null
  
  const cleaned = { ...blockMap }
  
  // Block map içindeki undefined değerleri temizle
  if (cleaned.block) {
    Object.keys(cleaned.block).forEach(blockId => {
      const block = cleaned.block[blockId]
      if (block && block.value) {
        // Undefined değerleri kaldır
        Object.keys(block.value).forEach(key => {
          if (block.value[key] === undefined) {
            delete block.value[key]
          }
        })
        
        // Büyük text blokları için optimizasyon
        if (block.value.type === 'text' && 
            block.value.properties?.title?.[0]?.[0]?.length > 5000) {
          console.warn(`Large text block detected: ${blockId}`)
        }
      }
    })
  }
  
  // Collection data temizleme
  if (cleaned.collection) {
    Object.keys(cleaned.collection).forEach(collectionId => {
      const collection = cleaned.collection[collectionId]
      if (collection && collection.value) {
        Object.keys(collection.value).forEach(key => {
          if (collection.value[key] === undefined) {
            delete collection.value[key]
          }
        })
      }
    })
  }
  
  return cleaned
}

export default Post