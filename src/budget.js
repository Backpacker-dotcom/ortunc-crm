// Gelir bütçesi: Ufuk'un "Gelir Bütçe 2027" yapısıyla (oda ADR × satılan oda, kahvaltı fiyatı × kişi, restoran ortalama hesap × kişi)
// Aylık ve gün gün düzenleme, toplu değişiklik, revizyon geçmişi, Excel içe/dışa aktarma ve PDF
import * as XLSX from 'xlsx';
import { S, A, $, $$, esc, ic, today, fmtDate, fmtNum, money, num, MONTHS, MON3, toast, can, errText, closeModal, stamp, confirmBox } from './core.js';
import { printHtml, saveFile } from './print.js';
import { HOTELS, TAXF } from './perf.js';

const M12 = () => Array(12).fill(0);
// giriş kutuları: "31.8" ondalık nokta, "1.250" / "1.250,5" Türkçe biçim
const pn = (v) => { if (typeof v === 'number') return v; const s = String(v ?? '').trim(); if (/^-?\d+(\.\d+)?$/.test(s) && !/^-?\d{1,3}\.\d{3}$/.test(s)) return Number(s); return num(s); };
const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const dim = (y, m) => new Date(y, m + 1, 0).getDate();
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
// bütçe satırları (otel başına); calc: hesaplanan satır
export const LINES = {
  ortunc: [
    ['room', 'Oda', [['adr', 'ADR (oda, brüt)', 'm'], ['rn', 'Satılan oda', 'n'], ['roomRev', 'Oda geliri', 'calc']]],
    ['bf', 'Kahvaltı', [['bfPrice', 'Kahvaltı fiyatı (kişi)', 'm'], ['bfPax', 'Kahvaltı kişi', 'n'], ['bfRev', 'Kahvaltı geliri', 'calc']]],
    ['fb', 'Restoran (F&B)', [['fbCheck', 'Ortalama hesap (kişi)', 'm'], ['fbPax', 'Restoran kişi', 'n'], ['fbRev', 'Restoran geliri', 'calc']]],
  ],
  elia: [
    ['room', 'Oda', [['adr', 'ADR (oda, brüt)', 'm'], ['rn', 'Satılan oda', 'n'], ['roomRev', 'Oda geliri', 'calc']]],
    ['bf', 'Kahvaltı', [['bfPrice', 'Kahvaltı fiyatı (kişi)', 'm'], ['bfPax', 'Kahvaltı kişi', 'n'], ['bfRev', 'Kahvaltı geliri', 'calc']]],
  ],
};
const INPUTS = (h) => LINES[h].flatMap(([, , ls]) => ls.filter((l) => l[2] !== 'calc').map((l) => l[0]));
// "Gelir Bütçe 2027.xlsx" (brüt ₺)
export const SEED_2027 = {
  gross: true,
  notes: ['', '', '08-11 Mart Ramazan Bayramı', '', '15-19 Mayıs Kurban Bayramı', '', '', '', '', '', '', ''],
  lines: {
    ortunc: { adr: [10300, 10500, 10650, 10250, 17600, 22985, 40000, 44750, 28750, 16500, 0, 0], rn: [70, 105, 245, 275, 500, 625, 985, 1025, 700, 200, 0, 0], bfPrice: [2200, 2200, 2200, 2200, 2200, 3000, 3000, 3000, 3000, 2200, 0, 0], bfPax: [140, 210, 490, 550, 1000, 1250, 1970, 2050, 1400, 400, 0, 0], fbCheck: [5525, 5750, 6750, 6250, 6800, 7250, 8250, 8500, 7000, 6250, 0, 0], fbPax: [100, 150, 400, 350, 800, 850, 1750, 2000, 1250, 150, 0, 0] },
    elia: { adr: [4500, 4500, 6250, 6250, 7250, 8000, 9500, 11950, 8250, 6250, 5500, 5500], rn: [40, 40, 80, 80, 250, 200, 310, 420, 250, 80, 40, 40], bfPrice: M12(), bfPax: M12() },
  },
};

