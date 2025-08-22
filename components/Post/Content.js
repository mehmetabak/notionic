import BLOG from '@/blog.config'
import PropTypes from 'prop-types'
import Link from 'next/link'
import { useState, useEffect } from 'react'

import FormattedDate from '@/components/Common/FormattedDate'
import TagItem from '@/components/Common/TagItem'
import NotionRenderer from '@/components/Post/NotionRenderer'

import { ChevronLeftIcon } from '@heroicons/react/outline'

export default function Content (props) {
  const { frontMatter, blockMap, pageTitle } = props
  const [imagesLoaded, setImagesLoaded] = useState(false)

  // Handle image loading state
  useEffect(() => {
    if (!BLOG.previewImagesEnabled) {
      setImagesLoaded(true)
      return
    }

    // Small delay to ensure preview images are processed
    const timer = setTimeout(() => {
      setImagesLoaded(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [blockMap])

  // Force re-render images on client side
  useEffect(() => {
    if (typeof window !== 'undefined' && imagesLoaded) {
      // Trigger a gentle re-render of images
      const images = document.querySelectorAll('img[data-src]')
      images.forEach(img => {
        if (img.dataset.src && !img.src) {
          img.src = img.dataset.src
        }
      })
    }
  }, [imagesLoaded])

  return (
    <article className='flex-none md:overflow-x-visible overflow-x-scroll w-full'>
      {pageTitle && (
        <Link
          passHref
          href={`${BLOG.path}/${frontMatter.slug}`}
          scroll={false}
          className='block md:-ml-6 mb-2 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300'
        >
          <ChevronLeftIcon className='inline-block mb-1 h-5 w-5' />
          <span className='m-1'>{frontMatter.title}</span>
        </Link>
      )}
      <h1 className='font-bold text-3xl text-black dark:text-white'>
        {pageTitle ? pageTitle : frontMatter.title}
      </h1>
      {frontMatter.type[0] !== 'Page' && (
        <nav className='flex mt-5 mb-10 items-start text-gray-500 dark:text-gray-400'>
          <div className='mr-2 mb-4 md:ml-0'>
            <FormattedDate date={frontMatter.date} />
          </div>
          {frontMatter.tags && (
            <div className='flex flex-nowrap max-w-full overflow-x-auto article-tags'>
              {frontMatter.tags.map((tag) => (
                <TagItem key={tag} tag={tag} />
              ))}
            </div>
          )}
        </nav>
      )}
      <div className="-mt-4 relative">
        {/* Loading state için minimal indicator */}
        {BLOG.previewImagesEnabled && !imagesLoaded && (
          <div className="absolute inset-0 bg-gray-50 dark:bg-gray-800 opacity-50 pointer-events-none transition-opacity duration-300" />
        )}
        
        <NotionRenderer
          blockMap={blockMap}
          previewImages={BLOG.previewImagesEnabled && imagesLoaded}
          forceRefreshImages={imagesLoaded}
          {...props}
        />
      </div>
    </article>
  )
}

Content.propTypes = {
  frontMatter: PropTypes.object.isRequired,
  blockMap: PropTypes.object.isRequired,
  pageTitle: PropTypes.string
}