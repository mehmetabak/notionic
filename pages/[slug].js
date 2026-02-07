import Layout from '@/layouts/layout'
import { getAllPosts, getPostBlocks } from '@/lib/notion'
import BLOG from '@/blog.config'
import { useRouter } from 'next/router'
import Loading from '@/components/Loading'
import NotFound from '@/components/NotFound'

const Post = ({ post, blockMap }) => {
  const router = useRouter()

  // Handle fallback state
  if (router.isFallback) {
    return <Loading />
  }

  // Handle 404 (data missing)
  if (!post || !blockMap) {
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

    // Validasyon: Slug'ı olmayan postları filtrele
    const validPosts = posts.filter(post => post && post.slug)

    return {
      // FIX: Use explicit params object structure
      paths: validPosts.map((row) => ({
        params: {
          slug: row.slug,
        },
      })),
      fallback: true,
    }
  } catch (error) {
    console.error('Error generating paths:', error)
    return {
      paths: [],
      fallback: true,
    }
  }
}

export async function getStaticProps({ params: { slug } }) {
  try {
    const posts = await getAllPosts({ onlyNewsletter: false })
    const post = posts.find((t) => t.slug === slug)

    if (!post) {
      console.warn(`Post not found for slug: ${slug}`)
      return {
        props: { post: null, blockMap: null },
        revalidate: 1,
      }
    }

    const blockMap = await getPostBlocks(post.id)

    // FIX: Nuclear option for serialization errors.
    // This strips all 'undefined' values from the deep object structure
    // allowing Next.js to serialize it without crashing.
    const safePost = JSON.parse(JSON.stringify(post))
    const safeBlockMap = JSON.parse(JSON.stringify(blockMap))

    return {
      props: {
        post: safePost,
        blockMap: safeBlockMap,
      },
      revalidate: 1,
    }
  } catch (err) {
    console.error(`Error in getStaticProps for slug ${slug}:`, err)
    // Return nulls so the page renders the 404 component instead of crashing the build
    return {
      props: {
        post: null,
        blockMap: null,
      },
      revalidate: 1,
    }
  }
}

export default Post