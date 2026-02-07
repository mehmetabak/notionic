import BLOG from '@/blog.config'
import { NotionAPI } from 'notion-client'
import { idToUuid } from 'notion-utils'
import dayjs from '@/lib/day'
import getAllPageIds from './getAllPageIds'
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
    console.log(`--- [DEBUG] API Çağrısı Başladı: ${id} ---`);
    const response = await api.getPage(id)
    
    const collection = Object.values(response.collection)[0]?.value
    const block = response.block
    
    // --- 1. HAM VERİ ANALİZİ ---
    const blockKeys = Object.keys(block);
    console.log(`--- [DEBUG] Toplam Blok Sayısı: ${blockKeys.length} ---`);
    
    // İlk 2 bloğun yapısını görelim (Veri formatını anlamak için)
    if (blockKeys.length > 0) {
        const firstKey = blockKeys[0];
        console.log(`--- [DEBUG] ÖRNEK VERİ 1 (${firstKey}) ---`);
        console.log(JSON.stringify(block[firstKey].value, null, 2)); // Gelen veriyi olduğu gibi basar
    }
    
    // --- 2. TARAMA ---
    const data = []
    let skipLogCount = 0;

    for (const key of blockKeys) {
        const item = block[key].value

        if (!item) continue;

        // Veritabanı satırı olup olmadığını kontrol et
        // Buradaki loglar neden veri bulamadığımızı gösterecek
        if (item.parent_table !== 'collection') {
            if (skipLogCount < 3) { // Log kirliliği olmasın diye sadece ilk 3 hatayı bas
                console.log(`[DEBUG] Atlandı (Collection değil): ${item.id} -> Parent: ${item.parent_table}, Type: ${item.type}`);
                skipLogCount++;
            }
            continue; 
        }

        // Eğer buraya gelirse, bu bir veritabanı satırıdır!
        console.log(`--- [DEBUG] ADAY BULUNDU: ${item.id} ---`);

        let properties = null;
        try {
            properties = await getPageProperties(item.id, block, collection.schema)
        } catch (e) {
            console.log(`[DEBUG] getPageProperties Hata: ${e.message}`);
        }

        // Manuel Özellik Çıkarma (Fallback)
        if (!properties) {
            console.log(`[DEBUG] Manuel özellik çıkarılıyor...`);
            properties = {
                id: item.id,
                created_time: item.created_time
            }
        }

        // Özellikleri doldur
        properties.title = properties.title || item.properties?.title?.[0]?.[0] || 'Başlıksız';
        properties.slug = properties.slug || item.properties?.slug?.[0]?.[0] || item.id;
        
        // Tarih formatlama
        const dateRaw = item.created_time || Date.now();
        properties.date = { start_date: dayjs(dateRaw).format('YYYY-MM-DD') };
        properties.dateTimestamp = dayjs(dateRaw).valueOf(); // Sıralama için

        properties.status = ['Published'];
        properties.type = ['Post'];
        properties.fullWidth = item.format?.page_full_width ?? false;

        data.push(properties);
    }

    console.log(`--- [DEBUG] Toplanan Ham Veri Sayısı: ${data.length} ---`);

    // --- 3. FİLTRELEME VE DÖNÜŞ ---
    // Eğer veri bulamazsak, site çökmesin diye sahte veri ekle (DEBUG İÇİN)
    if (data.length === 0) {
        console.log(`--- [DEBUG] HİÇ VERİ YOK - SAHTE VERİ OLUŞTURULUYOR ---`);
        data.push({
            id: 'debug-post',
            title: 'DEBUG: Veri Bulunamadı',
            slug: 'debug',
            summary: 'Lütfen Vercel loglarını kontrol edin.',
            date: dayjs().valueOf(),
            status: ['Published'],
            type: ['Post'],
            fullWidth: false
        });
    }

    // Tarihe göre timestamp'i düzelt ve sırala
    const posts = data.map(post => {
        if (post.dateTimestamp) {
            post.date = post.dateTimestamp;
            delete post.dateTimestamp;
        } else {
             post.date = dayjs().valueOf();
        }
        return post;
    });

    return JSON.parse(JSON.stringify(posts));

  } catch (err) {
    console.error('[getAllPosts] KRİTİK HATA:', err);
    // Site çökmesin, hatayı görelim
    return [{
        id: 'error-post',
        title: 'API Hatası',
        slug: 'error',
        date: Date.now(),
        status: ['Published'],
        type: ['Post'],
        summary: err.message
    }];
  }
}