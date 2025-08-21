import { memo } from 'react'
import Layout from '@/layouts/layout'
import { getAllPosts, getPostBlocks } from '@/lib/notion'
import BLOG from '@/blog.config'
import { useRouter } from 'next/router'
import Loading from '@/components/Loading'
import NotFound from '@/components/NotFound'

const Post = memo(({ post, blockMap }) => {
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
})

Post.displayName = 'Post'

export async function getStaticPaths() {
  try {
    const posts = await getAllPosts({ onlyNewsletter: false })
    const paths = posts
      .filter(post => post.slug && post.status === 'Published') // Sadece yayınlanmış ve slug'ı olan postlar
      .map((post) => `${BLOG.path}/${post.slug}`)
    
    return {
      paths,
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
  if (!slug) {
    return {
      notFound: true
    }
  }

  try {
    const posts = await getAllPosts({ onlyNewsletter: false })
    const post = posts.find((t) => t.slug === slug)

    if (!post || post.status !== 'Published') {
      return {
        notFound: true
      }
    }

    const blockMap = await getPostBlocks(post.id)
    
    if (!blockMap) {
      return {
        notFound: true
      }
    }

    return {
      props: {
        post,
        blockMap
      },
      revalidate: BLOG.revalidateTime || 3600 // 1 saat default
    }
  } catch (error) {
    console.error('Error in getStaticProps for slug:', slug, error)
    
    // Development'ta hatayı göster, production'da 404
    if (process.env.NODE_ENV === 'development') {
      throw error
    }
    
    return {
      notFound: true
    }
  }
}

export default Post