# Kişisel konum paneli

Bu özellik yalnızca kendi iPhone konumunu kişisel web panelinde görmek içindir. İlk sürüm yalnızca uygulama ekrandayken konum gönderir; arka plan takibi yapmaz. Yalnızca son konum saklanır, rota geçmişi tutulmaz.

## 1. Sunucu erişim anahtarını oluştur

Windows PowerShell'de güçlü bir anahtar üret:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Çıktıyı kimseyle paylaşma. Supabase Dashboard > Ders Notları projesi > Edge Functions > Secrets bölümünde şu sırrı oluştur:

- Name: `LOCATION_ACCESS_TOKEN`
- Value: PowerShell'in ürettiği değer

Bu değer, uygulamadaki ve paneldeki erişim anahtarı alanına da girilecek. Anahtarı GitHub'a veya sohbete koyma.

## 2. Android uygulamasını derle

Proje kökünde:

```powershell
npm install
npx expo install expo-location
npx expo-doctor
```

Ardından EAS ile yeni Android derlemesi al. Uygulamayı açıp Ayarlar > Kendi konumum alanına aynı anahtarı gir, kaydet ve konum paylaşımını başlat. iOS/Android izin penceresini kabul et.

## 3. Web sayfalarını yayınla

`location-panel/index.html` harita panelidir; `location-panel/share.html` ise telefondan konum gönderen sayfadır. İkisini de Vercel gibi statik site barındırmasına yükle veya GitHub Pages üzerinden yayınla. HTTPS zorunludur. iPhone'da share sayfasını açıp aynı anahtarı gir ve Paylaşımı başlat'a bas; harita panelinde aynı anahtarla Bağlan'a bas. Tarayıcı sayfası açık kaldığı sürece konum güncellemeleri gönderilir.

## Veri ve güvenlik

- Supabase tablosunda yalnızca son konum tutulur.
- Tabloya doğrudan anon/authenticated erişimi kapalıdır; Edge Function doğrulama anahtarı ile erişir.
- Supabase publishable/anon anahtarı gizli değildir; asıl erişim kontrolü `LOCATION_ACCESS_TOKEN` ile yapılır.
- Erişim anahtarını kaybedersen veya sızdığını düşünürsen Supabase secret'ını değiştirip hem uygulama hem panelde yenisini kullan.
- Ücretsiz kotalar sağlayıcı koşullarına bağlıdır. Bu özellik ücretli bir harita servisine otomatik geçmez.
