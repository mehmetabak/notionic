import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import BLOG from '@/blog.config'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.extend(localizedFormat)

const LOCALE_MAP = {
  zh: 'zh-cn',
  en: 'en',
  tr: 'tr',
  es: 'es',
  ja: 'ja'
}

function toDayjsLocale(locale) {
  if (!locale) return LOCALE_MAP[BLOG.lang.slice(0, 2)] || BLOG.lang.slice(0, 2)
  return LOCALE_MAP[locale] || locale
}

const LOCALE_LOADERS = {
  'zh-cn': () => import('dayjs/locale/zh-cn'),
  en: () => import('dayjs/locale/en'),
  tr: () => import('dayjs/locale/tr'),
  es: () => import('dayjs/locale/es'),
  ja: () => import('dayjs/locale/ja')
}

function loadDayjsLocale(dayjsLocale) {
  const loader = LOCALE_LOADERS[dayjsLocale]
  if (loader) return loader()
  return Promise.resolve()
}

export default function FormattedDate({ date }) {
  const { locale } = useRouter()
  const [formattedDate, setFormattedDate] = useState(null)

  useEffect(() => {
    const dayjsLocale = toDayjsLocale(locale)
    loadDayjsLocale(dayjsLocale)
      .then(() => {
        dayjs.locale(dayjsLocale)
        setFormattedDate(dayjs(date).format('ll'))
      })
      .catch(() => {
        setFormattedDate(dayjs(date).format('ll'))
      })
  }, [locale, date])

  if (!formattedDate) {
    return null
  }
  return <span>{formattedDate}</span>
}
