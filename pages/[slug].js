// [slug].js - Optimized version
import Layout from '@/layouts/layout'
import { getAllPosts, getPostBlocks } from '@/lib/notion'
import BLOG from '@/blog.config'
import { useRouter } from 'next/router'
import Loading from '@/components/Loading'
import NotFound from '@/components/NotFound'

const Post = ({ post, blockMap }) => {
  const router = useRouter()
  
  if (router.isFallback) {
    return <Loading />
  }
  
  if (!post) {
    return <NotFound statusCode={404} />
  }
  
  return (
    <Layout 
      blockMap={blockMap} 
      frontMatter={post} 
      fullWidth={post.fullWidth} 
      pageId={post.id}
    />
  )
}

export async function getStaticPaths() {
  try {
    const posts = await getAllPosts({ onlyNewsletter: false })
    
    // Null kontrolü ekle
    if (!posts || !Array.isArray(posts)) {
      return {
        paths: [],
        fallback: true
      }
    }
    
    return {
      paths: posts.map((row) => `${BLOG.path}/${row.slug}`),
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

export async function getStaticProps({ params: { slug } }) {
  try {
    const posts = await getAllPosts({ onlyNewsletter: false })
    const post = posts.find((t) => t.slug === slug)
    
    // Post bulunamadıysa erken dön
    if (!post) {
      return {
        props: {
          post: null,
          blockMap: null
        },
        revalidate: 1
      }
    }

    const blockMap = await getPostBlocks(post.id)
    
    // Büyük data için optimizasyon - gereksiz alanları temizle
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
    console.error(`Error in getStaticProps for slug ${slug}:`, err)
    return {
      props: {
        post: null,
        blockMap: null
      },
      revalidate: 1
    }
  }
}

// Yardımcı fonksiyonlar - data temizleme
function cleanPostData(post) {
  if (!post) return null
  
  // Undefined değerleri null ile değiştir ve gereksiz alanları kaldır
  const cleaned = { ...post }
  
  // Tüm undefined değerleri null yap veya kaldır
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      cleaned[key] = null
    }
    // Büyük veri alanlarını kontrol et ve gerekirse kısalt
    if (typeof cleaned[key] === 'string' && cleaned[key].length > 10000) {
      console.warn(`Large text field detected in post.${key}, consider optimization`)
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
        Object.keys(block.value).forEach(key => {
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