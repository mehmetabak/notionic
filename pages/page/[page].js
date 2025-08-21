import { memo } from 'react'
import Container from '@/components/Container'
import BlogPost from '@/components/BlogPost'
import Pagination from '@/components/Pagination'
import { getAllPosts } from '@/lib/notion'
import BLOG from '@/blog.config'

const Page = memo(({ postsToShow, page, showNext, totalPages }) => {
  return (
    <Container>
      {postsToShow && postsToShow.length > 0 ? (
        postsToShow.map((post) => (
          <BlogPost key={post.id} post={post} />
        ))
      ) : (
        <div>No posts found.</div>
      )}
      <Pagination 
        page={page} 
        showNext={showNext} 
        totalPages={totalPages}
      />
    </Container>
  )
})

Page.displayName = 'Page'

export async function getStaticProps({ params: { page } }) {
  const pageNumber = parseInt(page, 10)
  
  // Geçersiz sayfa numarası kontrolü
  if (isNaN(pageNumber) || pageNumber < 1) {
    return {
      notFound: true
    }
  }

  try {
    const posts = await getAllPosts({ onlyNewsletter: false })
    const publishedPosts = posts.filter(post => post.status === 'Published')
    
    const totalPosts = publishedPosts.length
    const totalPages = Math.ceil(totalPosts / BLOG.postsPerPage)
    
    // Sayfa numarası toplam sayfa sayısından büyükse 404
    if (pageNumber > totalPages) {
      return {
        notFound: true
      }
    }
    
    const startIndex = BLOG.postsPerPage * (pageNumber - 1)
    const endIndex = BLOG.postsPerPage * pageNumber
    const postsToShow = publishedPosts.slice(startIndex, endIndex)
    
    const showNext = pageNumber < totalPages
    
    return {
      props: {
        page: pageNumber,
        postsToShow,
        showNext,
        totalPages
      },
      revalidate: BLOG.revalidateTime || 3600 // 1 saat default
    }
  } catch (error) {
    console.error('Error in getStaticProps for page:', pageNumber, error)
    
    if (process.env.NODE_ENV === 'development') {
      throw error
    }
    
    return {
      notFound: true
    }
  }
}

export async function getStaticPaths() {
  try {
    const posts = await getAllPosts({ onlyNewsletter: false })
    const publishedPosts = posts.filter(post => post.status === 'Published')
    const totalPosts = publishedPosts.length
    const totalPages = Math.ceil(totalPosts / BLOG.postsPerPage)
    
    // İlk sayfayı hariç tut (ana sayfada gösterildiği için)
    const paths = Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => ({
      params: { page: String(i + 2) }
    }))
    
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

export default Page