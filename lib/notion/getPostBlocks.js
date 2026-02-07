import BLOG from '@/blog.config'
import { NotionAPI } from 'notion-client'
import { getPreviewImageMap } from './previewImages'

export async function getPostBlocks(id) {
  const authToken = BLOG.notionAccessToken || null
  const api = new NotionAPI({ authToken })

  try {
    // API çağrısı (ID'yi değiştirmeden, olduğu gibi gönderiyoruz)
    let pageBlock = await api.getPage(id)

    // --- 1. BOŞ/HATALI VERİ KONTROLÜ VE ONARIMI ---
    // Eğer pageBlock hiç yoksa oluştur
    if (!pageBlock) pageBlock = { block: {} };
    if (!pageBlock.block) pageBlock.block = {};

    const targetBlock = pageBlock.block[id];
    
    // Blok yoksa, içi boşsa veya type bilgisi eksikse ONAR
    const isBlockMissing = !targetBlock || !targetBlock.value;
    const isBlockCorrupted = targetBlock?.value && !targetBlock.value.type;

    if (isBlockMissing || isBlockCorrupted) {
      console.log(`[getPostBlocks] UYARI: ${id} ID'li sayfa verisi onarılıyor...`);
      
      pageBlock.block[id] = {
        role: 'reader',
        value: {
          id: id,
          type: 'collection_view_page', // Standart veritabanı sayfası tipi
          version: 1,
          format: {
            page_full_width: true
          },
          properties: {
            title: [['(Ana Sayfa Onarıldı)']]
          },
          content: [],
          created_time: Date.now(),
          last_edited_time: Date.now(),
          parent_table: 'space',
          alive: true
        }
      };
    }

    // --- 2. PREVIEW IMAGES ---
    if (BLOG.previewImagesEnabled) {
      try {
        const previewImageMap = await getPreviewImageMap(pageBlock)
        pageBlock.preview_images = previewImageMap
      } catch (err) {
        // Hata olursa null ata (undefined değil!)
        pageBlock.preview_images = null
      }
    } else {
        pageBlock.preview_images = null
    }

    // --- 3. SERIALIZATION HATASINI KÖKTEN ÇÖZME (TEMİZLİK) ---
    // Next.js 'undefined' sevmez. Bu işlem tüm undefined alanları siler.
    const cleanData = JSON.parse(JSON.stringify(pageBlock));
    
    return cleanData;

  } catch (err) {
    console.error(`[getPostBlocks] Kritik Hata (${id}):`, err)
    
    // Hata durumunda güvenli, temiz bir nesne dön
    const fallbackData = {
      block: {
        [id]: {
          value: {
            id: id,
            type: 'page',
            properties: { title: [['Hata Sonrası Kurtarma']] },
            content: [],
            created_time: Date.now(),
            version: 1
          }
        }
      },
      preview_images: null
    };
    
    return JSON.parse(JSON.stringify(fallbackData));
  }
}