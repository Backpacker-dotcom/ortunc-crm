# Ortunç CRM

Ortunç Otel için müşteri ilişkileri yönetimi: acenteler ve firmalar, misafirler, grup ve etkinlik talepleri, düğün teklifleri, görevler, takvim ve raporlar. Aynı uygulama hem tarayıcıda hem Android'de (APK) çalışır.

- `index.html` uygulamanın kendisidir (tek dosya). `src/` altındaki kaynaklardan `npm run build` ile üretilir.
- `firestore.rules` rol bazlı güvenlik kurallarıdır; Firebase konsolunda yayınlanır.
- `.github/workflows/android.yml` her `index.html` değişikliğinde APK'yı derleyip Releases'e koyar. Kurulu uygulama, depodaki yeni `index.html`'i kendisi indirir; APK'yı yeniden kurmak gerekmez.

## Firebase kurulumu (bir kez)

1. console.firebase.google.com → **Proje ekle** (ör. `ortunc-crm`). Analytics gerekmez.
2. **Authentication** → Get started → Sign-in method → **Email/Password** → Enable.
3. **Firestore Database** → Create database → konum `eur3 (europe-west)` → **Production mode**.
4. Firestore → **Rules** sekmesine `firestore.rules` içeriğini yapıştır → **Publish**.
5. ⚙ Proje ayarları → Genel → **Web uygulaması ekle** (`</>`) → çıkan `firebaseConfig` bloğunu kopyala.
6. Bu bloğu `firebase-config.json` olarak depoya koyup `npm run build` çalıştırın (uygulamaya gömülür) ya da uygulamadaki "Ekip bulutuna bağlan" ekranına yapıştırın.
7. Uygulamayı açın → **Yönetici hesabını oluştur**. Diğer kullanıcıları Ayarlar › Kullanıcılar'dan ekleyin.

## Roller

| Rol | Yetki |
|---|---|
| Yönetici | Her şey; kullanıcılar, ayarlar, kayıt silme |
| Satış | Acente, misafir, talep, düğün, aktivite, görev ekler/düzenler |
| Ön büro | Misafir, görev ve aktivite ekler/düzenler; diğerlerini görür |
| İzleyici | Yalnızca görür |

Yetkiler yalnızca ekranda değil, sunucuda `firestore.rules` ile de denetlenir.
