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
    
    // Veritabanı şeması (Veri tiplerini anlamak için gerekli)
    const collection = Object.values(response.collection)[0]?.value
    const schema = collection?.schema
    const block = response.block

    // --- YENİ STRATEJİ: HAM VERİYİ TARAMA ---
    // collectionQuery (liste dizini) bozuk olduğu için onu kullanmıyoruz.
    // Doğrudan gelen tüm blokları tarayıp, hangilerinin veritabanı öğesi olduğunu buluyoruz.
    
    const data = []
    const blockKeys = Object.keys(block)

    for (const key of blockKeys) {
        const item = block[key].value

        // 1. ELEME: Bu bir veritabanı satırı mı?
        // Notion'da veritabanı içindeki sayfaların 'parent_table' değeri 'collection' olur.
        if (!item || item.parent_table !== 'collection' || item.type !== 'page') {
            continue; 
        }

        // 2. VERİ DÖNÜŞTÜRME (MAPPING)
        // Gelen yeni içeriği, eski sistemin beklediği formata çeviriyoruz.
        
        let properties = null;
        try {
            // Önce standart fonksiyonu dene
            properties = await getPageProperties(item.id, block, schema)
        } catch (e) {
            // Hata verirse sorun yok, manuel oluşturacağız.
        }

        // Eğer özellikler standart yolla alınamadıysa, HAM VERİDEN EL İLE OLUŞTUR
        if (!properties) {
            properties = {
                id: item.id,
                created_time: item.created_time
            }
        }

        // --- ZORUNLU ALANLARI DOLDUR (ESKİ FORMAT İÇİN) ---
        
        // Başlık (Title) Yoksa
        if (!properties.title) {
            // Notion farklı isimlerde tutabilir, hepsine bakıyoruz
            properties.title = item.properties?.title?.[0]?.[0] || 
                               item.properties?.Name?.[0]?.[0] || 
                               'Başlıksız Yazı';
        }

        // Slug (Link Uzantısı) Yoksa
        if (!properties.slug) {
            properties.slug = item.properties?.slug?.[0]?.[0] || 
                              item.properties?.Slug?.[0]?.[0] || 
                              item.id; // Slug yoksa ID kullan
        }

        // Tarih (Date) Yoksa
        if (!properties.date) {
            properties.date = { start_date: dayjs(item.created_time).format('YYYY-MM-DD') }
        }

        // Durum (Status) Yoksa -> Yayında Varsay
        if (!properties.status) {
            properties.status = ['Published']
        }

        // Tip (Type) Yoksa -> Post Varsay
        if (!properties.type) {
            properties.type = ['Post']
        }

        // Tam Genişlik Ayarı
        properties.fullWidth = item.format?.page_full_width ?? false;

        // Tarihi Timestamp formatına çevir (Sıralama için şart)
        if (typeof properties.date === 'object') {
             properties.date = dayjs(properties.date.start_date).valueOf()
        } else {
             properties.date = dayjs(properties.date).valueOf()
        }

        // Listeye ekle
        data.push(properties)
    }

    // --- GÜVENLİK ---
    // Eğer tarama sonucunda hiç yazı bulamazsak (ki bu imkansız olmalı),
    // Site çökmesin diye boş da olsa temiz bir dizi dönüyoruz.
    if (data.length === 0) {
        console.warn('[getAllPosts] Uyarı: Tarama sonucunda hiç yazı bulunamadı.')
    }

    // Filtreleme (Newsletter, Gizli vs.)
    const posts = filterPublishedPosts({
      posts: data,
      onlyNewsletter,
      onlyPost,
      onlyHidden
    })

    // Tarihe göre sırala
    if (BLOG.sortByDate) {
      posts.sort((a, b) => b.date - a.date)
    }
    
    // JSON Temizliği (Serialization hatasına son)
    return JSON.parse(JSON.stringify(posts));

  } catch (err) {
    console.error('[getAllPosts] Hata:', err)
    return []
  }
}