// pages/[slug].js

import Layout from '@/layouts/layout'
import { getAllPosts, getPostBlocks } from '@/lib/notion'
import BLOG from '@/blog.config'
import { useRouter } from 'next/router'
import Loading from '@/components/Loading'
import NotFound from '@/components/NotFound'

const Post = ({ post, blockMap }) => {
  // ... your component code remains the same
  const router = useRouter()
  if (router.isFallback) {
    return (
      <Loading />
    )
  }
  if (!post) {
    return <NotFound statusCode={404} />
  }
  return (
    <Layout blockMap={blockMap} frontMatter={post} fullWidth={post.fullWidth} />
  )
}

export async function getStaticPaths() {
  const posts = await getAllPosts({ onlyNewsletter: false })
  return {
    // ✅ FIX: Filter out any posts that are missing a slug before mapping.
    paths: posts
      .filter(post => post && post.slug)
      .map(post => `${BLOG.path}/${post.slug}`),
    fallback: true
  }
}

export async function getStaticProps({ params: { slug } }) {
  // Keep the previous fix here as a safety net for manually entered URLs
  const posts = await getAllPosts({ onlyNewsletter: false })
  const post = posts.find((t) => t.slug === slug)

  if (!post) {
    return {
      notFound: true
    }
  }

  try {
    const blockMap = await getPostBlocks(post.id)
    return {
      props: {
        post,
        blockMap
      },
      revalidate: 1
    }
  } catch (err) {
    console.error(err)
    // If Notion API fails for a specific page, you can show a 404 or a custom error page.
    return {
      notFound: true
    }
  }
}

export default Post