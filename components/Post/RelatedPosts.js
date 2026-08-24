import BLOG from '@/blog.config'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { lang } from '@/lib/lang'
import FormattedDate from '@/components/Common/FormattedDate'
import { SparklesIcon, ArrowRightIcon } from '@heroicons/react/outline'

const RelatedPosts = ({ currentPost, posts = [] }) => {
  const { locale } = useRouter()
  const t = lang[locale] || lang.en

  if (!posts || posts.length === 0 || currentPost?.type?.[0] === 'Page') {
    return null
  }

  return (
    <section className='w-full my-10 pt-6 border-t border-gray-100 dark:border-gray-800'>
      <div className='flex items-center gap-2 mb-6'>
        <SparklesIcon className='w-5 h-5 text-indigo-500 dark:text-indigo-400' />
        <h2 className='text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100'>
          {t.LAYOUT.RELATED_POSTS}
        </h2>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {posts.map((post) => (
          <Link
            key={post.id}
            passHref
            href={`${BLOG.path}/${post.slug}`}
            scroll={false}
            className='group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white/70 dark:bg-gray-800/60 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-500 cursor-pointer'
          >
            <Image
              fill
              alt={post.title}
              src={post?.page_cover || BLOG.defaultCover}
              className='absolute inset-0 w-full h-full object-cover object-center opacity-0 group-hover:opacity-10 dark:group-hover:opacity-20 group-hover:scale-105 transition-all duration-500 ease-out pointer-events-none'
            />

            <div className='relative z-10'>
              <div className='flex items-center justify-between text-xs font-light text-gray-500 dark:text-gray-400 mb-2'>
                <span>
                  <FormattedDate date={post.date} />
                </span>
                <ArrowRightIcon className='w-4 h-4 text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all duration-300' />
              </div>

              <h3 className='text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300'>
                {post.title}
              </h3>

              {post.summary && (
                <p className='text-xs md:text-sm font-light text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed mb-4'>
                  {post.summary}
                </p>
              )}
            </div>

            {post.tags && post.tags.length > 0 && (
              <div className='relative z-10 flex flex-wrap gap-1.5 mt-auto pt-2'>
                {post.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className='text-[11px] font-normal px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300'
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
