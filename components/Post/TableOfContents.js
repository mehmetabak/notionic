import PropTypes from 'prop-types'
import { getPageTableOfContents } from 'notion-utils'
import Link from 'next/link'
import { ChevronLeftIcon } from '@heroicons/react/outline'
import BLOG from '@/blog.config'
import { useEffect, useRef } from 'react'

export default function TableOfContents ({ blockMap, frontMatter, pageTitle }) {
  const tocRef = useRef(null)

  let collectionId, page
  if (pageTitle) {
    collectionId = Object.keys(blockMap.block)[0]
    page = blockMap.block[collectionId].value
  } else {
    collectionId = Object.keys(blockMap.collection)[0]
    page = Object.values(blockMap.block).find(block => block.value.parent_id === collectionId).value
  }
  const nodes = getPageTableOfContents(page, blockMap)
  if (!nodes.length) return null

  function scrollTo (id) {
    id = id.replaceAll('-', '')
    const target = document.querySelector(`.notion-block-${id}`)
    if (!target) return
    const top = document.documentElement.scrollTop + target.getBoundingClientRect().top - 65
    document.documentElement.scrollTo({
      top,
      behavior: 'smooth'
    })
  }

  useEffect(() => {
    const toc = tocRef.current
    if (toc) {
      const updateSize = () => {
        toc.style.maxHeight = `${window.innerHeight * 0.8}px`
      }
      updateSize()
      window.addEventListener('resize', updateSize)
      return () => window.removeEventListener('resize', updateSize)
    }
  }, [])

  return (
    <div className='hidden xl:block xl:fixed ml-4 text-sm text-gray-500 dark:text-gray-400'>
      {pageTitle && (
        <Link
          href={`${BLOG.path}/${frontMatter.slug}`}
          scroll={false}
          className='block -ml-6 mb-2 p-2 hover:bg-gray-200 hover:dark:bg-gray-700 rounded-lg'
        >
          <ChevronLeftIcon className='inline-block mb-1 h-5 w-5' />
          <span className='ml-1'>{frontMatter.title}</span>
        </Link>
      )}
      <div ref={tocRef} className='overflow-y-auto pr-2'>
        {nodes.map(node => (
          <div key={node.id} className='px-2 hover:bg-gray-200 hover:dark:bg-gray-700 rounded-lg'>
            <a
              data-target-id={node.id}
              className='block py-1 cursor-pointer whitespace-nowrap'
              onClick={() => scrollTo(node.id)}
            >
              {node.text}
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

TableOfContents.propTypes = {
  blockMap: PropTypes.object.isRequired,
  frontMatter: PropTypes.object.isRequired,
  pageTitle: PropTypes.string
}