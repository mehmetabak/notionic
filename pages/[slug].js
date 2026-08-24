// [slug].js - Optimized version
import Layout from '@/layouts/layout'
import { getAllPosts, getPostBlocks } from '@/lib/notion'
import BLOG from '@/blog.config'
import { useRouter } from 'next/router'
import Loading from '@/components/Loading'
import NotFound from '@/components/NotFound'

const Post = ({ post, blockMap, relatedPosts = [] }) => {
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
      relatedPosts={relatedPosts}
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
          blockMap: null,
          relatedPosts: []
        },
        revalidate: 1
      }
    }

    const blockMap = await getPostBlocks(post.id)
    
    // İlgili yazıları (Related Posts) hesapla
    const currentTags = post.tags || []
    const otherPosts = posts.filter(
      (p) =>
        p.id !== post.id &&
        p.type?.[0] !== 'Page' &&
        (p.status?.[0] === 'Published' || p.status === 'Published')
    )

    const scoredPosts = otherPosts.map((p) => {
      const pTags = p.tags || []
      const sharedTags = currentTags.filter((t) => pTags.includes(t))
      return {
        post: p,
        score: sharedTags.length
      }
    })

    scoredPosts.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return new Date(b.post.date) - new Date(a.post.date)
    })

    const relatedPosts = scoredPosts
      .slice(0, 2)
      .map((item) => cleanPostData(item.post))

    // Büyük data için optimizasyon - gereksiz alanları temizle
    const cleanedPost = cleanPostData(post)
    const cleanedBlockMap = cleanBlockMapData(blockMap)
    
    return {
      props: {
        post: cleanedPost,
        blockMap: cleanedBlockMap,
        relatedPosts
      },
      revalidate: 1
    }
  } catch (err) {
    console.error(`Error in getStaticProps for slug ${slug}:`, err)
    return {
      props: {
        post: null,
        blockMap: null,
        relatedPosts: []
      },
      revalidate: 1
    }
  }
}

// Yardımcı fonksiyonlar - data temizleme
function cleanPostData(post) {
  if (!post) return null
  return JSON.parse(JSON.stringify(post))
}

function cleanBlockMapData(blockMap) {
  if (!blockMap) return null
  return JSON.parse(JSON.stringify(blockMap))
}

export default Post