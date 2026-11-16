# Gece raporlarını işleme (her sabah)

Ortunç Otel ve Elia Otel gece raporlarını Gmail'den alır, `nightly.py` ile okur ve
"Ortunç CRM – Otel Performans Verisi" Google tablosuna yazar. CRM bu tabloyu okur.

- Tablo: `1wf3b2M1RbXecudloOj6eS7gkjAWHIz_-tw9noFOi2nE`
  - `gunluk`: otel + iş günü başına bir satır
  - `otb`: ileri tarihli kesin rezervasyonlar
  - `islenen`: işlenmiş e-postalar
- Kod: bu klasördeki `nightly.py` (PDF → satırlar) ve `sheet_merge.py` (mevcut tabloyla birleştirme).

## Adımlar

1. **Hazırlık**
   - `git clone --depth 1 https://github.com/Backpacker-dotcom/ortunc-crm.git /tmp/crm`
   - `pdftotext` yoksa: `apt-get install -y poppler-utils` ya da `pip install pdfminer.six` (son çare).
2. **İşlenmişleri oku.** `islenen!A2:A` sütununu oku; buradaki messageId'ler atlanır.
3. **E-postaları bul.**
   - Gmail sorgusu: `has:attachment newer_than:4d (subject:"Night Reports" OR subject:"GECE RAPORLARI" OR subject:CRMGECMIS OR subject:"CRM GECMIS")`
   - Geçmiş yükleme için `newer_than` olmadan `subject:CRMGECMIS` ile de ara.
   - Her e-postayı `get_thread` ile aç; zaten işlenmiş messageId'leri atla.
4. **Ekleri indir.** Her e-postadan YALNIZCA şu PDF ekleri indirilir; misafir listeleri (Konaklayan, Müşteri Listesi, Beklenen Giriş/Çıkış) indirilmez:
   - Ortunç: adında "Yönetim Raporu Net", "Yönetim Raporu Brüt", "Günlük Gelir" ve "Forecast" geçenler (ör. "2026 Yönetim Raporu Net.PDF", "2026 Yönetim Raporu Brüt.PDF", "Günlük Gelir.PDF", "Aylık Forecast.PDF"). "Günlük Gelir" kahvaltı (Pension Breakfast) tutarı için, "Brüt" vergiler dahil tutarlar için gerekli. Ayrıca adında "Yıllık Doluluk" geçen raporlar (ör. "2026 Yıllık Doluluk.PDF", "2027 Yıllık Doluluk.PDF"): ileri tarihli satılan odalar için (oda fiyatları ekranındaki "hedefin neresindeyiz").
   - Elia: "Günlük Yönetim Raporu.pdf", "Özet Günlük Yönetim Raporu.pdf" ve adında "Forecast" geçenler
   - Geçmiş yükleme e-postalarında (CRMGECMIS) tüm PDF ekleri indirilir.
   - Her eki ayrı ve boş bir klasöre kopyala (`/tmp/r/<messageId>/`).
5. **Ayrıştır.** `python3 -I /tmp/crm/tools/nightly.py --rows /tmp/r/*/*.pdf > /tmp/rows.json`
   - `files[].kind` boş kalan dosyalar tanınmamış demektir; sorun değil.
   - Hiç `daily` satırı çıkmazsa durup bildir.
6. **Birleştir.**
   - Mevcut `gunluk!A2:A` (key) ve `gunluk!CB2:CB` (src) sütunlarını oku. Satır satır `[[key, src], ...]` olarak `/tmp/keys.json`'a yaz; boş src için `""` kullan.
   - `otb!A2:F` sayfasını oku ve `/tmp/otb.json`'a yaz.
   - Çalıştır: `python3 -I /tmp/crm/tools/sheet_merge.py /tmp/rows.json /tmp/keys.json /tmp/otb.json > /tmp/plan.json`
7. **Yaz.**
   - `plan.updates`: her biri için `update_values(range, values)`.
   - `plan.append`: `append_values("gunluk!A1", ...)`, en fazla 150 satırlık parçalar halinde.
   - `plan.otb`:
     1. Önce `otb!A1:F{otbClearRows+5}` aralığını boş değerlerle temizle (`batch_clear_values` ya da boş string yaz).
     2. Sonra `otb!A1`'den itibaren `plan.otb`'yi yaz.
   - `islenen` sayfasına her işlenen e-posta için şu satırı ekle: `[messageId, otel, iş günü/günleri, konu, işlenme zamanı (İstanbul), not]`.
8. **Kontrol et.**
   - `gunluk` tablosundan bugün yazılan bir satırı geri oku.
   - Oda geliri ve doluluk, PDF'teki değerlerle aynı mı bak.
9. **Bildir.**
   - Her şey yolundaysa sessiz kal.
   - Rapor hiç gelmediyse ya da bir PDF okunamadıysa, kısa bir bildirim gönder: hangi otel, hangi gün, ne eksik.

## Kurallar
- Misafir adları, telefonları vb. hiçbir yere yazılmaz; yalnızca toplam rakamlar işlenir.
- Tablodaki "Manager Flash" ya da "Günlük Yönetim Raporu" kaynaklı tam satırların üzerine "geçmiş" kaynaklı (yalnız oda verisi) satır yazılmaz. `sheet_merge.py` bunu zaten sağlar.
- Gelirler net (vergiler hariç) ve ₺. Elia'nın doluluk tablosundaki brüt oda geliri `nightly.py` içinde net'e çevrilir.