/* ---------- veri ---------- */
export const tdoc = (y) => (S.data.targets || []).find((t) => t.id === String(y)) || null;
// eski (v1) kaydı yeni yapıya çevir
export function normB(t) {
  if (!t) return null;
  if (t.lines) return t;
  if (!t.hotels) return { ...t, lines: Object.fromEntries(Object.keys(HOTELS).map((h) => [h, Object.fromEntries(INPUTS(h).map((k) => [k, M12()]))])), notes: t.notes || Array(12).fill(''), empty: true };
  const lines = {}; Object.keys(HOTELS).forEach((h) => { const o = (t.hotels || {})[h] || {}; const rn = (o.rn || M12()).map(num); const rr = (o.roomRev || M12()).map(num); const fb = (o.fbRev || M12()).map(num);
    lines[h] = { adr: rn.map((v, i) => (v ? Math.round(rr[i] / v) : 0)), rn, bfPrice: M12(), bfPax: M12(), fbCheck: fb, fbPax: fb.map((v) => (v ? 1 : 0)) }; });
  return { ...t, lines, notes: t.notes || Array(12).fill('') };
}
const L = (t, h, k) => ((((t || {}).lines || {})[h] || {})[k] || M12()).map(num);
const dget = (t, h, m) => (((t || {}).daily || {})[h] || {})[String(m + 1).padStart(2, '0')] || null;
// ay toplamı (brüt): günlük kırılım varsa günlerden
export function monthTot(t, h, y, m) {
  const d = dget(t, h, m); const bfP = L(t, h, 'bfPrice')[m]; const fbC = L(t, h, 'fbCheck')[m];
  let rn, roomRev, bfPax, fbPax;
  if (d) { rn = (d.rn || []).reduce((s, v) => s + num(v), 0); roomRev = (d.rn || []).reduce((s, v, i) => s + num(v) * num((d.adr || [])[i]), 0); bfPax = (d.bfPax || []).reduce((s, v) => s + num(v), 0); fbPax = (d.fbPax || []).reduce((s, v) => s + num(v), 0); }
  else { rn = L(t, h, 'rn')[m]; roomRev = rn * L(t, h, 'adr')[m]; bfPax = L(t, h, 'bfPax')[m]; fbPax = L(t, h, 'fbPax')[m]; }
  const bfRev = bfPax * bfP; const fbRev = h === 'ortunc' ? fbPax * fbC : 0;
  return { rn, roomRev, adr: rn ? roomRev / rn : 0, bfPax, bfRev, fbPax, fbRev, total: roomRev + bfRev + fbRev, daily: !!d };
}
// ayın günlerine dağılım (günlük kırılım yoksa: hafta sonu ağırlıklı)
const WEIGHT = (y, m, d) => { const w = new Date(y, m, d).getDay(); return w === 5 || w === 6 ? 1.35 : 0.85; };
export function dayTot(t, h, dateIso) {
  const y = Number(dateIso.slice(0, 4)), m = Number(dateIso.slice(5, 7)) - 1, dd = Number(dateIso.slice(8, 10));
  const d = dget(t, h, m);
  if (d) { const i = dd - 1; const rn = num((d.rn || [])[i]); const roomRev = rn * num((d.adr || [])[i]); const bfRev = num((d.bfPax || [])[i]) * L(t, h, 'bfPrice')[m]; const fbRev = h === 'ortunc' ? num((d.fbPax || [])[i]) * L(t, h, 'fbCheck')[m] : 0; return { rn, roomRev, bfRev, fbRev }; }
  const n = dim(y, m); let sw = 0; for (let i = 1; i <= n; i++) sw += WEIGHT(y, m, i); const f = WEIGHT(y, m, dd) / sw;
  const mt = monthTot(t, h, y, m); return { rn: mt.rn * f, roomRev: mt.roomRev * f, bfRev: mt.bfRev * f, fbRev: mt.fbRev * f };
}
// seri: { rn, roomRev, bfRev, fbRev, total } × 12; net=true ise vergiler düşülür
export function budgetSeries(y, hs, net) {
  const t = normB(tdoc(y)); const f = TAXF(); const o = { rn: M12(), roomRev: M12(), bfRev: M12(), fbRev: M12(), total: M12(), set: !!t && !t.empty };
  if (!t) return o; const g = t.gross !== false;
  hs.forEach((h) => { for (let m = 0; m < 12; m++) { const x = monthTot(t, h, y, m); const kp = net && g ? f.pkg : 1, kf = net && g ? f.fb : 1; o.rn[m] += x.rn; o.roomRev[m] += x.roomRev / kp; o.bfRev[m] += x.bfRev / kp; o.fbRev[m] += x.fbRev / kf; } });
  for (let m = 0; m < 12; m++) o.total[m] = o.roomRev[m] + o.bfRev[m] + o.fbRev[m];
  return o;
}
// tarih aralığı bütçesi (gün gün)
export function budgetRange(y, hs, from, to, net) {
  const t = normB(tdoc(y)); if (!t || t.empty) return null; const f = TAXF(); const g = t.gross !== false; const o = { rn: 0, roomRev: 0, bfRev: 0, fbRev: 0 };
  for (let d = new Date(from + 'T12:00:00'); d <= new Date(to + 'T12:00:00'); d.setDate(d.getDate() + 1)) {
    const s = iso(d.getFullYear(), d.getMonth(), d.getDate()); if (!s.startsWith(String(y))) continue;
    hs.forEach((h) => { const x = dayTot(t, h, s); o.rn += x.rn; o.roomRev += x.roomRev; o.bfRev += x.bfRev; o.fbRev += x.fbRev; });
  }
  if (net && g) { o.roomRev /= f.pkg; o.bfRev /= f.pkg; o.fbRev /= f.fb; }
  o.total = o.roomRev + o.bfRev + o.fbRev; o.adr = o.rn ? o.roomRev / o.rn : null; return o;
}

