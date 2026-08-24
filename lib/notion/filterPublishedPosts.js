export default function filterPublishedPosts({
  posts,
  onlyNewsletter = false,
  onlyPost = false,
  onlyHidden = false
} = {}) {
  if (!posts || !posts.length) return []

  return posts
    .filter((post) => {
      const type = Array.isArray(post?.type) ? post.type[0] : post?.type
      if (onlyNewsletter) return type === 'Newsletter'
      if (onlyPost) return type === 'Post'
      if (onlyHidden) return type === 'Hidden'
      return type !== 'Hidden'
    })
    .filter((post) => {
      const status = Array.isArray(post?.status) ? post.status[0] : post?.status
      const isPublished =
        typeof status === 'string'
          ? status.toLowerCase() === 'published'
          : false
      const postDate = Number(post.date) || 0

      return (
        Boolean(post.title) &&
        Boolean(post.slug) &&
        isPublished &&
        postDate <= Date.now()
      )
    })
}
