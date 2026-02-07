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
  try {
    const posts = await getAllPosts({ onlyNewsletter: false })
    
    // Fix: Return params object, not a string path
    return {
      paths: posts.map((row) => ({
        params: { 
          slug: row.slug 
        }
      })),
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
    
    // NUCLEAR OPTION FOR SERIALIZATION
    // This trick converts the object to a JSON string and back.
    // 1. It automatically removes any keys with 'undefined' values (fixing your error).
    // 2. It converts Dates to strings.
    // 3. It strips functions.
    // This is much safer than manual cleaning for Notion data.
    const sanitizedProps = JSON.parse(JSON.stringify({
      post,
      blockMap
    }))

    return {
      props: sanitizedProps,
      revalidate: 1
    }
  } catch (err) {
    console.error(`Error in getStaticProps for slug ${slug}:`, err)
    
    // Return nulls so the page renders the 404/Error state instead of crashing the build
    return {
      props: {
        post: null,
        blockMap: null
      },
      revalidate: 1
    }
  }
}

export default Post