/* ---------- aylık düzenleyici ---------- */
let ED = null; // { y, doc (kopya), view: 'month'|'day', h, m }
const cur = () => ED.doc;
const fmtCell = (v, type) => (type === 'n' ? fmtNum(Math.round(v)) : money(Math.round(v)));
function monthGrid() {
  const t = cur(); const y = ED.y;
  const rows = [];
  Object.keys(HOTELS).forEach((h) => {
    rows.push(`<tr class="bh"><th colspan="15">${esc(HOTELS[h])}</th></tr>`);
    LINES[h].forEach(([, glab, ls]) => {
      ls.forEach(([k, lab, type]) => {
        if (type === 'calc') {
          const vals = Array.from({ length: 12 }, (_, m) => monthTot(t, h, y, m)[k]);
          rows.push(`<tr class="calc"><td>${esc(glab)} · ${esc(lab)}</td>${vals.map((v) => `<td class="n">${money(Math.round(v))}</td>`).join('')}<td class="n"><b>${money(Math.round(vals.reduce((a, b) => a + b, 0)))}</b></td></tr>`);
        } else {
          const vals = L(t, h, k); const tot = k === 'adr' ? (() => { const r = Array.from({ length: 12 }, (_, m) => monthTot(t, h, y, m)); const rn = r.reduce((s, x) => s + x.rn, 0); return rn ? r.reduce((s, x) => s + x.roomRev, 0) / rn : 0; })() : ['bfPrice', 'fbCheck'].includes(k) ? null : vals.reduce((a, b) => a + b, 0);
          rows.push(`<tr><td>${esc(lab)}</td>${vals.map((v, m) => { const dl = dget(t, h, m) && ['adr', 'rn', 'bfPax', 'fbPax'].includes(k); const shown = dl ? (k === 'adr' ? monthTot(t, h, y, m).adr : monthTot(t, h, y, m)[k]) : v; return `<td><input class="inp n ${dl ? 'dl' : ''}" inputmode="decimal" data-b="${h}.${k}.${m}" value="${shown ? Math.round(shown * 100) / 100 : ''}" title="${dl ? 'Bu ay gün gün girildi; değiştirirseniz günler orantılı güncellenir' : ''}" aria-label="${esc(`${HOTELS[h]} ${lab} ${MONTHS[m]}`)}"></td>`; }).join('')}<td class="n"><b>${tot == null ? '' : fmtCell(tot, type)}</b></td></tr>`);
        }
      });
    });
    const tv = Array.from({ length: 12 }, (_, m) => monthTot(t, h, y, m).total);
    rows.push(`<tr class="tot"><td>${esc(HOTELS[h])} toplam</td>${tv.map((v) => `<td class="n">${money(Math.round(v))}</td>`).join('')}<td class="n"><b>${money(Math.round(tv.reduce((a, b) => a + b, 0)))}</b></td></tr>`);
  });
  const gt = Array.from({ length: 12 }, (_, m) => Object.keys(HOTELS).reduce((s, h) => s + monthTot(t, h, y, m).total, 0));
  rows.push(`<tr class="tot g"><td>Genel toplam</td>${gt.map((v) => `<td class="n">${money(Math.round(v))}</td>`).join('')}<td class="n"><b>${money(Math.round(gt.reduce((a, b) => a + b, 0)))}</b></td></tr>`);
  rows.push(`<tr><td>Not</td>${(t.notes || Array(12).fill('')).map((v, m) => `<td><input class="inp" data-note="${m}" value="${esc(v || '')}" aria-label="${MONTHS[m]} notu" placeholder="—"></td>`).join('')}<td></td></tr>`);
  return `<table class="tb bgrid"><tr><th>${y} · brüt ₺</th>${MON3.map((m, i) => `<th class="n"><button class="lnk" data-act="bDay" data-m="${i}" title="${MONTHS[i]} gün gün">${m}</button></th>`).join('')}<th class="n">Toplam</th></tr>${rows.join('')}</table>`;
}
function dayGrid() {
  const t = cur(); const y = ED.y, h = ED.h, m = ED.m; const n = dim(y, m);
  let d = dget(t, h, m);
  const mt = monthTot(t, h, y, m); const bfP = L(t, h, 'bfPrice')[m], fbC = L(t, h, 'fbCheck')[m];
  const cols = h === 'ortunc' ? [['rn', 'Oda'], ['adr', 'ADR'], ['bfPax', 'Kahvaltı kişi'], ['fbPax', 'Restoran kişi']] : [['rn', 'Oda'], ['adr', 'ADR'], ['bfPax', 'Kahvaltı kişi']];
  if (!d) { // önizleme: ay toplamını dağıt
    d = {}; cols.forEach(([k]) => { d[k] = Array.from({ length: n }, (_, i) => { const x = dayTot(t, h, iso(y, m, i + 1)); return k === 'adr' ? Math.round(mt.adr) : k === 'rn' ? Math.round(x.rn * 10) / 10 : k === 'bfPax' ? Math.round((mt.bfPax * x.rn) / (mt.rn || 1) * 10) / 10 : Math.round((mt.fbPax * x.rn) / (mt.rn || 1) * 10) / 10; }); });
  }
  return `<div class="dayhead"><div class="seg">${Object.entries(HOTELS).map(([k, l]) => `<button class="${k === h ? 'on' : ''}" data-act="bDay" data-h="${k}" data-m="${m}">${esc(l)}</button>`).join('')}</div>
      <div class="seg">${MON3.map((l, i) => `<button class="${i === m ? 'on' : ''}" data-act="bDay" data-h="${h}" data-m="${i}">${l}</button>`).join('')}</div></div>
    <p class="muted" style="font-size:12.5px;margin:6px 0">${dget(t, h, m) ? 'Bu ay gün gün girildi; ay toplamı günlerden hesaplanır.' : 'Bu ay henüz gün gün girilmedi; aşağıda ay toplamının hafta sonu ağırlıklı dağılımı görünüyor. Değiştirip "Günleri uygula" derseniz ay toplamı günlerden hesaplanır.'} Kahvaltı fiyatı ${money(bfP)}${h === 'ortunc' ? ` · restoran ortalama hesap ${money(fbC)}` : ''} (aylık sekmede).</p>
    <div class="acts" style="margin-bottom:8px"><button class="btn sm" data-act="bSpread" data-w="1">Ay toplamını hafta sonu ağırlıklı dağıt</button><button class="btn sm" data-act="bSpread" data-w="0">Eşit dağıt</button>${dget(t, h, m) ? '<button class="btn sm" data-act="bDayClear">Gün gün girişi kaldır</button>' : ''}</div>
    <table class="tb bgrid day"><tr><th>Gün</th>${cols.map(([, l]) => `<th class="n">${l}</th>`).join('')}<th class="n">Oda geliri</th><th class="n">Toplam</th></tr>
    ${Array.from({ length: n }, (_, i) => { const w = new Date(y, m, i + 1).getDay(); const rr = num(d.rn[i]) * num(d.adr[i]); const tot = rr + num((d.bfPax || [])[i]) * bfP + (h === 'ortunc' ? num((d.fbPax || [])[i]) * fbC : 0); return `<tr class="${w === 0 || w === 6 ? 'we' : ''}"><td>${i + 1} ${DAYS[w]}</td>${cols.map(([k]) => `<td><input class="inp n" inputmode="decimal" data-d="${k}.${i}" value="${(d[k] || [])[i] || ''}" aria-label="${i + 1} ${k}"></td>`).join('')}<td class="n" data-dr="${i}">${money(Math.round(rr))}</td><td class="n" data-dt="${i}">${money(Math.round(tot))}</td></tr>`; }).join('')}
    <tr class="tot"><td>Toplam</td>${cols.map(([k]) => `<td class="n" data-dsum="${k}"></td>`).join('')}<td class="n" data-dsum="rr"></td><td class="n" data-dsum="tt"></td></tr></table>`;
}
function render() {
  const t = cur(); const hasDoc = !!tdoc(ED.y); const revs = (tdoc(ED.y) || {}).revisions || [];
  $('#modal').innerHTML = `<div class="ov center"><div class="modal bmodal"><div class="mh"><h2>${ED.y} gelir bütçesi${hasDoc ? ` · ${revs.length ? `revizyon ${revs.length}` : 'ilk sürüm'}` : ''}</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb">
      <div class="dayhead"><div class="seg"><button class="${ED.view === 'month' ? 'on' : ''}" data-act="bView" data-v="month">Aylık</button><button class="${ED.view === 'day' ? 'on' : ''}" data-act="bView" data-v="day">Gün gün</button><button class="${ED.view === 'bulk' ? 'on' : ''}" data-act="bView" data-v="bulk">Toplu değişiklik</button></div>
        <label class="perfdate">Tutarlar <select class="inp" id="bGross"><option value="1" ${t.gross !== false ? 'selected' : ''}>Brüt (vergiler dahil)</option><option value="0" ${t.gross === false ? 'selected' : ''}>Net</option></select></label>
        <span class="sp"></span><label class="btn sm" style="cursor:pointer">${ic('upload')} Excel'den yükle<input type="file" accept=".xlsx,.xls" id="bImport" hidden></label>${ED.y === 2027 ? '<button class="btn sm" data-act="bSeed">Bütçe dosyasındaki 2027 rakamları</button>' : ''}</div>
      <div class="scroll-x" id="bBody">${ED.view === 'month' ? monthGrid() : ED.view === 'day' ? dayGrid() : bulkForm()}</div>
      <p class="err" id="bErr" role="alert"></p></div>
    <div class="mf">${hasDoc && can.admin() ? '<button class="btn danger sp" data-act="bDelete">Bütçeyi sil</button>' : ''}<button class="btn" data-act="closeModal">Vazgeç</button>${ED.view === 'day' ? '<button class="btn" data-act="bDayApply">Günleri uygula</button>' : ''}<button class="btn pri" data-act="bSave">${hasDoc ? 'Revizyon olarak kaydet' : 'Kaydet'}</button></div></div></div>`;
  wire();
}
function wire() {
  $$('[data-b]').forEach((el) => el.addEventListener('change', () => {
    const [h, k, m] = el.dataset.b.split('.'); const v = pn(el.value); const t = cur(); t.lines[h][k] = L(t, h, k); const mi = Number(m);
    const d = dget(t, h, mi);
    if (d && ['adr', 'rn', 'bfPax', 'fbPax'].includes(k)) { // günleri orantılı güncelle
      const old = k === 'adr' ? monthTot(t, h, ED.y, mi).adr : monthTot(t, h, ED.y, mi)[k]; const r = old ? v / old : 0;
      d[k] = (d[k] || []).map((x) => Math.round(num(x) * r * 100) / 100);
    }
    t.lines[h][k][mi] = v; refreshMonth();
  }));
  $$('[data-note]').forEach((el) => el.addEventListener('input', () => { const t = cur(); t.notes = t.notes || Array(12).fill(''); t.notes[Number(el.dataset.note)] = el.value; }));
  const g = $('#bGross'); if (g) g.onchange = () => { cur().gross = g.value === '1'; };
  const imp = $('#bImport'); if (imp) imp.onchange = () => importXlsx(imp.files[0]);
  if (ED.view === 'day') { $$('[data-d]').forEach((el) => el.addEventListener('input', daySums)); daySums(); }
}
function refreshMonth() { const sc = $('#bBody').scrollLeft; $('#bBody').innerHTML = monthGrid(); $('#bBody').scrollLeft = sc; wire(); }
function readDays() { const out = {}; $$('[data-d]').forEach((el) => { const [k, i] = el.dataset.d.split('.'); (out[k] = out[k] || [])[Number(i)] = pn(el.value); }); return out; }
function daySums() {
  const d = readDays(); const t = cur(); const m = ED.m, h = ED.h; const bfP = L(t, h, 'bfPrice')[m], fbC = L(t, h, 'fbCheck')[m]; let rr = 0, tt = 0;
  (d.rn || []).forEach((rn, i) => { const r = rn * num(d.adr[i]); const x = r + num((d.bfPax || [])[i]) * bfP + (h === 'ortunc' ? num((d.fbPax || [])[i]) * fbC : 0); rr += r; tt += x; const a = $(`[data-dr="${i}"]`), b = $(`[data-dt="${i}"]`); if (a) a.textContent = money(Math.round(r)); if (b) b.textContent = money(Math.round(x)); });
  Object.keys(d).forEach((k) => { const el = $(`[data-dsum="${k}"]`); if (!el) return; if (k === 'adr') { const rn = (d.rn || []).reduce((s, v) => s + v, 0); el.textContent = rn ? money(Math.round(rr / rn)) : '—'; } else el.textContent = fmtNum(Math.round((d[k] || []).reduce((s, v) => s + v, 0) * 10) / 10); });
  $('[data-dsum="rr"]').textContent = money(Math.round(rr)); $('[data-dsum="tt"]').textContent = money(Math.round(tt));
}
function bulkForm() {
  const opts = Object.keys(HOTELS).flatMap((h) => LINES[h].flatMap(([, , ls]) => ls.filter((l) => l[2] !== 'calc').map(([k, lab]) => [`${h}.${k}`, `${HOTELS[h]} · ${lab}`])));
  return `<div class="form" style="max-width:640px">
    <div class="fld"><label for="bkLine">Hangi kalem</label><select id="bkLine" class="inp">${opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}<option value="*.adr">İki otel · ADR</option><option value="*.rn">İki otel · Satılan oda</option></select></div>
    <div class="fld half"><label for="bkFrom">Başlangıç ayı</label><select id="bkFrom" class="inp">${MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join('')}</select></div>
    <div class="fld half"><label for="bkTo">Bitiş ayı</label><select id="bkTo" class="inp">${MONTHS.map((m, i) => `<option value="${i}" ${i === 11 ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
    <div class="fld half"><label for="bkOp">İşlem</label><select id="bkOp" class="inp"><option value="pct">Yüzde artır / azalt</option><option value="add">Tutar ekle / çıkar</option><option value="set">Değeri şuna eşitle</option></select></div>
    <div class="fld half"><label for="bkVal">Değer</label><input id="bkVal" class="inp" inputmode="decimal" placeholder="ör. 5 ya da -10"></div>
    <div class="fld"><button class="btn pri" data-act="bBulk">Uygula</button> <span class="hint">Örnek: Ortunç ADR'yi Haziran–Eylül arası %5 artırmak. Değişiklik kaydedene kadar taslakta kalır; "Aylık" sekmesinde görebilirsiniz.</span></div></div>`;
}
A.bView = (el) => { if (ED.view === 'day') A.bDayApply(null, true); ED.view = el.dataset.v; if (ED.view === 'day' && ED.h == null) { ED.h = 'ortunc'; ED.m = Math.max(0, Number(today().slice(5, 7)) - 1); } render(); };
A.bDay = (el) => { if (ED.view === 'day') A.bDayApply(null, true); ED.view = 'day'; ED.h = el.dataset.h || ED.h || 'ortunc'; ED.m = Number(el.dataset.m); render(); };
A.bDayApply = (el, silent) => {
  if (ED.view !== 'day') return; const d = readDays(); const t = cur(); const old = dget(t, ED.h, ED.m);
  const changed = !old ? $$('[data-d]').some((x) => x.dataset.touched) : true;
  if (!old && !changed && silent) return;
  t.daily = t.daily || {}; t.daily[ED.h] = t.daily[ED.h] || {}; t.daily[ED.h][String(ED.m + 1).padStart(2, '0')] = d;
  const mt = monthTot(t, ED.h, ED.y, ED.m); ['rn', 'bfPax', 'fbPax'].forEach((k) => { if (t.lines[ED.h][k]) t.lines[ED.h][k][ED.m] = Math.round(mt[k] * 100) / 100; }); t.lines[ED.h].adr[ED.m] = Math.round(mt.adr * 100) / 100;
  if (!silent) { toast(`${MONTHS[ED.m]} gün gün uygulandı`); render(); }
};
document.addEventListener('input', (e) => { if (e.target && e.target.dataset && e.target.dataset.d) e.target.dataset.touched = '1'; });
A.bSpread = (el) => {
  const t = cur(); const y = ED.y, m = ED.m, h = ED.h; const n = dim(y, m); const wgt = el.dataset.w === '1';
  const mt = (() => { const d = dget(t, h, m); if (d) return monthTot(t, h, y, m); return { rn: L(t, h, 'rn')[m], adr: L(t, h, 'adr')[m], bfPax: L(t, h, 'bfPax')[m], fbPax: L(t, h, 'fbPax')[m] }; })();
  const ws = Array.from({ length: n }, (_, i) => (wgt ? WEIGHT(y, m, i + 1) : 1)); const sw = ws.reduce((a, b) => a + b, 0);
  const r1 = (v) => Math.round(v * 10) / 10;
  t.daily = t.daily || {}; t.daily[h] = t.daily[h] || {};
  t.daily[h][String(m + 1).padStart(2, '0')] = { rn: ws.map((w) => r1((mt.rn * w) / sw)), adr: ws.map(() => Math.round(mt.adr)), bfPax: ws.map((w) => r1(((mt.bfPax || 0) * w) / sw)), ...(h === 'ortunc' ? { fbPax: ws.map((w) => r1(((mt.fbPax || 0) * w) / sw)) } : {}) };
  render();
};
A.bDayClear = () => { const t = cur(); delete t.daily[ED.h][String(ED.m + 1).padStart(2, '0')]; render(); };
A.bBulk = () => {
  const [h0, k] = $('#bkLine').value.split('.'); const a = Number($('#bkFrom').value), b = Number($('#bkTo').value); const op = $('#bkOp').value; const v = pn($('#bkVal').value);
  if (!$('#bkVal').value.trim()) return toast('Bir değer girin.'); if (b < a) return toast('Bitiş ayı başlangıçtan önce olamaz.');
  const t = cur(); const hs = h0 === '*' ? Object.keys(HOTELS) : [h0]; let n = 0;
  hs.forEach((h) => { t.lines[h][k] = L(t, h, k); for (let m = a; m <= b; m++) { const old = t.lines[h][k][m]; const nv = op === 'pct' ? old * (1 + v / 100) : op === 'add' ? old + v : v; t.lines[h][k][m] = Math.round(nv * 100) / 100; n++;
    const d = dget(t, h, m); if (d && d[k]) { const r = old ? nv / old : 0; d[k] = d[k].map((x) => (op === 'set' && !old ? nv / d[k].length : Math.round(num(x) * r * 100) / 100)); } } });
  toast(`${n} hücre güncellendi`); ED.view = 'month'; render();
};
A.bSeed = () => { const t = cur(); const s = JSON.parse(JSON.stringify(SEED_2027)); t.lines = s.lines; t.notes = s.notes; t.gross = true; t.daily = {}; toast('Bütçe dosyasındaki 2027 rakamları dolduruldu; kontrol edip kaydedin'); ED.view = 'month'; render(); };
A.bSave = async (el) => {
  if (ED.view === 'day') A.bDayApply(null, true);
  const t = cur(); const prev = tdoc(ED.y);
  const doSave = async (note) => {
    el.disabled = true;
    try {
      const pn = (prev && prev.rev && prev.rev.note) || (prev && (prev.revisions || []).length ? '' : 'İlk sürüm');
      const snap = prev ? { no: (prev.revisions || []).length, at: prev.updatedAt || prev.createdAt || Date.now(), by: prev.updatedByName || '', note: pn, lines: normB(prev).lines, notes: prev.notes || [], daily: prev.daily || {}, gross: prev.gross !== false } : null;
      const revisions = [...((prev && prev.revisions) || []), ...(snap ? [snap] : [])];
      await S.store.save('targets', stamp({ ...(prev || {}), ...t, id: String(ED.y), year: ED.y, v: 2, revisions, rev: { no: revisions.length, note: note || '', at: Date.now(), by: S.user.name }, hotels: null }));
      toast(prev ? `Revizyon ${revisions.length} kaydedildi` : 'Bütçe kaydedildi'); closeModal(); ED = null;
    } catch (e) { $('#bErr').textContent = errText(e); el.disabled = false; }
  };
  if (!prev) return doSave('');
  const n = ((prev.revisions || []).length) + 1;
  const box = $('#bErr'); box.innerHTML = `<span style="color:var(--ink)">Revizyon ${n} notu: </span><input id="bRevNote" class="inp" style="width:min(420px,100%);display:inline-block" placeholder="ör. Temmuz–Ağustos ADR %5 artırıldı"> <button class="btn sm pri" id="bRevGo">Kaydet</button>`;
  $('#bRevNote').focus(); $('#bRevGo').onclick = () => doSave($('#bRevNote').value.trim());
};
A.bDelete = () => confirmBox(`${ED.y} bütçesi, revizyonları ve ekip hedefleri silinecek.`, 'Sil', async () => { await S.store.remove('targets', String(ED.y)); toast('Silindi'); closeModal(); ED = null; });
export function openBudget(y) {
  const t = normB(tdoc(y));
  ED = { y, view: 'month', h: null, m: 0, doc: t ? JSON.parse(JSON.stringify({ gross: t.gross !== false, lines: t.lines, notes: t.notes || Array(12).fill(''), daily: t.daily || {} })) : { gross: true, lines: Object.fromEntries(Object.keys(HOTELS).map((h) => [h, Object.fromEntries(INPUTS(h).map((k) => [k, M12()]))])), notes: Array(12).fill(''), daily: {} } };
  render();
}
A.budgetEdit = () => openBudget(S.goals.year);

/* ---------- Excel içe aktarma (Gelir Bütçe dosyası biçimi) ---------- */
async function importXlsx(file) {
  if (!file) return;
  try {
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    // ay sütunlarını bul (OCAK … ARALIK)
    let hdr = -1, c0 = -1; aoa.some((r, i) => { const j = (r || []).findIndex((v) => typeof v === 'string' && /^\s*OCAK\s*$/i.test(v)); if (j >= 0) { hdr = i; c0 = j; return true; } return false; });
    if (hdr < 0) throw new Error('Ay başlıkları (OCAK … ARALIK) bulunamadı.');
    const lab = (r) => (r || []).slice(0, c0).filter((v) => typeof v === 'string').join(' ').trim().toLocaleLowerCase('tr-TR');
    const vals = (r) => Array.from({ length: 12 }, (_, i) => num((r || [])[c0 + i]));
    const t = cur(); let sec = ''; let hit = 0; const elia = (s) => /el[iı]a/.test(s);
    aoa.slice(hdr + 1).forEach((r) => {
      const l = lab(r); if (!l) return;
      if ((r || [])[c0] == null) { if (/breakfast|kahvalt/.test(l)) sec = 'bf'; else if (/f&b|restoran/.test(l)) sec = 'fb'; else if (/el[iı]a/.test(l)) sec = 'elia'; else if (/room|oda/.test(l)) sec = 'room'; return; }
      const set = (h, k) => { t.lines[h][k] = vals(r); hit++; };
      if (/adr/.test(l)) set(elia(l) || sec === 'elia' ? 'elia' : 'ortunc', 'adr');
      else if (/room sold/.test(l)) set(elia(l) || sec === 'elia' ? 'elia' : 'ortunc', 'rn');
      else if (/breakfast rev\./.test(l)) set('ortunc', 'bfPrice');
      else if (/^pax$/.test(l) && sec === 'bf') set('ortunc', 'bfPax');
      else if (/av\. ?check/.test(l)) set('ortunc', 'fbCheck');
      else if (/^pax$/.test(l) && sec === 'fb') set('ortunc', 'fbPax');
    });
    const noteRow = aoa.slice(0, hdr).find((r) => (r || []).some((v) => typeof v === 'string' && /bayram|tatil|not/i.test(v)));
    if (noteRow) t.notes = Array.from({ length: 12 }, (_, i) => (typeof noteRow[c0 + i] === 'string' ? noteRow[c0 + i] : t.notes[i] || ''));
    if (!hit) throw new Error('Tanınan satır yok (ADR, Room sold, Pax, Av. Check …).');
    t.daily = {}; toast(`${hit} satır Excel'den alındı; kontrol edip kaydedin`); ED.view = 'month'; render();
  } catch (e) { $('#bErr').textContent = 'Excel okunamadı: ' + (e.message || e); }
}

/* ---------- Excel / PDF dışa aktarma ---------- */
function sheetFor(t, y) {
  const rows = [['', 'TRY · ' + (t.gross !== false ? 'brüt' : 'net'), ...MONTHS.map((m) => m.toLocaleUpperCase('tr-TR')), 'TOPLAM HEDEF'], ['', 'Not', ...(t.notes || Array(12).fill('')), '']];
  Object.keys(HOTELS).forEach((h) => {
    rows.push([]); rows.push([HOTELS[h]]);
    LINES[h].forEach(([, glab, ls]) => { rows.push([glab]); ls.forEach(([k, lab, type]) => { const mv = Array.from({ length: 12 }, (_, m) => (type === 'calc' || ['adr', 'rn', 'bfPax', 'fbPax'].includes(k) ? monthTot(t, h, y, m)[k] : L(t, h, k)[m])); const tot = k === 'adr' ? (() => { const r = Array.from({ length: 12 }, (_, m) => monthTot(t, h, y, m)); const rn = r.reduce((s, x) => s + x.rn, 0); return rn ? r.reduce((s, x) => s + x.roomRev, 0) / rn : 0; })() : ['bfPrice', 'fbCheck'].includes(k) ? null : mv.reduce((a, b) => a + b, 0); rows.push(['', lab, ...mv.map((v) => Math.round(v * 100) / 100), tot == null ? '' : Math.round(tot * 100) / 100]); }); });
    const tv = Array.from({ length: 12 }, (_, m) => monthTot(t, h, y, m).total); rows.push([`${HOTELS[h].toLocaleUpperCase('tr-TR')} TOPLAM`, '', ...tv.map(Math.round), Math.round(tv.reduce((a, b) => a + b, 0))]);
  });
  const gt = Array.from({ length: 12 }, (_, m) => Object.keys(HOTELS).reduce((s, h) => s + monthTot(t, h, y, m).total, 0)); rows.push([]); rows.push(['GENEL TOPLAM', '', ...gt.map(Math.round), Math.round(gt.reduce((a, b) => a + b, 0))]);
  const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 18 }, { wch: 24 }, ...MONTHS.map(() => ({ wch: 13 })), { wch: 15 }]; return ws;
}
function daySheet(t, y) {
  const rows = [['Tarih', 'Gün', 'Otel', 'Satılan oda', 'ADR', 'Oda geliri', 'Kahvaltı geliri', 'Restoran geliri', 'Toplam', 'Kaynak']];
  for (let m = 0; m < 12; m++) for (let d = 1; d <= dim(y, m); d++) Object.keys(HOTELS).forEach((h) => { const x = dayTot(t, h, iso(y, m, d)); rows.push([iso(y, m, d), DAYS[new Date(y, m, d).getDay()], HOTELS[h], Math.round(x.rn * 10) / 10, x.rn ? Math.round(x.roomRev / x.rn) : 0, Math.round(x.roomRev), Math.round(x.bfRev), Math.round(x.fbRev), Math.round(x.roomRev + x.bfRev + x.fbRev), dget(t, h, m) ? 'gün gün' : 'dağıtım']); });
  return XLSX.utils.aoa_to_sheet(rows);
}
export function budgetVersions(y) {
  const t = tdoc(y); if (!t || normB(t).empty) return [];
  const now = normB(t);
  return [...(t.revisions || []).map((r, i) => ({ label: r.no === 0 || i === 0 ? 'İlk sürüm' : `Revizyon ${r.no}`, doc: normB({ ...r, lines: r.lines }), at: r.at, by: r.by, note: r.note })), { label: (t.revisions || []).length ? `Revizyon ${(t.revisions || []).length} (güncel)` : 'Güncel', doc: now, at: t.updatedAt, by: t.updatedByName, note: (t.rev || {}).note || '', current: true }];
}
export function exportBudgetXlsx(y, vi) {
  const vs = budgetVersions(y); if (!vs.length) return toast('Bu yıl için bütçe yok.');
  const v = vi == null ? vs[vs.length - 1] : vs[vi]; const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFor(v.doc, y), `revenue ${y}`);
  XLSX.utils.book_append_sheet(wb, daySheet(v.doc, y), 'Günlük');
  if (vs.length > 1) {
    const rows = [['Sürüm', 'Tarih', 'Hazırlayan', 'Not', 'Ortunç toplam', 'Elia toplam', 'Genel toplam', 'Oda-gece']];
    vs.forEach((x) => { const tot = (h) => Array.from({ length: 12 }, (_, m) => monthTot(x.doc, h, y, m).total).reduce((a, b) => a + b, 0); rows.push([x.label, x.at ? fmtDate(new Date(x.at).toISOString().slice(0, 10)) : '', x.by || '', x.note || '', Math.round(tot('ortunc')), Math.round(tot('elia')), Math.round(tot('ortunc') + tot('elia')), Object.keys(HOTELS).reduce((s, h) => s + Array.from({ length: 12 }, (_, m) => monthTot(x.doc, h, y, m).rn).reduce((a, b) => a + b, 0), 0)]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Revizyonlar');
  }
  saveFile(`Gelir-Butce-${y}-${v.label.replace(/[^\p{L}\p{N}]+/gu, '-')}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
}
export function printBudget(y, vi) {
  const vs = budgetVersions(y); if (!vs.length) return toast('Bu yıl için bütçe yok.'); const v = vi == null ? vs[vs.length - 1] : vs[vi]; const t = v.doc;
  const tr = (lab, arr, type, tot, cls = '') => `<tr class="${cls}"><td>${lab}</td>${arr.map((x) => `<td class="n">${type === 'n' ? fmtNum(Math.round(x)) : money(Math.round(x))}</td>`).join('')}<td class="n"><b>${tot == null ? '' : type === 'n' ? fmtNum(Math.round(tot)) : money(Math.round(tot))}</b></td></tr>`;
  let body = '';
  Object.keys(HOTELS).forEach((h) => {
    body += `<tr><th colspan="14" style="text-align:left;background:#EEF2F7">${esc(HOTELS[h])}</th></tr>`;
    LINES[h].forEach(([, glab, ls]) => ls.forEach(([k, lab, type]) => { const mv = Array.from({ length: 12 }, (_, m) => (type === 'calc' || ['adr', 'rn', 'bfPax', 'fbPax'].includes(k) ? monthTot(t, h, y, m)[k] : L(t, h, k)[m])); const tot = k === 'adr' ? (() => { const r = Array.from({ length: 12 }, (_, m) => monthTot(t, h, y, m)); const rn = r.reduce((s, x) => s + x.rn, 0); return rn ? r.reduce((s, x) => s + x.roomRev, 0) / rn : 0; })() : ['bfPrice', 'fbCheck'].includes(k) ? null : mv.reduce((a, b) => a + b, 0); body += tr(`${esc(glab)} · ${esc(lab)}`, mv, type === 'n' ? 'n' : 'm', tot, type === 'calc' ? 'calc' : ''); }));
    const tv = Array.from({ length: 12 }, (_, m) => monthTot(t, h, y, m).total); body += tr(`<b>${esc(HOTELS[h])} toplam</b>`, tv, 'm', tv.reduce((a, b) => a + b, 0), 'tot');
  });
  const gt = Array.from({ length: 12 }, (_, m) => Object.keys(HOTELS).reduce((s, h) => s + monthTot(t, h, y, m).total, 0)); body += tr('<b>Genel toplam</b>', gt, 'm', gt.reduce((a, b) => a + b, 0), 'tot');
  if ((t.notes || []).some(Boolean)) body += `<tr><td>Not</td>${(t.notes || []).map((n) => `<td style="font-size:9px">${esc(n || '')}</td>`).join('')}<td></td></tr>`;
  printHtml(`Gelir-Butce-${y}`, `<div class="pdoc"><div class="ph"><b>${esc(S.settings.hotelName)}</b><span>${esc(fmtDate(today()))} · ${esc(S.user.name)}</span></div><h1>${y} gelir bütçesi · ${esc(v.label)}</h1><p class="sub">${t.gross !== false ? 'Brüt (vergiler dahil)' : 'Net'} ₺${v.note ? ' · ' + esc(v.note) : ''}${v.at ? ' · ' + esc(fmtDate(new Date(v.at).toISOString().slice(0, 10))) : ''}${v.by ? ' · ' + esc(v.by) : ''}</p>
    <table class="tb" style="font-size:9.5px"><tr><th></th>${MON3.map((m) => `<th class="n">${m}</th>`).join('')}<th class="n">Toplam</th></tr>${body}</table></div>`, '@page{size:A4 landscape;margin:9mm}.calc td{color:#1F5E8C}.tot td{border-top:1.5px solid #13223A}');
}
