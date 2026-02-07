import BLOG from '@/blog.config'
import { NotionAPI } from 'notion-client'
import { getPreviewImageMap } from './previewImages'

export async function getPostBlocks(id) {
  const authToken = BLOG.notionAccessToken || null
  const api = new NotionAPI({ authToken })

  try {
    const pageBlock = await api.getPage(id)

    // --- GÜÇLENDİRİLMİŞ YAMA (V2) BAŞLANGIÇ ---
    // Sorun: Notion API bazen veriyi döndürüyor ama içi "undefined" veya eksik oluyor.
    // Eski kod sadece verinin varlığını kontrol ediyordu, niteliğini etmiyordu.
    // Şimdi type kontrolü de ekliyoruz.

    // 1. Block haritası hiç yoksa oluştur
    if (!pageBlock.block) {
      pageBlock.block = {};
    }

    // 2. Hedef bloğun durumu ne?
    const targetBlock = pageBlock.block[id];
    const isBlockMissing = !targetBlock || !targetBlock.value;
    // Yeni Kontrol: Blok var ama 'type' özelliği yoksa o blok bozuktur.
    const isBlockCorrupted = targetBlock?.value && !targetBlock.value.type;

    if (isBlockMissing || isBlockCorrupted) {
      console.log(`[getPostBlocks] UYARI: ${id} ID'li sayfa bozuk veya eksik (Type: ${targetBlock?.value?.type}). Onarılıyor...`);

      pageBlock.block[id] = {
        role: 'reader',
        value: {
          id: id,
          type: 'collection_view_page', // Ana sayfa olduğu için genellikle collection_view_page olmalı
          version: 1,
          format: {
            page_full_width: true
          },
          properties: {
            title: [['(Veritabanı Bağlantısı Onarıldı)']]
          },
          content: [], // Alt blok yok
          created_time: Date.now(),
          last_edited_time: Date.now(),
          parent_table: 'space',
          alive: true
        }
      };
    }
    // --- GÜÇLENDİRİLMİŞ YAMA (V2) BİTİŞ ---

    if (BLOG.previewImagesEnabled) {
      try {
        const previewImageMap = await getPreviewImageMap(pageBlock)
        pageBlock.preview_images = previewImageMap
      } catch (err) {
        // Preview image hatası önemsizdir, akışı bozmasın
        // console.error('Preview image hatası:', err)
      }
    }

    return pageBlock

  } catch (err) {
    console.error(`[getPostBlocks] Kritik API Hatası (${id}):`, err)
    // En kötü senaryoda boş bir yapı dön
    return {
      block: {
        [id]: {
          value: {
            id: id,
            type: 'page',
            properties: { title: [['Kritik Hata Sonrası Kurtarma']] },
            created_time: Date.now()
          }
        }
      }
    }
  }
}