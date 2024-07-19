import BLOG from '@/blog.config'
import dynamic from 'next/dynamic'
import { useEffect } from 'react'

const UtterancesComponent = dynamic(
  () => {
    return import('@/components/Post/Utterances')
  },
  { ssr: false }
)
const SupaCommentsComponent = dynamic(
  () => {
    return import('@/components/Post/SupaComments')
  },
  { ssr: false }
)

const Comments = ({ frontMatter }) => {
  useEffect(() => {
    return () => {
      const commentsContainer = document.getElementById('comments')
      if (commentsContainer) {
        commentsContainer.innerHTML = ''
      }
    }
  }, [])

  return (
    <div>
      {BLOG.comment && BLOG.comment.provider === 'utterances' && (
        <UtterancesComponent issueTerm={frontMatter.id} />
      )}
      {BLOG.comment && BLOG.comment.provider === 'supacomments' && (
        <SupaCommentsComponent />
      )}
    </div>
  )
}

export default Comments
