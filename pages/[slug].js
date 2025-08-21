import Layout from '@/layouts/layout'
import { getAllPosts, getPostBlocks } from '@/lib/notion'
import BLOG from '@/blog.config'
import { useRouter } from 'next/router'
import Loading from '@/components/Loading'
import NotFound from '@/components/NotFound'
import { getPreviewImageMap } from '@/lib/preview-images'

const Post = ({ post, blockMap }) => {
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
    <Layout blockMap={blockMap} frontMatter={post} fullWidth={post.fullWidth} previewImagesMap={previewImagesMap}/>
  )
}

export async function getStaticPaths() {
  const posts = await getAllPosts({ onlyNewsletter: false })
  return {
    paths: posts.map((row) => `${BLOG.path}/${row.slug}`),
    fallback: true
  }
}

export async function getStaticProps({ params: { slug } }) {
  const posts = await getAllPosts({ onlyNewsletter: false })
  const post = posts.find((t) => t.slug === slug)

  try {
    const blockMap = await getPostBlocks(post.id)
    const previewImagesMap = await getPreviewImageMap(blockMap)
    return {
      props: {
        post,
        blockMap,
        previewImagesMap 
      },
      revalidate: 1
    }
  } catch (err) {
    console.error(err)
    return {
      props: {
        post: null,
        blockMap: null,
        previewImagesMap: null
      }
    }
  }
}

export default Post
