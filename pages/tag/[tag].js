import { getAllPosts, getAllTagsFromPosts } from '@/lib/notion'
import SearchLayout from '@/layouts/search'

export default function Tag({ tags, posts, currentTag }) {
  return <SearchLayout tags={tags} posts={posts} currentTag={currentTag} />
}

export async function getStaticProps({ params }) {
  const currentTag = params.tag
  const posts = await getAllPosts({ onlyNewsletter: false })
  const tags = getAllTagsFromPosts(posts)
  const filteredPosts = posts.filter(
    (post) => post && post.tags && post.tags.includes(currentTag)
  )
  return {
    props: {
      tags,
      posts: filteredPosts,
      currentTag
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
    
    const tags = getAllTagsFromPosts(posts)
    
    // Tags kontrolü de ekle
    if (!tags || typeof tags !== 'object') {
      return {
        paths: [],
        fallback: true
      }
    }
    
    return {
      paths: Object.keys(tags).map((tag) => ({ params: { tag } })),
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