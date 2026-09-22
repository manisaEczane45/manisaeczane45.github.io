# manisaeczane45.github.io

Manisa eczaneleri için yemek cari bakiye takip sistemi. ID + şifre ile giriş yapılır; eczaneler kendi bakiyelerini ve tüm işlem geçmişini görür, admin panelinden bakiyeler güncellenir.

## Nasıl çalışıyor

- **Statik site** (GitHub Pages) + **Firebase** (Authentication + Firestore).
- Giriş: her eczaneye bir ID/şifre çifti verilir (`ecz01`, `ecz02`, ... ve `admin`). Bunlar arka planda Firebase Auth e-posta/şifre hesaplarıdır (`ecz01@manisaeczane45.local` gibi), kullanıcıya sadece ID gösterilir.
- Yetkilendirme gerçekten sunucu tarafında (Firestore güvenlik kuralları, `firestore.rules`) kontrol edilir — sadece admin custom claim'ine sahip kullanıcı bakiye yazabilir. Site kodu herkese açık olsa bile veriler korunur.
- Veri modeli (`pharmacies/{id}`):
  - `totalCari`: toplam tahakkuk eden cari (ileride dış API'den beslenecek, şimdilik admin panelden elle girilir).
  - `paidCari`: o eczaneye yapılan kesinti/ödemelerin toplamı.
  - Ekranda gösterilen **güncel cari** = `totalCari - paidCari`.
- Admin bir eczaneye "ödeme/kesinti" girdiğinde `paidCari` artar (veya düzeltme için azalır) ve bu işlem tarihiyle birlikte herkesin gördüğü işlem geçmişine not düşülür.

## Kurulum

### 1. Firebase projesi oluşturun

1. https://console.firebase.google.com adresinden yeni bir proje açın.
2. **Build > Authentication > Sign-in method**'dan **E-posta/Şifre** sağlayıcısını etkinleştirin.
3. **Build > Firestore Database**'i oluşturun (production mode).
4. **Project settings > General > Your apps**'ten bir **Web app** ekleyin, çıkan config nesnesini kopyalayın.

### 2. Site config'ini doldurun

[js/firebase-config.js](js/firebase-config.js) içindeki `firebaseConfig` alanlarını Firebase'den aldığınız değerlerle doldurun. Bu değerler gizli değildir, tarayıcıda görünmesi normaldir.

### 3. Güvenlik kurallarını yayınlayın

Firebase Console > Firestore Database > Rules kısmına [firestore.rules](firestore.rules) içeriğini yapıştırıp yayınlayın (veya Firebase CLI ile `firebase deploy --only firestore:rules`).

### 4. Eczane hesaplarını oluşturun (tek seferlik)

1. Firebase Console > Project settings > Service accounts > **Generate new private key** ile bir anahtar indirin, `scripts/serviceAccountKey.json` olarak kaydedin (bu dosya asla commit edilmemeli, `.gitignore`'da zaten hariç tutuluyor).
2. Terminalde:
   ```
   cd scripts
   npm install
   npm run seed
   ```
3. Script `scripts/seed.js` içindeki `PHARMACY_NAMES` listesindeki 19 eczane (`ecz01`..`ecz19`) + 1 admin (`admin`) hesabı oluşturur, rastgele şifreler üretir ve `scripts/credentials.txt` dosyasına yazar (bu dosya da commit edilmez).
4. Eczane listesi değişirse (yeni eczane eklenir/çıkarılırsa) `scripts/seed.js` içindeki `PHARMACY_NAMES` dizisini güncelleyip script'i tekrar çalıştırmanız yeterli; script mevcut kullanıcıları günceller, yenilerini oluşturur.
5. `scripts/credentials.txt` içindeki ID/şifreleri ilgili eczanelere güvenli bir kanaldan (elden, WhatsApp değil tercihen) iletin.

### 5. Yayınlayın

Bu klasörü `main` branch'inde GitHub Pages olarak yayınlamanız yeterli (repo zaten `*.github.io` adında, kök dizinden otomatik yayınlanır).

## Sınırlamalar / sonraki adımlar

- **Dış API entegrasyonu henüz yok.** `totalCari` şu an admin panelden elle girilir. API hazır olduğunda, günlük/periyodik olarak `pharmacies/{id}.totalCari` alanını güncelleyen küçük bir senkronizasyon adımı eklenecek (ör. GitHub Actions ile zamanlanmış bir script + Firebase Admin SDK).
- Şifre sıfırlama arayüzü yok; şifre değişikliği gerekirse Firebase Console'dan veya `seed.js` tekrar çalıştırılarak yapılabilir.
