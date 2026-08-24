import { lang } from '@/lib/lang'

export function getReadingTime(blockMap, locale = 'en') {
  if (!blockMap || !blockMap.block) {
    return null
  }

  let totalWords = 0

  for (const item of Object.values(blockMap.block)) {
    const block = item?.value || item
    if (block?.properties?.title) {
      for (const titleFragment of block.properties.title) {
        if (typeof titleFragment[0] === 'string') {
          const words = titleFragment[0].trim().split(/\s+/).filter(Boolean)
          totalWords += words.length
        }
      }
    }
  }

  if (totalWords === 0) {
    return null
  }

  const wordsPerMinute = 200
  const minutes = Math.max(1, Math.ceil(totalWords / wordsPerMinute))

  const localeKey = locale ? locale.split('-')[0] : 'en'
  const t = lang[localeKey] || lang.en

  const formattedWords = totalWords.toLocaleString(
    localeKey === 'tr' ? 'tr-TR' : localeKey === 'zh' ? 'zh-CN' : 'en-US'
  )

  const readingTimeText = t?.LAYOUT?.READING_TIME || 'min read'
  const wordsText = t?.LAYOUT?.WORDS || 'words'

  const label = `${minutes} ${readingTimeText}`
  const wordsLabel = `${formattedWords} ${wordsText}`

  return {
    minutes,
    words: totalWords,
    formattedWords,
    text: `${label} • ${wordsLabel}`,
    shortText: label
  }
}
