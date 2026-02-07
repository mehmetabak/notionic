// [slug].js - Fixed version
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
  
  return {
    // FIX 1: getStaticPaths must return objects with a 'params' key, not strings.
    paths: posts
      .filter((row) => row.slug) // Ensure slug exists
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
  
  // FIX 2: Use deep cleaning.
  // JSON.stringify automatically removes all keys with 'undefined' values.
  // This prevents Next.js serialization errors.
  return JSON.parse(JSON.stringify(post))
}

function cleanBlockMapData(blockMap) {
  if (!blockMap) return null
  
  // FIX 3: Notion blocks are deeply nested. Manual iteration often misses
  // undefined values deep inside 'format' or 'properties'. 
  // Deep cleaning via JSON parsing is required here.
  return JSON.parse(JSON.stringify(blockMap))
}

export default Post