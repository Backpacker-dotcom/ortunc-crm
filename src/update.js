/* ---------- Güncelleme bildirimi (Android) ----------
 * İki tür güncelleme var:
 *  1. Sayfa (index.html): uygulama yeni sürümü arka planda indirir; hazır olunca ekranda
 *     "Yeni sürüm hazır · Yenile" çıkar. Yenile'ye basınca yeni sürüm hemen açılır.
 *  2. Uygulama kabuğu (APK): android.yml'deki SHELL numarası artınca, eski APK'yı kullananlara
 *     "Uygulamanın yeni sürümü var · İndir" çıkar; İndir yeni APK'yı tarayıcıda indirir.
 * Hangi sürümün güncel olduğu depodaki version.json'dan okunur (npm run build üretir).
 */
import { $, ic } from './core.js';

const REPO = 'Backpacker-dotcom/ortunc-crm';
const SOURCES = [`https://raw.githubusercontent.com/${REPO}/main/version.json`, `https://cdn.jsdelivr.net/gh/${REPO}@main/version.json`];
const APK_URL = `https://github.com/${REPO}/releases/latest/download/OrtuncCRM.apk`;
const BUILD = '__BUILD__';
const Native = window.Android;

// Bridge.shellVersion() ilk kez SHELL 2 ile geldi; olmayan APK'lar 1 sayılır.
const shellNow = () => { try { return Native && Native.shellVersion ? Number(Native.shellVersion()) || 1 : 1; } catch (e) { return 1; } };

// "Sonra" (×) şeridi 2 saat gizler; sonra yeniden hatırlatır.
let state = { page: false, apk: false }, lastCheck = 0, oldShellTimer = null, hiddenAt = 0;

function render() {
  let bar = $('#updBar');
  const kind = state.apk ? 'apk' : state.page ? 'page' : '';
  if (!kind || Date.now() - hiddenAt < 2 * 3600000) { if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'updBar'; bar.className = 'updbar'; bar.setAttribute('role', 'status'); document.body.appendChild(bar); }
  bar.dataset.kind = kind;
  bar.innerHTML = kind === 'apk'
    ? `<span class="t"><b>Uygulamanın yeni sürümü var</b><span>Yeni APK'yı indirip kurun; kayıtlarınız silinmez.</span></span><button class="btn sm pri" data-upd="apk">${ic('download')} İndir</button><button class="x" data-upd="close" aria-label="Sonra">${ic('x')}</button>`
    : `<span class="t"><b>Yeni sürüm hazır</b><span>Yenileyince en son sürüm açılır.</span></span><button class="btn sm pri" data-upd="reload">Yenile</button><button class="x" data-upd="close" aria-label="Sonra">${ic('x')}</button>`;
}

document.addEventListener('click', (ev) => {
  const b = ev.target.closest && ev.target.closest('[data-upd]'); if (!b) return;
  const a = b.dataset.upd;
  if (a === 'reload') { if (Native && Native.reload) Native.reload(); else location.reload(); }
  else if (a === 'apk') { if (Native && Native.openUrl) Native.openUrl(APK_URL); else location.href = APK_URL; }
  else if (a === 'close') { hiddenAt = Date.now(); render(); }
});

// Yeni kabuk (SHELL ≥ 2): Java tarafı yeni index.html'i indirip kaydedince çağırır.
window.onNativeUpdate = () => { state.page = true; render(); };

async function fetchVersion() {
  for (const u of SOURCES) {
    try {
      const r = await fetch(u + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) continue;
      const j = await r.json();
      if (j && typeof j.build === 'string') return j;
    } catch (e) { /* sıradaki kaynak */ }
  }
  return null;
}

async function check() {
  if (Date.now() - lastCheck < 120000) return;
  lastCheck = Date.now();
  const v = await fetchVersion(); if (!v) return;
  if (Number(v.shell) > shellNow()) state.apk = true;
  if (v.build !== BUILD) {
    if (Native && Native.checkUpdate) Native.checkUpdate(); // indirme bitince onNativeUpdate gelir
    else if (!oldShellTimer) {
      // Eski APK: indirmeyi kendisi açılışta / 10 dk'da bir yapar; ona zaman tanıyıp sonra yenilemeyi öner.
      oldShellTimer = setTimeout(() => { state.page = true; render(); }, 45000);
    }
  }
  render();
}

if (Native) {
  setTimeout(check, 4000);
  setInterval(check, 15 * 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
}
