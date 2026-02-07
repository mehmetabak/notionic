import BLOG from '@/blog.config'
import { NotionAPI } from 'notion-client'
import { idToUuid } from 'notion-utils'
import dayjs from '@/lib/day'
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
    const mainId = idToUuid(id) // Ana sayfa ID'si
    const block = response.block
    
    const data = []
    const blockKeys = Object.keys(block)

    // --- KABA KUVVET (BRUTE FORCE) TARAMASI ---
    // Hiçbir veritabanı kuralına uymuyoruz.
    // Tek kural: "İçinde başlık (title) verisi var mı?"
    
    for (const key of blockKeys) {
        const item = block[key]?.value

        // 1. Veri çöp mü? Ana sayfa mı? Atla.
        if (!item) continue;
        if (item.id === mainId) continue;

        // 2. KRİTİK KONTROL: properties (özellikler) var mı?
        // Notion'da yazı olmayan blokların (paragraf, resim vs.) genellikle 'properties' alanı boştur veya farklıdır.
        // Veritabanı satırlarının ise mutlaka 'properties' alanı olur.
        if (!item.properties) continue;

        // 3. BAŞLIK KONTROLÜ
        // Title, Name veya Page adında bir özellik var mı?
        // Bu satır, verinin bir "Yazı" olduğunu %100 kanıtlar.
        const titleRaw = item.properties.title || item.properties.Name || item.properties.Page;
        
        if (!titleRaw) continue; // Başlığı yoksa yazı değildir, geç.

        // --- YAZI BULUNDU! ---
        // Artık veriyi eski formata uydurarak çekip alıyoruz.
        
        const title = titleRaw[0]?.[0] || 'Adsız Yazı';
        const slugRaw = item.properties.slug || item.properties.Slug;
        const slug = slugRaw ? slugRaw[0]?.[0] : item.id;
        
        // Tarih bulma (Created time veya Date property)
        let dateVal = item.created_time;
        if (item.properties.date || item.properties.Date) {
            try {
                const d = (item.properties.date || item.properties.Date)[0][1][0][1].start_date;
                dateVal = d;
            } catch(e) { /* Tarih okunamazsa created_time kullanılır */ }
        }

        // Etiketler (Tags)
        const tags = [];
        const tagsRaw = item.properties.tags || item.properties.Tags;
        if (tagsRaw) {
            tagsRaw[0][0].split(',').forEach(t => tags.push(t.trim()));
        }

        // Status (Durum)
        const statusRaw = item.properties.status || item.properties.Status;
        const status = statusRaw ? [statusRaw[0][0]] : ['Published']; // Varsayılan: Yayında

        // Type (Tür)
        const typeRaw = item.properties.type || item.properties.Type;
        const type = typeRaw ? [typeRaw[0][0]] : ['Post']; // Varsayılan: Post

        // Oluşturulan Temiz Veri
        const properties = {
            id: item.id,
            title: title,
            slug: slug,
            date: dayjs(dateVal).valueOf(), // Timestamp formatı şart
            status: status,
            type: type,
            tags: tags,
            fullWidth: item.format?.page_full_width ?? false,
            page_cover: item.format?.page_cover || '',
            page_icon: item.format?.page_icon || ''
        };

        data.push(properties);
    }

    // --- SON GÜVENLİK ---
    // Eğer tüm bu çabaya rağmen (ki imkansız) yazı bulunamazsa, 
    // site build alsın diye sahte bir yazı ekle.
    if (data.length === 0) {
        console.warn('[getAllPosts] Hiçbir yazı deseni eşleşmedi. Acil durum verisi ekleniyor.');
        data.push({
            id: 'emergency-post',
            title: 'Sistem Hazırlanıyor',
            slug: 'welcome',
            summary: 'Veriler şu an işleniyor, lütfen bekleyiniz.',
            date: Date.now(),
            status: ['Published'],
            type: ['Post'],
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
    
    // JSON Temizliği (Serialization hatası olmasın)
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