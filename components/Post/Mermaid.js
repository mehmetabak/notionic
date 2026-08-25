import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'

export default function Mermaid({ chart, id }) {
  const containerRef = useRef(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(null)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    let isMounted = true

    async function renderDiagram() {
      if (!chart || typeof window === 'undefined') return

      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: resolvedTheme === 'dark' ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'inherit'
        })

        const uniqueId = `mermaid-${(id || Math.random().toString(36).substring(2, 9)).replace(/[^a-zA-Z0-9_-]/g, '')}`
        const { svg: renderedSvg } = await mermaid.render(uniqueId, chart)

        if (isMounted) {
          setSvg(renderedSvg)
          setError(null)
        }
      } catch (err) {
        console.warn('[mermaid] render error:', err.message)
        if (isMounted) {
          setError(err.message)
        }
      }
    }

    renderDiagram()

    return () => {
      isMounted = false
    }
  }, [chart, id, resolvedTheme])

  if (error) {
    return (
      <div className='my-4 p-4 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20 text-xs font-mono text-red-600 dark:text-red-400'>
        <div className='font-bold mb-1'>Mermaid Diagram Syntax:</div>
        <pre className='overflow-x-auto whitespace-pre-wrap'>{chart}</pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className='flex items-center justify-center my-6 p-8 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-gray-400 animate-pulse text-sm'>
        Diagram loading...
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className='my-6 p-4 md:p-6 overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-gray-800/50 shadow-sm flex items-center justify-center select-none'
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
