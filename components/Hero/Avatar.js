import Image from 'next/image'
import { useRouter } from 'next/router'
import { lang } from '@/lib/lang'

const Avatar = ({ className = '' }) => {
  const { locale } = useRouter()
  const localeKey = locale ? locale.split('-')[0] : 'en'
  const t = lang[localeKey] || lang.en

  const statusTitle =
    t?.HERO?.HOME?.STATUS_AVAILABLE || 'Available for projects & collaboration'

  return (
    <div className={`relative flex items-center justify-center mx-auto group select-none ${className}`}>
      {/* Ambient Breathing Glow Aura */}
      <div
        aria-hidden='true'
        className='absolute -inset-3 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 opacity-40 dark:opacity-50 blur-2xl animate-avatar-glow transition-all duration-500 group-hover:opacity-75 group-hover:blur-3xl pointer-events-none'
      />

      {/* Modern Gradient Border Ring with Float Animation */}
      <div className='relative animate-avatar-float'>
        <div className='relative p-1 sm:p-1.5 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-2xl transition-transform duration-500 group-hover:scale-[1.03]'>
          {/* Avatar Image Frame */}
          <div className='relative w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-60 lg:h-60 rounded-full overflow-hidden bg-white dark:bg-gray-900 border-2 border-white dark:border-gray-800'>
            <Image
              fill
              priority
              alt='Mehmet Abak'
              src='https://github.com/mehmetabak.png'
              sizes='(max-width: 640px) 144px, (max-width: 768px) 192px, 240px'
              className='object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105'
            />
          </div>

          {/* Pulsating Online/Available Status Badge */}
          <div
            className='absolute bottom-1 right-1 sm:bottom-2 sm:right-2 flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white dark:bg-gray-900 shadow-lg border-2 border-white dark:border-gray-800 z-10 cursor-default'
            title={statusTitle}
          >
            <span className='relative flex h-3 w-3'>
              <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75' />
              <span className='relative inline-flex rounded-full h-3 w-3 bg-emerald-500' />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Avatar
