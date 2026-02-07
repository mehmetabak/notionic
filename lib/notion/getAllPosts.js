import BLOG from '@/blog.config'
import { NotionAPI } from 'notion-client'
import { idToUuid } from 'notion-utils'
import dayjs from '@/lib/day'
import getPageProperties from './getPageProperties'
import filterPublishedPosts from './filterPublishedPosts'

export async function getAllPosts({
  onlyNewsletter = false,
  onlyPost = false,
  onlyHidden = false
}) {
  let id = BLOG.notionPageId
  const authToken = BLOG.notionAccessToken || null
  const api = new NotionAPI({ authToken })
  
  try {
    const response = await api.getPage(id)
    id = idToUuid(id)
    
    // Veri kaynaklarını hazırla
    const collection = Object.values(response.collection)[0]?.value
    const collectionQuery = response.collection_query
    const block = response.block
    const schema = collection?.schema

    // Ana sayfa bloğu (View ID'leri almak için)
    const rawMetadata = block[id]?.value

    const data = []
    let pageIds = []

    // --- ADIM 1: YAZI ID'LERİNİ BULMA ---
    try {
        // En sağlam yöntem: Veritabanı görünümünden (View) ID listesini al
        if (rawMetadata?.view_ids && collectionQuery && collection?.id) {
            const viewId = rawMetadata.view_ids[0]
            const collectionData = collectionQuery[collection.id]?.[viewId]
            
            // ID listesi burada saklanır
            if (collectionData?.collection_group_results?.blockIds) {
                pageIds = collectionData.collection_group_results.blockIds
            }
        }
    } catch (e) {
        console.warn('ID listesi alınamadı, manuel tarama denenecek.')
    }

    // Eğer View üzerinden alamazsak, blok anahtarlarından topla (Yedek Plan)
    if (pageIds.length === 0) {
        pageIds = Object.keys(block).filter(key => {
            const item = block[key]?.value
            return item && item.type === 'page' && item.parent_id === collection?.id
        })
    }

    // --- ADIM 2: İÇERİKLERİ ÇEKME ---
    for (let i = 0; i < pageIds.length; i++) {
      const pageId = pageIds[i]
      const item = block[pageId]?.value

      if (!item) continue;

      // Özellikleri Çek
      let properties = null;
      try {
          properties = await getPageProperties(pageId, block, schema)
      } catch (err) {
          // Hata varsa manuel devam et
      }

      // Manuel Doldurma (Eğer getPageProperties başarısızsa)
      if (!properties) {
          properties = {
              id: pageId,
              created_time: item.created_time
          }
      }

      // Eksikleri tamamla
      if (!properties.title) {
          properties.title = item.properties?.title?.[0]?.[0] || 
                             item.properties?.Name?.[0]?.[0] || 
                             'İsimsiz Yazı';
      }

      if (!properties.slug) {
          properties.slug = item.properties?.slug?.[0]?.[0] || item.id;
      }

      if (!properties.date) {
          properties.date = { start_date: dayjs(item.created_time).format('YYYY-MM-DD') }
      }

      // Varsayılan değerler
      if (!properties.status) properties.status = ['Published']
      if (!properties.type) properties.type = ['Post']

      // Tarih formatlama
      if (properties.date && properties.date.start_date) {
           properties.date = dayjs(properties.date.start_date).valueOf()
      } else {
           properties.date = dayjs(item.created_time).valueOf()
      }

      properties.fullWidth = item.format?.page_full_width ?? false;

      data.push(properties)
    }

    // --- SON ÇARE (DUMMY DATA - FIXED) ---
    // Eğer hiç veri yoksa, site çökmesin diye geçerli UUID ile sahte veri ekle.
    if (data.length === 0) {
        console.warn('[getAllPosts] Hiçbir yazı bulunamadı. Dummy veri ekleniyor.');
        data.push({
            id: '12345678-1234-1234-1234-123456789012', // GEÇERLİ UUID FORMATI ŞART!
            title: 'Sistem Beklemede',
            slug: 'system-waiting',
            summary: 'Veritabanı bağlantısı kuruldu, yazılar yükleniyor.',
            status: ['Published'],
            type: ['Post'],
            date: Date.now(),
            fullWidth: false
        });
    }

    // Filtreleme
    const posts = filterPublishedPosts({
      posts: data,
      onlyNewsletter,
      onlyPost,
      onlyHidden
    })

    // Sıralama
    if (BLOG.sortByDate) {
      posts.sort((a, b) => b.date - a.date)
    }
    
    return JSON.parse(JSON.stringify(posts));

  } catch (err) {
    console.error('[getAllPosts] Kritik Hata:', err)
    // Hata durumunda geçerli UUID ile dön
    return [{
        id: '12345678-1234-1234-1234-123456789012',
        title: 'Veri Hatası',
        slug: 'error',
        status: ['Published'],
        type: ['Post'],
        date: Date.now(),
        summary: 'Veriler çekilemedi.'
    }];
  }
}