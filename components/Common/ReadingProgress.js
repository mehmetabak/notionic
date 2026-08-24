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
      className='fixed top-0 left-0 right-0 h-[3px] z-50 pointer-events-none bg-transparent'
    >
      <div
        className='h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-100 ease-out shadow-[0_0_8px_rgba(99,102,241,0.7)]'
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
