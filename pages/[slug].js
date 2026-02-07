// [slug].js - Optimized & Fixed version
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
    />
  )
}

export async function getStaticPaths() {
  const posts = await getAllPosts({ onlyNewsletter: false })
  
  // FIX: Next.js prefers objects with 'params' for dynamic routes.
  // Returning strings like `${BLOG.path}/${slug}` often causes path mismatches.
  return {
    paths: posts
      .filter(row => row.slug) // Ensure slug exists
      .map((row) => ({
        params: {
          slug: row.slug
        }
      })),
    fallback: true
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
    
    // Büyük data için optimizasyon ve temizleme
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
  
  // Preserve your large text check
  Object.keys(post).forEach(key => {
    if (typeof post[key] === 'string' && post[key].length > 10000) {
      console.warn(`Large text field detected in post.${key}, consider optimization`)
    }
  })
  
  // FIX: Use Deep Cleaning.
  // JSON.stringify automatically removes keys with 'undefined' values at any depth.
  // This prevents the "Serialization Error" that crashes the build.
  return JSON.parse(JSON.stringify(post))
}

function cleanBlockMapData(blockMap) {
  if (!blockMap) return null
  
  // FIX: Use Deep Cleaning.
  // Notion blocks are complex nested objects. A manual loop often misses 
  // undefined values inside 'format', 'properties', or 'style'.
  // Deep cleaning is required here.
  return JSON.parse(JSON.stringify(blockMap))
}

export default Post