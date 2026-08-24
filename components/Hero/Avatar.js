import { useState } from 'react'
import NotionAvatar from './NotionAvatar'

const Avatar = ({ className = '' }) => {
  const [hasError, setHasError] = useState(false)

  return (
    <div className={`flex items-center justify-center md:justify-end w-full ${className}`}>
      <div className='relative w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 rounded-3xl p-2 border border-gray-200 dark:border-gray-700/80 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm transition-all duration-300 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 group'>
        <div className='w-full h-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center'>
          {!hasError ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src='https://github.com/mehmetabak.png'
              alt='Mehmet Abak'
              onError={() => setHasError(true)}
              className='w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105 select-none'
              loading='eager'
            />
          ) : (
            <NotionAvatar className='w-full h-full p-4 text-gray-600 dark:text-gray-300 select-none' />
          )}
        </div>
      </div>
    </div>
  )
}

export default Avatar
