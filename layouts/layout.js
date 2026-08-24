import { useEffect, useState } from 'react'
import { getPageTitle } from 'notion-utils'
import { motion } from 'framer-motion'

import Container from '@/components/Container'
import Content from '@/components/Post/Content'
import Aside from '@/components/Post/Aside'
import Comments from '@/components/Post/Comments'
import PostFooter from '@/components/Post/PostFooter'
import RelatedPosts from '@/components/Post/RelatedPosts'
import ReadingProgress from '@/components/Common/ReadingProgress'

const Layout = ({
  blockMap,
  frontMatter,
  fullWidth = false,
  subPage = false,
  pageId,
  relatedPosts = []
}) => {
  const [showSubPageTitle, setShowSubPageTitle] = useState(false)

  const pageTitle = getPageTitle(blockMap)
  useEffect(() => {
    if (frontMatter.title !== pageTitle) {
      setShowSubPageTitle(true)
    }
  }, [frontMatter, pageTitle, subPage])

  return (
    <Container
      title={`${frontMatter.title}${frontMatter.title === pageTitle ? '' : ' | ' + pageTitle}`}
      description={frontMatter.summary}
      // date={new Date(frontMatter.publishedAt).toISOString()}
      type='article'
      fullWidth={fullWidth}
    >
      <ReadingProgress />
      <motion.div className='flex flex-row'>
        <Content
          frontMatter={frontMatter}
          blockMap={blockMap}
          pageTitle={showSubPageTitle ? pageTitle : null}
        />
        <Aside
          frontMatter={frontMatter}
          blockMap={blockMap}
          pageTitle={showSubPageTitle ? pageTitle : null}
          pageId={pageId}
        />
      </motion.div>
      <RelatedPosts currentPost={frontMatter} posts={relatedPosts} />
      <PostFooter />
      <Comments frontMatter={frontMatter} />
    </Container>
  )
}

export default Layout
