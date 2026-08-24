import PropTypes from 'prop-types'
import { getPageTableOfContents } from 'notion-utils'
import Link from 'next/link'
import { ChevronLeftIcon } from '@heroicons/react/outline'
import BLOG from '@/blog.config'

export default function TableOfContents({
  blockMap,
  frontMatter,
  pageId,
  pageTitle,
  showScrollElement = true
}) {
  if (!blockMap) return null

  const normalizeId = (id = '') => id.replaceAll('-', '')
  const unwrapBlockValue = (block) => {
    if (!block) return null
    if (block.value?.value) return block.value.value
    if (block.value) return block.value
    return block
  }

  const getBlockValueById = (id) => {
    if (!id) return null
    return unwrapBlockValue(
      blockMap?.block?.[id] ?? blockMap?.block?.[normalizeId(id)]
    )
  }

  const blockValues = Object.values(blockMap.block ?? {})
    .map(unwrapBlockValue)
    .filter(Boolean)

  const page =
    getBlockValueById(pageId) ??
    blockValues.find((block) => block?.type === 'page') ??
    blockValues[0]

  if (!page) return null

  const nodes = getPageTableOfContents(page, blockMap)
  if (!nodes || !nodes.length || !showScrollElement) return null

  /**
   * Get the level of the title (1-6)
   */
  const getHeaderLevel = (node) => {
    const block = getBlockValueById(node.id)
    if (block?.type === 'header') return 1
    if (block?.type === 'sub_header') return 2
    if (block?.type === 'sub_sub_header') return 3
    return node.level || 1
  }

  /**
   * Get the indentation and style class name according to the level
   */
  const getLevelStyles = (level) => {
    const styles = {
      1: 'pl-2 text-gray-700 dark:text-gray-300 font-medium',
      2: 'pl-6 text-gray-600 dark:text-gray-400',
      3: 'pl-10 text-gray-500 dark:text-gray-500 text-xs'
    }
    return styles[level] || styles[3]
  }

  /**
   * Scroll to target heading
   */
  function scrollTo(id) {
    id = id.replaceAll('-', '')
    const target = document.querySelector(`.notion-block-${id}`)
    if (!target) return
    const top =
      document.documentElement.scrollTop +
      target.getBoundingClientRect().top -
      65
    document.documentElement.scrollTo({
      top,
      behavior: 'smooth'
    })
  }

  return (
    <div className='table-of-contents toc-fade-in'>
      {pageTitle && frontMatter?.slug && (
        <Link
          passHref
          href={`${BLOG.path}/${frontMatter.slug}`}
          scroll={false}
          className='block -ml-6 mb-2 p-2 hover:bg-gray-200 hover:dark:bg-gray-700 rounded-lg'
        >
          <ChevronLeftIcon className='inline-block mb-1 h-5 w-5' />
          <span className='ml-1'>{frontMatter.title}</span>
        </Link>
      )}
      <div className='max-h-[70vh] overflow-y-auto'>
        {nodes.map((node) => {
          const level = getHeaderLevel(node)
          const levelStyles = getLevelStyles(level)

          return (
            <div
              key={node.id}
              className='hover:bg-gray-200 hover:dark:bg-gray-700 rounded-lg transition-colors relative'
            >
              <a
                data-target-id={node.id}
                className={`block py-1.5 px-2 cursor-pointer transition-colors relative ${levelStyles}`}
                onClick={() => scrollTo(node.id)}
                title={node.text}
              >
                {level > 1 && (
                  <span
                    className='absolute top-1/2 transform -translate-y-1/2 w-1 h-1 bg-current rounded-full opacity-60'
                    style={{ left: `${level === 2 ? '12px' : '24px'}` }}
                  />
                )}
                <span className={level > 1 ? 'truncate block' : ''}>
                  {node.text}
                </span>
              </a>
            </div>
          )
        })}
        <div className='pb-4' />
      </div>
    </div>
  )
}

TableOfContents.propTypes = {
  blockMap: PropTypes.object,
  frontMatter: PropTypes.object.isRequired,
  pageId: PropTypes.string,
  pageTitle: PropTypes.string,
  showScrollElement: PropTypes.bool
}
