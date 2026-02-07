import Container from '@/components/Container'
import BlogPost from '@/components/BlogPost'
import Pagination from '@/components/Pagination'
import { getAllPosts } from '@/lib/notion'
import BLOG from '@/blog.config'

const Page = ({ postsToShow, page, showNext }) => {
  return (
    <Container>
      {postsToShow &&
        postsToShow.map((post) => <BlogPost key={post.id} post={post} />)}
      <Pagination page={page} showNext={showNext} />
    </Container>
  )
}

export async function getStaticProps(context) {
  // 1. Ensure page is an integer (params are strings by default)
  const page = parseInt(context.params.page, 10)
  
  const posts = await getAllPosts({ onlyNewsletter: false })
  
  const postsToShow = posts.slice(
    BLOG.postsPerPage * (page - 1),
    BLOG.postsPerPage * page
  )
  
  const totalPosts = posts.length
  const showNext = page * BLOG.postsPerPage < totalPosts

  // 2. Fix Serialization Error:
  // Next.js crashes if props contain 'undefined'. Notion data often has undefined fields.
  // We sanitize the data by stringifying and parsing it back.
  const safePostsToShow = JSON.parse(JSON.stringify(postsToShow))

  return {
    props: {
      page, 
      postsToShow: safePostsToShow,
      showNext
    },
    revalidate: 1
  }
}

export async function getStaticPaths() {
  try {
    const posts = await getAllPosts({ onlyNewsletter: false })
    
    // Null kontrolü ekle
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return {
        paths: [],
        fallback: true
      }
    }
    
    const totalPosts = posts.length
    const totalPages = Math.ceil(totalPosts / BLOG.postsPerPage)
    
    return {
      // remove first page, we 're not gonna handle that.
      paths: Array.from({ length: totalPages - 1 }, (_, i) => ({
        params: { page: '' + (i + 2) }
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

export default Page