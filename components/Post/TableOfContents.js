import PropTypes from 'prop-types';
import { getPageTableOfContents } from 'notion-utils';
import Link from 'next/link';
import { ChevronLeftIcon } from '@heroicons/react/outline';
import BLOG from '@/blog.config';

export default function TableOfContents({ blockMap, frontMatter, pageTitle }) {
  let collectionId, page;

  // Determine the collectionId and page based on whether pageTitle is provided
  if (pageTitle) {
    collectionId = Object.keys(blockMap.block)[0];
    page = blockMap.block[collectionId].value;
  } else {
    collectionId = Object.keys(blockMap.collection)[0];
    page = Object.values(blockMap.block).find(block => block.value.parent_id === collectionId).value;
  }

  // Get the table of contents nodes
  const nodes = getPageTableOfContents(page, blockMap);

  // Function to scroll to a specific heading
  const scrollTo = (id) => {
    id = id.replaceAll('-', '');
    const target = document.querySelector(`.notion-block-${id}`);
    if (!target) return;
    const top = document.documentElement.scrollTop + target.getBoundingClientRect().top - 65;
    document.documentElement.scrollTo({
      top,
      behavior: 'smooth'
    });
  };

  return (
    <div className='hidden xl:block xl:fixed ml-4 text-sm text-gray-500 dark:text-gray-400 whitespace'>
      {pageTitle && (
        <Link passHref href={`${BLOG.path}/${frontMatter.slug}`} scroll={false}>
          <a className='block -ml-6 mb-2 p-2 hover:bg-gray-200 hover:dark:bg-gray-700 rounded-lg'>
            <ChevronLeftIcon className='inline-block mb-1 h-5 w-5' />
            <span className='ml-1'>{frontMatter.title}</span>
          </a>
        </Link>
      )}
      <div className='max-h-[70vh] overflow-y-auto'>
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
        {/* Placeholder div to ensure content height is correctly calculated */}
        <div className='pb-4' />
      </div>
    </div>
  );
}

TableOfContents.propTypes = {
  blockMap: PropTypes.object.isRequired,
  frontMatter: PropTypes.object.isRequired,
  pageTitle: PropTypes.string
};
