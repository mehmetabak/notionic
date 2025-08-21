// pages/s/[subpage].js

import BLOG from '@/blog.config'
import Layout from '@/layouts/layout'
import { getAllPosts, getPostBlocks } from '@/lib/notion'
import { useRouter } from 'next/router'

import { getAllPagesInSpace, getPageBreadcrumbs, idToUuid } from 'notion-utils'
import { defaultMapPageUrl } from 'react-notion-x'

import Loading from '@/components/Loading'
import NotFound from '@/components/NotFound'

const Post = ({ post, blockMap }) => {
  const router = useRouter()
  if (router.isFallback) {
    return <Loading notionSlug={router.asPath.split('/')[2]} />
  }
  if (!post) {
    return <NotFound statusCode={404} />
  }
  return (
    <Layout blockMap={blockMap} frontMatter={post} fullWidth={post.fullWidth} />
  )
}

export async function getStaticPaths() {
  try {
    // SORUN 1 ÇÖZÜLDÜ: Tüm Notion API çağrıları try...catch bloğuna alındı.
    const mapPageUrl = defaultMapPageUrl(BLOG.notionPageId)

    const pages = await getAllPagesInSpace(
      BLOG.notionPageId,
      BLOG.notionSpacesId,
      getPostBlocks,
      {
        traverseCollections: false
      }
    )

    const subpageIds = Object.keys(pages)
      .map((pageId) => mapPageUrl(pageId).replace('/', '')) // Baştaki '/' kaldırıldı
      .filter((path) => path);

    const posts = await getAllPosts({ onlyNewsletter: false })
    const postIds = posts.map((post) => mapPageUrl(post.id).replace('/', ''))

    // Zaten post olan sayfaları subpage listesinden çıkar
    const finalSubpageIds = subpageIds.filter(id => !postIds.includes(id));

    // SORUN 2 ÇÖZÜLDÜ: paths dizisi doğru formata getirildi.
    const paths = finalSubpageIds.map(id => ({
      params: { subpage: id }
    }))
    
    // Not: Buradaki filtreleme mantığı biraz karmaşık görünüyor.
    // İhtiyacına göre bu kısmı basitleştirebilirsin.
    // Amaç, post olmayan tüm 'subpage'lerin yolunu oluşturmak.

    return {
      paths,
      fallback: true
    }
  } catch (error) {
    console.error('getStaticPaths (subpage) içinde Notion verisi alınamadı:', error)
    return {
      paths: [], // Hata durumunda build anında sayfa oluşturma
      fallback: true
    }
  }
}

export async function getStaticProps({ params: { subpage } }) {
  try {
    const blockMap = await getPostBlocks(subpage)
    
    // SORUN 4 ÇÖZÜLDÜ: blockMap boşsa veya geçerli değilse 404 döndür.
    if (!blockMap || !Object.keys(blockMap.block).length) {
      console.warn(`[subpage] için blockMap bulunamadı: ${subpage}`);
      return { notFound: true }
    }

    // Allow only pages in your own space
    const NOTION_SPACES_ID = BLOG.notionSpacesId
    const isPageAllowed = Object.values(blockMap.block).some(block => 
      block?.value?.space_id && NOTION_SPACES_ID.includes(block.value.space_id)
    );

    if (!isPageAllowed) {
      console.warn(`[subpage] izin verilen space'te değil: ${subpage}`);
      return { notFound: true }
    }
    
    const posts = await getAllPosts({ onlyNewsletter: false })
    const id = idToUuid(subpage)
    const breadcrumbs = getPageBreadcrumbs(blockMap, id)

    let post
    // breadcrumbs varsa ve ilk elemanı geçerliyse post'u bul
    if (breadcrumbs && breadcrumbs[0] && breadcrumbs[0].block) {
      post = posts.find((t) => t.id === breadcrumbs[0].block.id)
    }

    // Eğer post veritabanında bulunamazsa, manuel olarak oluştur
    if (!post) {
      post = {
        type: ['Page'],
        // breadcrumbs[0] yoksa başlık olarak 'Untitled' kullan
        title: breadcrumbs?.[0]?.title || 'Untitled',
        id: subpage // id'yi de ekleyelim
      }
    }

    return {
      props: { post, blockMap },
      revalidate: 10
    }

  } catch (err) {
    console.error(`getStaticProps (subpage) hatası: ${subpage}`, err)
    // SORUN 3 ÇÖZÜLDÜ: Hata durumunda 404 döndür.
    return { notFound: true }
  }
}

export default Post