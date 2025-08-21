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
    <Layout blockMap={blockMap} frontMatter={post} fullWidth={post.fullWidth} />
  )
}

export async function getStaticPaths() {
  try {
    const posts = await getAllPosts({ onlyNewsletter: false })

    const validPosts = posts.filter(post => post && post.slug)

    return {
      paths: validPosts.map((row) => `${BLOG.path}/${row.slug}`),
      fallback: true
    }
  } catch (error) {
    console.error('Failed to get posts for static paths:', error)
    return {
      paths: [],
      fallback: true
    }
  }
}

export async function getStaticProps({ params: { slug } }) {
  try {
    const posts = await getAllPosts({ onlyNewsletter: false })
    const post = posts.find((t) => t && t.slug === slug) // Added check for `t`

    if (!post || !post.id) {
      return { notFound: true }
    }

    const blockMap = await getPostBlocks(post.id)
    return {
      props: {
        post,
        blockMap
      },
      revalidate: 1
    }
  } catch (err) {
    console.error(`Failed to get static props for slug: ${slug}`, err)

    return { notFound: true }
  }
}

export default Post