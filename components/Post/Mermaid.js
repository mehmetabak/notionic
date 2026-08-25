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
        const isDark = resolvedTheme === 'dark'

        const themeVariables = isDark
          ? {
              darkMode: true,
              background: 'transparent',
              primaryColor: '#2d3748',
              primaryTextColor: '#f7fafc',
              primaryBorderColor: '#3b82f6',
              lineColor: '#60a5fa',
              secondaryColor: '#1a202c',
              tertiaryColor: '#171923',
              edgeLabelBackground: '#2d3748',
              nodeBorder: '#3b82f6',
              clusterBkg: '#1a202c',
              clusterBorder: '#4a5568',
              defaultLinkColor: '#60a5fa',
              titleColor: '#ffffff',
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: '14px'
            }
          : {
              darkMode: false,
              background: 'transparent',
              primaryColor: '#f1f5f9',
              primaryTextColor: '#0f172a',
              primaryBorderColor: '#2563eb',
              lineColor: '#3b82f6',
              secondaryColor: '#e2e8f0',
              tertiaryColor: '#f8fafc',
              edgeLabelBackground: '#ffffff',
              nodeBorder: '#2563eb',
              clusterBkg: '#f8fafc',
              clusterBorder: '#cbd5e1',
              defaultLinkColor: '#3b82f6',
              titleColor: '#0f172a',
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: '14px'
            }

        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables,
          securityLevel: 'loose',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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
      <div className='my-6 p-4 rounded-2xl border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20 text-xs font-mono text-red-600 dark:text-red-400'>
        <div className='font-bold mb-1'>Mermaid Diagram Syntax:</div>
        <pre className='overflow-x-auto whitespace-pre-wrap'>{chart}</pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className='flex items-center justify-center my-8 p-10 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-gray-400 animate-pulse text-sm'>
        Diagram loading...
      </div>
    )
  }

  return (
    <div className='w-full my-8 flex justify-center'>
      <div
        ref={containerRef}
        className='w-full flex items-center justify-center p-6 md:p-8 overflow-x-auto rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white/70 dark:bg-gray-800/40 backdrop-blur-sm shadow-sm transition-all duration-300 [&>svg]:mx-auto [&>svg]:max-w-full [&>svg]:h-auto select-none'
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}
