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

  const formattedWords = totalWords.toLocaleString(
    locale === 'tr' ? 'tr-TR' : locale === 'zh' ? 'zh-CN' : 'en-US'
  )

  let label = `${minutes} min read`
  let wordsLabel = `${formattedWords} words`

  if (locale === 'tr') {
    label = `${minutes} dk okuma`
    wordsLabel = `${formattedWords} kelime`
  } else if (locale === 'zh') {
    label = `${minutes} 分钟阅读`
    wordsLabel = `${formattedWords} 字`
  }

  return {
    minutes,
    words: totalWords,
    formattedWords,
    text: `${label} • ${wordsLabel}`,
    shortText: label
  }
}
