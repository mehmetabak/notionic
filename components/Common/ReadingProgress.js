import { useState, useEffect } from 'react'

export default function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const updateProgress = () => {
      const currentScroll = window.scrollY
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      if (scrollHeight > 0) {
        const percent = Math.min(100, Math.max(0, (currentScroll / scrollHeight) * 100))
        setProgress(percent)
      }
    }

    window.addEventListener('scroll', updateProgress, { passive: true })
    updateProgress()

    return () => {
      window.removeEventListener('scroll', updateProgress)
    }
  }, [])

  if (progress <= 0) return null

  return (
    <div
      aria-hidden='true'
      className='fixed top-0 left-0 right-0 h-[2.5px] z-50 pointer-events-none bg-transparent'
    >
      <div
        className='h-full bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 dark:from-blue-500 dark:via-sky-400 dark:to-cyan-300 transition-all duration-100 ease-out shadow-[0_0_8px_rgba(14,165,233,0.7)]'
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
