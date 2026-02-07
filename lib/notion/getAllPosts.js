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
    
    // Veri kaynakları
    const collection = Object.values(response.collection)[0]?.value
    const block = response.block
    const schema = collection?.schema

    const data = []
    const blockKeys = Object.keys(block)

    // --- YENİ YÖNTEM: DOĞRUDAN BLOK TARAMA ---
    // collectionQuery'ye güvenmiyoruz. Doğrudan blokları geziyoruz.
    
    for (const key of blockKeys) {
        const item = block[key].value

        // 1. ELEME: Boş mu? Ana sayfanın kendisi mi?
        if (!item || item.id === uuid) continue;

        // 2. TÜR KONTROLÜ: Sadece sayfaları al (Collection view değil, Page olmalı)
        if (item.type !== 'page') continue;

        // 3. EBEVEYN KONTROLÜ: Sadece bu veritabanına ait olanları al
        // (Eğer başka bir veritabanından linklenmişse parent_id farklı olabilir, 
        // ama genellikle collection_id veya parent_id kontrolü yeterlidir.)
        if (item.parent_id !== collection?.id && item.parent_id !== uuid) {
            // Bazı durumlarda parent_id collection ID'si olur.
            // Eğer emin olamıyorsak yine de alalım, filtrede elenir.
        }

        // 4. VERİ ÇEKME VE DÖNÜŞTÜRME
        let properties = null;
        
        // Şema varsa standart yolu dene
        if (schema) {
            try {
                properties = await getPageProperties(item.id, block, schema)
            } catch (e) {
                // Hata verirse sessizce devam et, manuel oluşturacağız
            }
        }

        // Standart yol çalışmadıysa MANUEL OLUŞTUR (Kurtarıcı)
        if (!properties) {
            properties = {
                id: item.id,
                created_time: item.created_time
            }
        }

        // --- EKSİK ALANLARI DOLDUR ---
        
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

    // --- SON ÇARE: DUMMY DATA ---
    // Eğer tarama sonucunda hiç yazı bulamazsak, site çökmesin diye tek bir sahte yazı ekle.
    if (data.length === 0) {
        console.warn('[getAllPosts] UYARI: Hiçbir yazı bulunamadı. Site çökmemesi için geçici veri ekleniyor.');
        data.push({
            id: 'rescue-post',
            title: 'Sistem Beklemede',
            slug: 'welcome',
            summary: 'Veritabanı bağlantısı başarılı ancak yazılar henüz yüklenmedi veya filtrelendi.',
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
    
    // JSON Temizliği (Serialization hatasına son)
    return JSON.parse(JSON.stringify(posts));

  } catch (err) {
    console.error('[getAllPosts] Kritik Hata:', err)
    // Hata durumunda güvenli dönüş
    return [{
        id: 'error-log',
        title: 'Veri Hatası',
        slug: 'error',
        status: ['Published'],
        type: ['Post'],
        date: Date.now(),
        summary: 'Veriler çekilemedi.'
    }];
  }
}