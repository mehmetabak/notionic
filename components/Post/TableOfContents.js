import PropTypes from 'prop-types';
import { getPageTableOfContents } from 'notion-utils';
import Link from 'next/link';
import { ChevronLeftIcon } from '@heroicons/react/outline';
import BLOG from '@/blog.config';
import { useState } from 'react';

export default function TableOfContents ({ blockMap, frontMatter, pageTitle }) {
  const [scrollPosition, setScrollPosition] = useState(0);

  // Scroll event listener to update scroll position
  const handleScroll = () => {
    setScrollPosition(window.scrollY);
  };

  // Attach scroll event listener on component mount
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  let collectionId, page;
  if (pageTitle) {
    collectionId = Object.keys(blockMap.block)[0];
    page = blockMap.block[collectionId].value;
  } else {
    collectionId = Object.keys(blockMap.collection)[0];
    page = Object.values(blockMap.block).find(block => block.value.parent_id === collectionId).value;
  }
  const nodes = getPageTableOfContents(page, blockMap);
  if (!nodes.length) return null;

  /**
   * Scroll to the target heading block
   * @param {string} id - The ID of target heading block (could be in UUID format)
   */
  function scrollTo(id) {
    const idWithoutDashes = id.replaceAll('-', '');
    const target = document.querySelector(`.notion-block-${idWithoutDashes}`);
    if (!target) return;

    const top = scrollPosition + target.getBoundingClientRect().top - 65;
    window.scrollTo({
      top,
      behavior: 'smooth',
    });
  }

  return (
    <div className='hidden xl:block xl:fixed ml-4 text-sm text-gray-500 dark:text-gray-400 whitespace overflow-y-auto max-h-screen'>
      {pageTitle && (
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
      {nodes.map(node => (
        <div key={node.id} className='px-2 hover:bg-gray-200 hover:dark:bg-gray-700 rounded-lg'>
          <a
            data-target-id={node.id}
            className='block py-1 cursor-pointer'
            onClick={() => scrollTo(node.id)}
          >
            {node.text}
          </a>
        </div>
      ))}
    </div>
  );
}

TableOfContents.propTypes = {
  blockMap: PropTypes.object.isRequired,
  frontMatter: PropTypes.object.isRequired,
  pageTitle: PropTypes.string,
};
