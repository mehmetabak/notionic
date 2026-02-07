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
    // FIX 1: Paths must be objects with a 'params' key containing the slug
    paths: posts.map((row) => ({
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
  
  // Preserve your logic for checking large text fields
  Object.keys(post).forEach(key => {
    if (typeof post[key] === 'string' && post[key].length > 10000) {
      console.warn(`Large text field detected in post.${key}, consider optimization`)
    }
  })

  // FIX 2: Deep clean. 
  // JSON.stringify automatically removes ANY key with 'undefined' value at ANY depth.
  // This is required because Notion data is nested deeper than your previous loop checked.
  return JSON.parse(JSON.stringify(post))
}

function cleanBlockMapData(blockMap) {
  if (!blockMap) return null
  
  // FIX 3: Deep clean for BlockMap.
  // The previous manual loop missed nested properties inside 'format' or 'properties',
  // which causes the "Serialization Error".
  return JSON.parse(JSON.stringify(blockMap))
}

export default Post