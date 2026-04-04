import Container from '@/components/Container'
import NotePost from '@/components/NotePost'
import NotesHero from '@/components/Hero/Notes'
import { getBlocksMaps } from '@/lib/getBlocksMaps'
import { getPostBlocks, getAllPosts } from '@/lib/notion'

export async function getStaticProps() {
  const { pagesJson, siteConfigObj } = await getBlocksMaps()

  const blocksJson = pagesJson
  for (let i = 0; i < blocksJson.length; i++) {
    const deleteTitleBlock = blocksJson[i].title === 'Title' ? blocksJson.splice(i, i + 1) : blocksJson
    const deleteIndexBlock = blocksJson[i].slug === 'index' ? blocksJson.splice(i, i + 1) : blocksJson
    console.log('[INFO] Hide Craft Table Header: ', deleteTitleBlock.length, deleteIndexBlock.length)
  }

  const heros = await getAllPosts({ onlyHidden: true })
  const hero = heros.find((t) => t.slug === 'notes')

  let blockMap = null // ✅ default to null, not undefined

  if (hero?.id) { // ✅ only fetch if hero actually exists
    try {
      const raw = await getPostBlocks(hero.id)
      blockMap = JSON.parse(JSON.stringify(raw ?? null)) // ✅ strip undefined values
    } catch (err) {
      console.error('Failed to fetch notes hero blockMap:', err)
      blockMap = null
    }
  } else {
    console.warn('No hero post with slug "notes" found — skipping blockMap fetch')
  }

  return {
    props: {
      blocksJson,
      siteConfigObj,
      blockMap
    },
    revalidate: 1
  }
}

const Notes = ({ blocksJson, siteConfigObj, blockMap }) => {
  return (
    <Container
      title={siteConfigObj['Site Name']}
      description={siteConfigObj['Site Description']}
      siteConfigObj={siteConfigObj}
    >
      <NotesHero blockMap={blockMap} />
      {blocksJson.map((block) => (
        <NotePost key={block.slug} note={block} />
      ))}
    </Container>
  )
}

export default Notes