import BLOG from '@/blog.config'
import { NotionAPI } from 'notion-client'
import { idToUuid } from 'notion-utils'

export async function getAllPosts({
  onlyNewsletter = false,
  onlyPost = false,
  onlyHidden = false
}) {
  let id = BLOG.notionPageId
  const authToken = BLOG.notionAccessToken || null
  const api = new NotionAPI({ authToken })
  
  console.log('\n\n=================================================');
  console.log('🔥🔥🔥 DEBUG MODU BAŞLATILDI: NOTION VERİLERİ 🔥🔥🔥');
  console.log('=================================================\n');

  try {
    const response = await api.getPage(id)
    const block = response.block
    const collection = response.collection
    const collectionQuery = response.collection_query

    // 1. GENEL DURUM
    console.log(`✅ ID: ${id}`);
    console.log(`✅ Toplam Blok Sayısı: ${Object.keys(block).length}`);
    console.log(`✅ Collection (Veritabanı Şeması) Var mı?: ${!!collection}`);
    
    if (collection) {
        const colId = Object.keys(collection)[0];
        console.log(`🔍 Collection ID: ${colId}`);
        // Şemayı yazdır (Sütun isimlerini görmek için kritik)
        console.log(`🔍 SCHEMA (Sütun İsimleri):\n`, JSON.stringify(collection[colId].value.schema, null, 2));
    }

    // 2. İÇERİK TARAMASI (İLK 3 DOLU SATIR)
    console.log('\n--- 🕵️‍♂️ İÇERİK ÖRNEKLERİ (RAW BLOCK DATA) ---');
    
    let foundSamples = 0;
    const blockKeys = Object.keys(block);

    for (const key of blockKeys) {
        const item = block[key].value;
        
        // Sadece işe yarar verileri göster (Ana sayfa olmayan, collection içindeki sayfalar)
        if (!item) continue;
        if (item.type === 'page' && item.parent_table === 'collection') {
            console.log(`\n📄 BULUNAN SATIR ID: ${item.id}`);
            console.log(`   Type: ${item.type}`);
            console.log(`   Parent Table: ${item.parent_table}`);
            console.log(`   PROPERTIES (Önemli Kısım):`);
            console.log(JSON.stringify(item.properties, null, 2));
            
            foundSamples++;
            if (foundSamples >= 3) break; // 3 örnek yeterli
        }
    }

    if (foundSamples === 0) {
        console.log('❌ HİÇBİR "Collection Row" (Veritabanı Satırı) BULUNAMADI!');
        console.log('   Muhtemelen parent_table "collection" değil. Rastgele bir page örneği yazdırılıyor:');
        
        // Veritabanı satırı bulamadıysa, rastgele bir page yazdır
        for (const key of blockKeys) {
            const item = block[key].value;
            if (item && item.type === 'page' && item.id !== idToUuid(id)) {
                console.log(`\n📄 RASTGELE PAGE ID: ${item.id}`);
                console.log(JSON.stringify(item, null, 2));
                break;
            }
        }
    }

    console.log('\n=================================================');
    console.log('🏁 DEBUG MODU BİTTİ');
    console.log('=================================================\n\n');

  } catch (err) {
    console.error('💥 API HATASI:', err);
  }

  // SİTE ÇÖKMESİN DİYE DUMMY VERİ DÖNÜYORUZ
  // Bu sayede build tamamlanır ve logları okuyabiliriz.
  return JSON.parse(JSON.stringify([{
      id: '12345678-1234-1234-1234-123456789012', // Geçerli UUID formatı
      title: 'DEBUG VERİLERİ LOGLANIYOR...',
      slug: 'debug-mode',
      summary: 'Lütfen Vercel konsoluna gidip logları kontrol edin. Veri yapısını orada göreceğiz.',
      status: ['Published'],
      type: ['Post'],
      date: Date.now(),
      fullWidth: false
  }]));
}