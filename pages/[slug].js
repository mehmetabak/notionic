// [slug].js - FIXED VERSION
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
  
  // DEĞİŞİKLİK 1: String dizisi yerine params objesi döndürüyoruz.
  // Eski kodun: paths: posts.map((row) => `${BLOG.path}/${row.slug}`) -> YANLIŞ
  return {
    paths: posts
      .filter(row => row.slug) // Slug'ı olmayanları filtrele
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
    
    if (!post) {
      return {
        props: { post: null, blockMap: null },
        revalidate: 1
      }
    }

    const blockMap = await getPostBlocks(post.id)
    
    // DEĞİŞİKLİK 2: Manuel temizleme yerine "Deep Clean" yapıyoruz.
    // Notion verisi iç içe geçmiştir (nested). Senin yazdığın fonksiyon alt dallara bakmıyordu.
    // JSON.stringify undefined olan her şeyi (en dipte olsa bile) otomatik siler.
    const safePost = JSON.parse(JSON.stringify(post))
    const safeBlockMap = JSON.parse(JSON.stringify(blockMap))
    
    return {
      props: {
        post: safePost,
        blockMap: safeBlockMap
      },
      revalidate: 1
    }
  } catch (err) {
    console.error(`Error in getStaticProps for slug ${slug}:`, err)
    return {
      props: { post: null, blockMap: null },
      revalidate: 1
    }
  }
}

export default Post