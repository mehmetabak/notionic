import BLOG from '@/blog.config'
import { NotionAPI } from 'notion-client'
import { getPreviewImageMap } from './previewImages'
import { idToUuid } from 'notion-utils' // ID formatını garantiye almak için bunu ekledik

export async function getPostBlocks(id) {
  const authToken = BLOG.notionAccessToken || null
  const api = new NotionAPI({ authToken })
  
  // ID'yi standart UUID formatına çeviriyoruz (Tireli format)
  const uuid = idToUuid(id)

  try {
    const pageBlock = await api.getPage(uuid)

    // 1. Ana Blok Nesnesi Kontrolü
    if (!pageBlock) {
        console.log(`[getPostBlocks] HATA: Sayfa nesnesi boş döndü. Yapay nesne oluşturuluyor.`);
        return {
            block: {
                [uuid]: {
                    value: { id: uuid, type: 'page', properties: { title: [['Kurtarılan Sayfa']] } }
                }
            }
        }
    }

    if (!pageBlock.block) {
        pageBlock.block = {};
    }

    // 2. Hedef Blok Kontrolü ve Onarımı
    const targetBlock = pageBlock.block[uuid]; // id yerine uuid kullanıyoruz
    
    // Blok yoksa veya içi boşsa veya type bilgisi eksikse
    const isBlockMissing = !targetBlock || !targetBlock.value;
    const isBlockCorrupted = targetBlock?.value && !targetBlock.value.type;

    if (isBlockMissing || isBlockCorrupted) {
      console.log(`[getPostBlocks] UYARI: ${uuid} ID'li veri bozuk. Onarılıyor...`);
      
      pageBlock.block[uuid] = {
        role: 'reader',
        value: {
          id: uuid,
          type: 'collection_view_page', // Genellikle ana sayfa budur
          version: 1,
          format: {
            page_full_width: true
          },
          properties: {
            title: [['(Veri Onarıldı)']]
          },
          content: [],
          created_time: Date.now(),
          last_edited_time: Date.now(),
          parent_table: 'space',
          alive: true
        }
      };
    }

    // 3. Preview Images - SERIALIZATION HATASI BURADA ÇÖZÜLÜYOR
    if (BLOG.previewImagesEnabled) {
      try {
        const previewImageMap = await getPreviewImageMap(pageBlock)
        // Eğer map undefined gelirse null'a çeviriyoruz. Next.js undefined sevmez.
        pageBlock.preview_images = previewImageMap || null 
      } catch (err) {
        pageBlock.preview_images = null
      }
    } else {
        // Eğer özellik kapalıysa da null atayalım garanti olsun
        pageBlock.preview_images = null
    }

    return pageBlock

  } catch (err) {
    console.error(`[getPostBlocks] Kritik Hata:`, err)
    // Güvenli dönüş
    return {
      block: {
        [uuid]: {
          value: {
            id: uuid,
            type: 'page',
            properties: { title: [['Kritik Hata']] },
            created_time: Date.now()
          }
        }
      },
      preview_images: null 
    }
  }
}