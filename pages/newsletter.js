import Container from '@/components/Container'
import BlogPost from '@/components/BlogPost'
import NewsletterHero from '@/components/Hero/Newsletter'
import { getAllPosts, getPostBlocks } from '@/lib/notion'
import BLOG from '@/blog.config'

export async function getStaticProps() {
  const posts = await getAllPosts({ onlyNewsletter: true })
  const heros = await getAllPosts({ onlyHidden: true })
  const hero = heros.find((t) => t.slug === 'newsletter')

  let blockMap = null // ✅ default to null, not undefined

  if (hero?.id) { // ✅ only fetch if hero actually exists
    try {
      const raw = await getPostBlocks(hero.id)
      blockMap = JSON.parse(JSON.stringify(raw ?? null)) // ✅ strip undefined values
    } catch (err) {
      console.error('Failed to fetch newsletter hero blockMap:', err)
      blockMap = null
    }
  } else {
    console.warn('No hero post with slug "newsletter" found — skipping blockMap fetch')
  }

  return {
    props: {
      posts,
      blockMap
    },
    revalidate: 1
  }
}

const newsletter = ({ posts, blockMap }) => {
  return (
    <Container title={BLOG.newsletter} description={BLOG.description}>
      <NewsletterHero blockMap={blockMap} />
      {posts.map((post) => (
        <BlogPost key={post.id} post={post} />
      ))}
    </Container>
  )
}

export default newsletter