import BLOG from '@/blog.config'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { lang } from '@/lib/lang'
import FormattedDate from '@/components/Common/FormattedDate'
import { SparklesIcon, ArrowRightIcon } from '@heroicons/react/outline'

const RelatedPosts = ({ currentPost, posts = [] }) => {
  const { locale } = useRouter()
  const localeKey = locale ? locale.split('-')[0] : 'en'
  const t = lang[localeKey] || lang.en

  if (!posts || posts.length === 0 || currentPost?.type?.[0] === 'Page') {
    return null
  }

  const isSingle = posts.length === 1

  return (
    <section className='w-full my-10 pt-6 border-t border-gray-100 dark:border-gray-800'>
      <div className='flex items-center gap-2 mb-6'>
        <SparklesIcon className='w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0' />
        <h2 className='text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100'>
          {t?.LAYOUT?.RELATED_POSTS || 'You might also like'}
        </h2>
      </div>

      <div
        className={`grid gap-5 md:gap-6 ${
          isSingle ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
        }`}
      >
        {posts.map((post) => (
          <Link
            key={post.id}
            passHref
            href={`${BLOG.path}/${post.slug}`}
            scroll={false}
            className={`group relative flex flex-col justify-between h-full min-h-[170px] overflow-hidden rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white/70 dark:bg-gray-800/60 p-5 md:p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-500 cursor-pointer ${
              isSingle ? 'w-full' : ''
            }`}
          >
            <Image
              fill
              alt={post.title}
              src={post?.page_cover || BLOG.defaultCover}
              className='absolute inset-0 w-full h-full object-cover object-center opacity-0 group-hover:opacity-10 dark:group-hover:opacity-20 group-hover:scale-105 transition-all duration-500 ease-out pointer-events-none'
            />

            <div className='relative z-10 flex flex-col'>
              <div className='flex items-center justify-between text-xs font-light text-gray-500 dark:text-gray-400 mb-2.5'>
                <span>
                  <FormattedDate date={post.date} />
                </span>
                <ArrowRightIcon className='w-4 h-4 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all duration-300 shrink-0 ml-2' />
              </div>

              <h3
                className={`font-semibold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300 break-words leading-snug ${
                  isSingle ? 'text-lg md:text-xl' : 'text-base md:text-lg line-clamp-2'
                }`}
              >
                {post.title}
              </h3>

              {post.summary && (
                <p
                  className={`text-xs md:text-sm font-light text-gray-600 dark:text-gray-300 leading-relaxed mb-4 break-words ${
                    isSingle ? 'line-clamp-3 md:line-clamp-2' : 'line-clamp-2'
                  }`}
                >
                  {post.summary}
                </p>
              )}
            </div>

            {post.tags && post.tags.length > 0 && (
              <div className='relative z-10 flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-gray-100/50 dark:border-gray-700/40'>
                {post.tags.slice(0, isSingle ? 5 : 3).map((tag) => (
                  <span
                    key={tag}
                    className='text-[11px] font-normal px-2.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 shrink-0'
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}

export default RelatedPosts
