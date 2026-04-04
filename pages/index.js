import Container from '@/components/Container'
import BlogPost from '@/components/BlogPost'
import Hero from '@/components/Hero/Home'
import Pagination from '@/components/Pagination'
import { getAllPosts, getPostBlocks } from '@/lib/notion'
import BLOG from '@/blog.config'

export async function getStaticProps() {
  const posts = await getAllPosts({ onlyPost: true })
  const heros = await getAllPosts({ onlyHidden: true })
  const hero = heros.find((t) => t.slug === 'index')

  let blockMap = null // ✅ default to null, not undefined

  if (hero?.id) { // ✅ only fetch if hero actually exists
    try {
      const raw = await getPostBlocks(hero.id)
      // ✅ strip undefined values so Next.js can serialize the props
      blockMap = JSON.parse(JSON.stringify(raw ?? null))
    } catch (err) {
      console.error('Failed to fetch hero blockMap:', err)
      blockMap = null
    }
  } else {
    console.warn('No hero post with slug "index" found — skipping blockMap fetch')
  }

  const postsToShow = posts.slice(0, BLOG.postsPerPage)
  const totalPosts = posts.length
  const showNext = totalPosts > BLOG.postsPerPage

  return {
    props: {
      page: 1,
      postsToShow,
      showNext,
      blockMap // null is serializable; undefined is not
    },
    revalidate: 1
  }
}

const blog = ({ postsToShow, page, showNext, blockMap }) => {
  return (
    <Container title={BLOG.title} description={BLOG.description}>
      <Hero blockMap={blockMap} />
      {postsToShow.map((post) => (
        <BlogPost key={post.id} post={post} />
      ))}
      {showNext && <Pagination page={page} showNext={showNext} />}
    </Container>
  )
}

export default blog