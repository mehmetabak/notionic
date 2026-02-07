import BLOG from '@/blog.config'
import { NotionAPI } from 'notion-client'
import { getPreviewImageMap } from './previewImages'

export async function getPostBlocks(id) {
  const authToken = BLOG.notionAccessToken || null
  const api = new NotionAPI({ authToken })
  
  try {
    const pageBlock = await api.getPage(id)

    // --- KRİTİK YAMA (FIX) BAŞLANGIÇ ---
    // Sorun: Notion API bazen block verisini undefined döndürüyor.
    // Çözüm: Eğer ana blok yoksa, kod patlamasın diye yapay bir blok enjekte ediyoruz.
    if (!pageBlock.block || !pageBlock.block[id] || !pageBlock.block[id].value) {
      console.log(`[getPostBlocks] UYARI: ${id} ID'li sayfa için veri bulunamadı. Yapay veri oluşturuluyor...`);
      
      // Eğer block objesi hiç yoksa oluştur
      if (!pageBlock.block) pageBlock.block = {};

      // Boş/Hatalı bloğu doldur
      pageBlock.block[id] = {
        role: 'reader',
        value: {
          id: id,
          type: 'page',
          properties: {
            title: [['⚠️ İçerik Yüklenemedi (API Hatası)']]
          },
          content: [], // Boş içerik
          version: 1,
          format: {
            page_full_width: true
          },
          created_time: Date.now(),
          last_edited_time: Date.now()
        }
      };
    }
    // --- KRİTİK YAMA BİTİŞ ---

    if (BLOG.previewImagesEnabled) {
      // Hata ihtimaline karşı try-catch içine alıyoruz
      try {
        const previewImageMap = await getPreviewImageMap(pageBlock)
        pageBlock.preview_images = previewImageMap
      } catch (err) {
        console.error('Preview image hatası (önemsiz):', err)
      }
    }
    
    return pageBlock

  } catch (err) {
    console.error(`[getPostBlocks] Kritik Hata: ${id} sayfası çekilemedi.`, err)
    // Hata durumunda null dönmek yerine boş bir yapı dönelim ki site çökmesin
    return {
      block: {
        [id]: {
          value: { id: id, type: 'page', properties: { title: [['Hata']] } }
        }
      }
    }
  }
}