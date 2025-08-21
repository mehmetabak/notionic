// pages/[slug].js

import Layout from '@/layouts/layout'
import { getAllPosts, getPostBlocks } from '@/lib/notion' // Notion fonksiyonların
import BLOG from '@/blog.config'
import { useRouter } from 'next/router'
import Loading from '@/components/Loading'
import NotFound from '@/components/NotFound'

const Post = ({ post, blockMap }) => {
  const router = useRouter()

  // fallback: true kullanıldığında, sayfa henüz oluşturulmamışsa bu
  // yüklenme ekranı gösterilir.
  if (router.isFallback) {
    return <Loading />
  }

  // getStaticProps'tan post: null dönerse veya sayfa bulunamazsa
  // 404 bileşeni gösterilir. Bu kısım zaten doğru.
  if (!post) {
    return <NotFound statusCode={404} />
  }

  return (
    <Layout blockMap={blockMap} frontMatter={post} fullWidth={post.fullWidth} />
  )
}

export async function getStaticPaths() {
  try {
    // SORUN 1 ÇÖZÜLDÜ: Notion API çağrısı try...catch bloğuna alındı.
    // Artık Notion'a ulaşılamazsa build çökmeyecek.
    const posts = await getAllPosts({ onlyNewsletter: false })

    // SORUN 2 ÇÖZÜLDÜ: paths dizisi Next.js'in beklediği doğru formata getirildi.
    const paths = posts.map((post) => ({
      params: { slug: post.slug }
    }))

    return {
      paths,
      fallback: true // 'true' veya 'blocking' kullanabilirsin. 'true' daha iyi.
    }
  } catch (error) {
    console.error('getStaticPaths içinde Notion verisi alınamadı:', error)
    // Hata durumunda, build anında hiçbir sayfa oluşturma.
    // Sayfalar, ilk ziyaret edildiklerinde oluşturulur (fallback: true sayesinde).
    return {
      paths: [],
      fallback: true
    }
  }
}

export async function getStaticProps({ params: { slug } }) {
  // SORUN 3 (PERFORMANS) İÇİN İYİLEŞTİRME: Tüm postları çekmek yerine
  // sadece ilgili olanı çekmek daha verimlidir.
  // Bunun için `lib/notion.js` içinde `getPostBySlug(slug)` gibi bir fonksiyon
  // oluşturman en iyisi olur. Şimdilik mevcut kodunu düzelterek ilerliyorum.
  const posts = await getAllPosts({ onlyNewsletter: false })
  const post = posts.find((t) => t.slug === slug)

  // SORUN 4 ÇÖZÜLDÜ: Post bulunamazsa, Notion'a hiç gitmeden 404 döndür.
  // Bu, 'post.id' hatasını engeller.
  if (!post) {
    return { notFound: true }
  }

  try {
    const blockMap = await getPostBlocks(post.id)
    return {
      props: {
        post,
        blockMap
      },
      revalidate: 10 // Sayfayı her 10 saniyede bir güncelle
    }
  } catch (err) {
    console.error('getStaticProps içinde Notion block verisi alınamadı:', err)
    // Hata durumunda null göndermek yerine, doğrudan 404 sayfasına yönlendirmek
    // en doğru yöntemdir.
    return { notFound: true }
  }
}

export default Post
