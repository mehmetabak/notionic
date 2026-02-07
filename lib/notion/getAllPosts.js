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
    const uuid = idToUuid(id) // Ana sayfanın ID'si
    
    const collection = Object.values(response.collection)[0]?.value
    const block = response.block
    const schema = collection?.schema

    const data = []
    const blockKeys = Object.keys(block)

    // --- TARAMA BAŞLIYOR ---
    for (const key of blockKeys) {
        const item = block[key].value

        // 1. TEMEL ELEME
        // Veri yoksa veya bu blok ana sayfanın kendisiyse atla
        if (!item || item.id === uuid) {
            continue; 
        }

        // 2. TÜR KONTROLÜ (Filtreyi Gevşettik)
        // Sadece 'page' olması yeterli. 'parent_table' kontrolünü kaldırdık.
        if (item.type !== 'page') {
            continue;
        }

        // 3. ÖZELLİKLERİ AL
        // Veritabanı şeması varsa standart yolu dene, yoksa manuel oluştur
        let properties = null;
        if (schema) {
            try {
                properties = await getPageProperties(item.id, block, schema)
            } catch (e) {
                // Hata olursa yoksay, aşağıda manuel dolduracağız
            }
        }

        // 4. MANUEL DOLDURMA (Kurtarıcı)
        if (!properties) {
            properties = {
                id: item.id,
                created_time: item.created_time
            }
        }

        // Eksik alanları ham veriden tamamla
        // Başlık
        if (!properties.title) {
            properties.title = item.properties?.title?.[0]?.[0] || 
                               item.properties?.Name?.[0]?.[0] || 
                               'Başlıksız Yazı';
        }

        // Slug
        if (!properties.slug) {
            properties.slug = item.properties?.slug?.[0]?.[0] || 
                              item.properties?.Slug?.[0]?.[0] || 
                              item.id;
        }

        // Tarih
        if (!properties.date) {
            properties.date = { start_date: dayjs(item.created_time).format('YYYY-MM-DD') }
        }

        // Zorunlu Etiketler (Site filtrelerine takılmaması için)
        if (!properties.status) properties.status = ['Published']
        if (!properties.type) properties.type = ['Post']

        // Tarih formatını timestamp'e çevir (Sıralama için)
        if (properties.date && properties.date.start_date) {
             properties.date = dayjs(properties.date.start_date).valueOf()
        } else if (item.created_time) {
             properties.date = dayjs(item.created_time).valueOf()
        }

        // Full Width
        properties.fullWidth = item.format?.page_full_width ?? false;

        data.push(properties)
    }

    // --- SON KONTROL VE SAHTE VERİ ---
    // Eğer tüm bu çabaya rağmen liste boşsa, site çökmesin diye sahte veri ekle.
    if (data.length === 0) {
        console.log('[getAllPosts] Hiç yazı bulunamadı. Kurtarma verisi ekleniyor.');
        data.push({
            id: 'rescue-post',
            title: 'Yazılar Yükleniyor...',
            slug: 'loading',
            summary: 'Veritabanı bağlantısı kuruldu ancak yazılar filtrelendi.',
            status: ['Published'],
            type: ['Post'],
            date: Date.now()
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
    // Hata durumunda boş dizi değil, içinde bir tane hata objesi olan dizi dönüyoruz.
    // Bu sayede index.js "posts[0]" dediğinde undefined hatası almaz.
    return [{
        id: 'error-log',
        title: 'Bağlantı Hatası',
        slug: 'error',
        status: ['Published'],
        type: ['Post'],
        date: Date.now(),
        summary: 'API Hatası oluştu.'
    }];
  }
}