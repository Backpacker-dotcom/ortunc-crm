// Otel performansı: gece raporlarından (Ortunç Opera Manager Flash, Elia Elektra Günlük Yönetim Raporu) gelen günlük veriler
import * as XLSX from 'xlsx';
import { S, A, V, $, esc, ic, today, addDays, fmtDate, fmtNum, money, MON3, MONTHS, toast, can, sortBy, openForm, taxCfg } from './core.js';
import { printHtml, saveFile } from './print.js';
import { DS, QUICK } from './builder.js';

export const HOTELS = { ortunc: 'Ortunç Otel', elia: 'Elia Otel' };
const LS = 'ortunc-crm.perf';
const cfg = () => (S.settings && S.settings.perf) || {};
S.perf = S.perf || { daily: [], otb: [], at: null, loading: false, err: '', hotel: 'all', date: '' };
try { const c = JSON.parse(localStorage.getItem(LS) || 'null'); if (c && Array.isArray(c.daily)) Object.assign(S.perf, { daily: c.daily, otb: c.otb || [], at: c.at }); } catch (e) { /* yok */ }

const N = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const normDay = (r) => { const o = { ...r }; Object.keys(o).forEach((k) => { if (!['key', 'hotel', 'date', 'src', 'updatedAt'].includes(k)) o[k] = N(o[k]); }); o.date = String(o.date).slice(0, 10); return o; };

/* ---------- veri yükleme ---------- */
let lastLoad = 0;
export async function loadPerf(force) {
  const c = cfg();
  if (S.store && S.store.kind === 'local') { if (!S.perf.daily.length) demoData(); return; }
  if (!c.url || !c.token) return;
  if (S.perf.loading || (!force && Date.now() - lastLoad < 10 * 60 * 1000)) return;
  S.perf.loading = true; S.perf.err = '';
  try {
    const res = await fetch(`${c.url}${c.url.includes('?') ? '&' : '?'}t=${encodeURIComponent(c.token)}&_=${Date.now()}`, { redirect: 'follow' });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error === 'yetkisiz' ? 'Erişim anahtarı kabul edilmedi.' : j.error || 'Veri alınamadı.');
    S.perf.daily = (j.daily || []).map(normDay).filter((r) => r.hotel && r.date);
    S.perf.otb = (j.otb || []).map((o) => ({ ...o, date: String(o.date).slice(0, 10), asOf: String(o.asOf || '').slice(0, 10), rooms: N(o.rooms) || 0, roomRev: N(o.roomRev) || 0 }));
    S.perf.at = j.at || new Date().toISOString(); lastLoad = Date.now();
    try { localStorage.setItem(LS, JSON.stringify({ daily: S.perf.daily, otb: S.perf.otb, at: S.perf.at })); } catch (e) { /* kota */ }
  } catch (e) {
    S.perf.err = e && e.message ? e.message : 'Bağlantı kurulamadı.';
  } finally {
    S.perf.loading = false;
    if (['perf', 'pano', 'builder'].includes(S.view) && A._renderView) A._renderView();
  }
}
A._loadPerf = loadPerf;

function demoData() {
  // demo: son 400 gün için iki otelde gerçekçi örnek veri
  const t = today(); const daily = []; const otb = [];
  const seas = (d) => { const m = Number(d.slice(5, 7)); return [0.12, 0.15, 0.22, 0.35, 0.55, 0.75, 0.92, 0.95, 0.72, 0.4, 0.14, 0.12][m - 1]; };
  for (let i = 400; i >= 1; i--) {
    const d = addDays(t, -i);
    [['ortunc', 40, 9000], ['elia', 17, 5200]].forEach(([h, cap, base], hi) => {
      const w = new Date(d + 'T12:00:00').getDay(); const f = Math.min(1, seas(d) * (w === 5 || w === 6 ? 1.18 : 0.95) * (0.9 + ((i * 7 + hi * 3) % 11) / 50));
      const occ = Math.round(cap * f); const adr = Math.round(base * (0.6 + seas(d)) * (1 + ((i + hi) % 5) / 40)); const roomRev = occ * adr; const fbRev = Math.round(roomRev * (h === 'ortunc' ? 0.55 : 0.18));
      daily.push({ key: `${h}_${d}`, hotel: h, date: d, rooms: cap, occ, occPct: Math.round((occ / cap) * 1000) / 10, pax: occ * 2, arr: Math.round(occ / 2), dep: Math.round(occ / 2), newRes: (i * 3 + hi) % 6, cxl: (i + hi) % 3 === 0 ? 1 : 0, adr: occ ? adr : 0, revpar: Math.round(roomRev / cap), roomRev, fbRev, bfRev: Math.round(occ * (h === 'ortunc' ? 3600 : 1200)), otherRev: Math.round(roomRev * 0.03), totalRev: Math.round(roomRev * (h === 'ortunc' ? 1.58 : 1.21)) });
    });
  }
  const last = addDays(t, -1);
  ['ortunc', 'elia'].forEach((h) => {
    const rows = daily.filter((r) => r.hotel === h); const y = last.slice(0, 4), m = last.slice(0, 7);
    const lastRow = rows.find((r) => r.date === last); const sum = (arr, k) => arr.reduce((s, r) => s + (r[k] || 0), 0);
    [['_mtd', rows.filter((r) => r.date.startsWith(m))], ['_ytd', rows.filter((r) => r.date.startsWith(y))]].forEach(([suf, arr]) => {
      ['rooms', 'occ', 'pax', 'arr', 'roomRev', 'fbRev', 'otherRev', 'totalRev'].forEach((k) => { lastRow[k + suf] = sum(arr, k); });
      lastRow['occPct' + suf] = Math.round((lastRow['occ' + suf] / lastRow['rooms' + suf]) * 1000) / 10; lastRow['adr' + suf] = Math.round(lastRow['roomRev' + suf] / Math.max(1, lastRow['occ' + suf])); lastRow['revpar' + suf] = Math.round(lastRow['roomRev' + suf] / lastRow['rooms' + suf]);
    });
    for (let i = 0; i < 45; i++) { const d = addDays(t, i); const cap = h === 'ortunc' ? 40 : 17; const rm = Math.max(0, Math.round(cap * seas(d) * Math.max(0.1, 1 - i / 50))); otb.push({ hotel: h, asOf: last, date: d, rooms: rm, roomRev: rm * (h === 'ortunc' ? 9500 : 4800) }); }
  });
  Object.assign(S.perf, { daily, otb, at: new Date().toISOString() });
}

/* ---------- hesap ---------- */
const SUMK = ['rooms', 'occ', 'pax', 'arr', 'dep', 'newRes', 'cxl', 'roomRev', 'fbRev', 'otherRev', 'totalRev'];
// isteğe bağlı alanlar: tüm günlerde varsa toplanır, eksikse boş kalır (eski / geçmiş kayıtlarda kahvaltı ve brüt yok)
const OPTK = ['bfRev', 'roomRevG', 'bfRevG', 'fbRevG', 'totalRevG'];
// vergi çarpanları: oda ve pansiyon kahvaltı = KDV + konaklama vergisi (Opera brüt raporuyla aynı: net × 1,11); restoran = KDV
export const TAXF = () => { const c = taxCfg(); return { pkg: 1 + (Number(c.kdv) + Number(c.kv)) / 100, fb: 1 + Number(c.kdv) / 100, kdv: c.kdv, kv: c.kv }; };
const pickSuf = (r, suf) => {
  const o = {}; [...SUMK, ...OPTK].forEach((k) => { const v = r[k + suf]; o[k] = v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v); });
  // brüt rapor yoksa net tutara vergiler eklenerek hesaplanır
  const f = TAXF();
  if (o.roomRevG == null && o.roomRev != null) { o.roomRevG = o.roomRev * f.pkg; o.est = true; }
  if (o.bfRevG == null && o.bfRev != null) { o.bfRevG = o.bfRev * f.pkg; o.est = true; }
  if (o.fbRevG == null && o.fbRev != null) { o.fbRevG = (o.bfRev || 0) * f.pkg + Math.max(0, o.fbRev - (o.bfRev || 0)) * f.fb; o.est = true; }
  if (o.totalRevG == null && o.totalRev != null) { o.totalRevG = (o.roomRevG || 0) + (o.fbRevG || 0) + (o.otherRev || 0) * f.fb; o.est = true; }
  return o;
};
function agg(items) {
  const a = { n: items.length }; const S2 = (arr, k) => arr.reduce((s, x) => s + (x[k] || 0), 0);
  SUMK.forEach((k) => { a[k] = S2(items, k); });
  OPTK.forEach((k) => { a[k] = items.length && items.every((x) => x[k] != null) ? S2(items, k) : null; });
  a.occPct = a.rooms ? (a.occ / a.rooms) * 100 : null; a.adr = a.occ ? a.roomRev / a.occ : null; a.revpar = a.rooms ? a.roomRev / a.rooms : null;
  a.adrG = a.roomRevG != null && a.occ ? a.roomRevG / a.occ : null; a.revparG = a.roomRevG != null && a.rooms ? a.roomRevG / a.rooms : null;
  // satış ADR = (oda + pansiyon kahvaltı) / satılan oda — yalnızca kahvaltı tutarı bilinen günlerden
  const wb = items.filter((x) => x.bfRev != null && x.occ); const ob = S2(wb, 'occ'); a.sadr = ob ? (S2(wb, 'roomRev') + S2(wb, 'bfRev')) / ob : null;
  const wg = items.filter((x) => x.bfRevG != null && x.roomRevG != null && x.occ); const og = S2(wg, 'occ'); a.sadrG = og ? (S2(wg, 'roomRevG') + S2(wg, 'bfRevG')) / og : null;
  a.bfpr = ob ? S2(wb, 'bfRev') / ob : null; a.bfprG = og ? S2(wg, 'bfRevG') / og : null; // oda başına kahvaltı
  a.restRev = a.bfRev != null ? a.fbRev - a.bfRev : null; a.restRevG = a.bfRevG != null && a.fbRevG != null ? a.fbRevG - a.bfRevG : null;
  a.est = items.some((x) => x.est);
  return a;
}
export const sumRows = (rows) => agg(rows.map((r) => pickSuf(r, '')));
export const hotelsOf = (h) => (h === 'all' ? Object.keys(HOTELS) : [h]);
export const rowsOf = (h, a, b) => S.perf.daily.filter((r) => hotelsOf(h).includes(r.hotel) && r.date >= a && r.date <= b);
export const lastDate = (h) => sortBy(S.perf.daily.filter((r) => hotelsOf(h).includes(r.hotel)), (r) => r.date, -1).map((r) => r.date)[0] || '';
const ly = (d) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;
// raporun kendi dönem toplamları (ay/yıl): satırdaki _mtd/_ytd alanları; yoksa saklanan günlerden
export function period(h, d, suf) {
  const pick = hotelsOf(h).map((ht) => S.perf.daily.find((r) => r.hotel === ht && r.date === d)).filter(Boolean);
  const from = suf === '_mtd' ? d.slice(0, 8) + '01' : d.slice(0, 5) + '01-01';
  if (pick.length === hotelsOf(h).length && pick.every((r) => r['occ' + suf] != null && r['rooms' + suf] != null)) {
    return Object.assign(agg(pick.map((r) => pickSuf(r, suf))), { src: 'rapor' });
  }
  return Object.assign(sumRows(rowsOf(h, from, d)), { src: 'kayit' });
}
export function periodLy(h, d, suf) {
  const from = suf === '_mtd' ? ly(d).slice(0, 8) + '01' : ly(d).slice(0, 5) + '01-01';
  const stored = rowsOf(h, from, ly(d)); const days = Math.round((new Date(ly(d)) - new Date(from)) / 864e5) + 1;
  if (stored.length >= days * hotelsOf(h).length * 0.9) return Object.assign(sumRows(stored), { src: 'kayit' });
  if (h === 'ortunc') { const r = S.perf.daily.find((x) => x.hotel === 'ortunc' && x.date === d); const lsuf = suf === '_mtd' ? '_lymtd' : '_lyytd'; if (r && r['occ' + lsuf] != null) return Object.assign(agg([pickSuf(r, lsuf)]), { src: 'rapor' }); }
  return null;
}
export function dayLy(h, d) {
  const stored = rowsOf(h, ly(d), ly(d)); if (stored.length === hotelsOf(h).length) return sumRows(stored);
  if (h === 'ortunc') { const r = S.perf.daily.find((x) => x.hotel === 'ortunc' && x.date === d); if (r && r.occ_ly != null) return agg([pickSuf(r, '_ly')]); }
  return null;
}

/* ---------- biçim ---------- */
const kmoney = (v) => (v == null ? '—' : Math.abs(v) >= 1e6 ? `₺${(v / 1e6).toFixed(2).replace('.', ',')} mn` : money(Math.round(v)));
const pct = (v) => (v == null ? '—' : `%${(Math.round(v * 10) / 10).toFixed(1).replace('.', ',')}`);
const chg = (a, b, isPct) => {
  if (a == null || b == null || (!b && !isPct)) return '<span class="muted">—</span>';
  const p = isPct ? a - b : ((a - b) / Math.abs(b)) * 100; const up = p >= 0;
  return `<span class="dl-${up ? 'up' : 'dn'}">${up ? '▲' : '▼'} ${isPct ? `${Math.abs(p).toFixed(1).replace('.', ',')} puan` : `%${Math.abs(p).toFixed(1).replace('.', ',')}`}</span>`;
};
const METRICS = [['occPct', 'Doluluk', pct, true], ['occ', 'Satılan oda', (v) => (v == null ? '—' : fmtNum(v))], ['adr!', 'Oda ADR<div class="sub">net</div>', kmoney], ['adrG!', 'Oda ADR<div class="sub">brüt</div>', kmoney], ['sadr!', 'Satış ADR<div class="sub">oda + kahvaltı, net</div>', kmoney], ['sadrG!', 'Satış ADR<div class="sub">oda + kahvaltı, brüt</div>', kmoney], ['revpar', 'RevPAR', kmoney], ['roomRev', 'Oda geliri', kmoney], ['bfRev', 'Kahvaltı<div class="sub">pansiyon</div>', kmoney], ['restRev', 'Restoran / Y-İ<div class="sub">kahvaltı hariç</div>', kmoney], ['totalRev', 'Toplam gelir', kmoney]];
const GK = { adr: 'adrG', revpar: 'revparG', roomRev: 'roomRevG', fbRev: 'fbRevG', totalRev: 'totalRevG', sadr: 'sadrG', bfRev: 'bfRevG', restRev: 'restRevG', bfpr: 'bfprG' };
export const mk = (k, mode) => (k.endsWith('!') ? k.slice(0, -1) : (mode || S.perf.mode) === 'gross' ? GK[k] || k : k);

function bars(series, opts = {}) {
  // series: [{label, v, lyv, title}] -> SVG sütun grafiği
  const W = 760, H = opts.h || 200, pb = 24, pt = 10; const n = Math.max(1, series.length); const cw = W / n;
  const max = Math.max(opts.max || 0, 1, ...series.map((s) => Math.max(s.v || 0, s.lyv || 0)));
  const y = (v) => pt + (H - pt - pb) * (1 - (v || 0) / max);
  const bw = Math.max(2, Math.min(22, cw * (series.some((s) => s.lyv != null) ? 0.38 : 0.7)));
  let g = ''; for (let i = 0; i <= 3; i++) { const yy = pt + ((H - pt - pb) * i) / 3; g += `<line x1="0" x2="${W}" y1="${yy}" y2="${yy}" stroke="#E2E7EF"/>`; }
  const every = Math.ceil(n / 16);
  series.forEach((s, i) => {
    const x = cw * i + cw / 2; const two = s.lyv != null;
    if (two) g += `<rect x="${x - bw - 1}" y="${y(s.lyv)}" width="${bw}" height="${H - pb - y(s.lyv)}" fill="#CBD5E2" rx="1.5"><title>${esc(s.label)} geçen yıl: ${esc(opts.fmt ? opts.fmt(s.lyv) : s.lyv)}</title></rect>`;
    g += `<rect x="${two ? x + 1 : x - bw / 2}" y="${y(s.v)}" width="${bw}" height="${H - pb - y(s.v)}" fill="${s.fill || 'var(--primary)'}" rx="1.5"><title>${esc(s.title || s.label)}: ${esc(opts.fmt ? opts.fmt(s.v) : s.v)}</title></rect>`;
    if (i % every === 0) g += `<text x="${x}" y="${H - 7}" font-size="10.5" text-anchor="middle" fill="#69768D">${esc(s.label)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${H + 20}px" role="img" aria-label="${esc(opts.aria || 'Grafik')}">${g}</svg>`;
}

/* ---------- ekran ---------- */
V.perf = {
  title: () => 'Otel performansı',
  head: () => `<button class="btn" data-act="perfReload" title="Yenile">${ic('download')}<span class="hide-m"> Yenile</span></button><button class="btn" data-act="perfExcel">${ic('table')}<span class="hide-m"> Excel</span></button><button class="btn" data-act="perfPrint">${ic('printer')}<span class="hide-m"> PDF</span></button>`,
  body: () => {
    loadPerf();
    const P = S.perf; const c = cfg();
    if (!P.daily.length) {
      if (S.store.kind !== 'local' && (!c.url || !c.token)) return `<div class="empty"><b>Gece raporu bağlantısı kurulmadı</b>Yönetici Ayarlar → Genel → "Otel performans verisi" bölümünden bağlantı adresini girdiğinde Ortunç ve Elia'nın günlük doluluk ve gelirleri burada görünür.${can.admin() ? `<div style="margin-top:12px"><button class="btn pri" data-act="perfSetup">${ic('pencil')} Bağlantıyı gir</button></div>` : ''}</div>`;
      return `<div class="empty"><b>${P.loading ? 'Veriler yükleniyor…' : P.err ? 'Veri alınamadı' : 'Henüz veri yok'}</b>${esc(P.err || (P.loading ? '' : 'İlk gece raporu işlendiğinde burada görünecek.'))}</div>`;
    }
    const G = P.mode === 'gross'; const TF = TAXF();
    const h = P.hotel || 'all'; const ld = lastDate(h); const d = P.date && P.date <= ld ? P.date : ld;
    const day = sumRows(rowsOf(h, d, d)); const dly = dayLy(h, d);
    const mtd = period(h, d, '_mtd'), mly = periodLy(h, d, '_mtd'), ytd = period(h, d, '_ytd'), yly = periodLy(h, d, '_ytd');
    // son 30 gün
    const days30 = Array.from({ length: 30 }, (_, i) => addDays(d, i - 29));
    const s30 = days30.map((x) => { const r = rowsOf(h, x, x); const a = r.length ? sumRows(r) : null; const l = rowsOf(h, ly(x), ly(x)); return { label: x.slice(8, 10), v: a ? a.occPct : 0, lyv: l.length ? sumRows(l).occPct : null, title: fmtDate(x) }; });
    // aylar (seçilen yıl)
    const yr = d.slice(0, 4);
    const months = Array.from({ length: 12 }, (_, i) => { const m = `${yr}-${String(i + 1).padStart(2, '0')}`; const r = rowsOf(h, `${m}-01`, `${m}-31`); const l = rowsOf(h, `${Number(yr) - 1}-${m.slice(5)}-01`, `${Number(yr) - 1}-${m.slice(5)}-31`); return { m, label: MON3[i], a: r.length ? sumRows(r) : null, l: l.length ? sumRows(l) : null }; });
    // OTB
    const cap = hotelsOf(h).reduce((s, ht) => s + ((sortBy(P.daily.filter((r) => r.hotel === ht), (r) => r.date, -1)[0] || {}).rooms || 0), 0);
    const t0 = today(); const otbDays = Array.from({ length: 30 }, (_, i) => addDays(t0, i));
    const otbS = otbDays.map((x) => { const o = P.otb.filter((r) => hotelsOf(h).includes(r.hotel) && r.date === x); const rm = o.reduce((s, r) => s + r.rooms, 0); return { label: x.slice(8, 10), v: cap ? (rm / cap) * 100 : 0, title: `${fmtDate(x)} · ${rm} oda`, rm, rev: o.reduce((s, r) => s + r.roomRev, 0) }; });
    const otbRm = otbS.reduce((s, x) => s + x.rm, 0), otbRev = otbS.reduce((s, x) => s + x.rev, 0); const asOf = sortBy(P.otb.filter((r) => hotelsOf(h).includes(r.hotel)), (r) => r.asOf, -1).map((r) => r.asOf)[0];
    const cmpRow = (lab, a, l) => `<tr><td>${lab}</td>${METRICS.map(([k0, , f, isP]) => { const k = mk(k0); return `<td class="n">${a ? f(a[k]) : '—'}<div class="sub">${l && l[k] != null ? `${f(l[k])} · ${chg(a && a[k], l[k], isP)}` : ''}</div></td>`; }).join('')}</tr>`;
    S.perfLast = { h, d, day, dly, mtd, mly, ytd, yly, months, otbS };
    return `<div class="perf">
      <div class="perfbar"><div class="seg" role="group" aria-label="Otel">${[['all', 'İki otel'], ...Object.entries(HOTELS)].map(([k, l]) => `<button class="${h === k ? 'on' : ''}" data-act="perfHotel" data-h="${k}" aria-pressed="${h === k}">${esc(l)}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Tutarlar"><button class="${G ? '' : 'on'}" data-act="perfMode" data-m="net" aria-pressed="${!G}">Net</button><button class="${G ? 'on' : ''}" data-act="perfMode" data-m="gross" aria-pressed="${G}">Brüt</button></div>
        <label class="perfdate">İş günü <input type="date" class="inp" value="${esc(d)}" max="${esc(ld)}" data-change="perfDate" aria-label="İş günü"></label>
        <span class="muted" style="font-size:12.5px;margin-left:auto">${P.loading ? 'güncelleniyor…' : P.err ? `<span style="color:#B4432E">${esc(P.err)}</span>` : P.at ? `son güncelleme ${esc(new Date(P.at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }))}` : ''}</span></div>
      <div class="kband">
        <div class="kb"><small>Doluluk · ${esc(fmtDate(d))}</small><b>${pct(day.occPct)}</b>${dly ? `<em>${chg(day.occPct, dly.occPct, true)} geçen yıl ${pct(dly.occPct)}</em>` : '<em>geçen yıl verisi yok</em>'}<span class="kfoot">${fmtNum(day.occ)} / ${fmtNum(day.rooms)} oda</span></div>
        ${[['adr', 'adrG', 'Oda ADR', 'yalnız oda'], ['sadr', 'sadrG', 'Satış ADR', 'oda + kahvaltı'], ['bfpr', 'bfprG', 'Kahvaltı / oda', 'pansiyon kahvaltı']].map(([kn, kg, l, sub]) => `<div class="kb"><small>${l} · ${sub}</small><b>${kmoney(day[kn])}</b><em>brüt <b class="gb">${kmoney(day[kg])}</b></em>${dly && dly[kn] != null ? `<span class="kfoot">${chg(day[kn], dly[kn])} geçen yıl ${kmoney(dly[kn])}</span>` : ''}</div>`).join('')}
        ${[['roomRev', 'Oda geliri'], ['totalRev', 'Toplam gelir']].map(([k0, l]) => { const k = mk(k0); return `<div class="kb"><small>${l} · ${G ? 'brüt' : 'net'}</small><b>${kmoney(day[k])}</b>${dly && dly[k] != null ? `<em>${chg(day[k], dly[k])} geçen yıl ${kmoney(dly[k])}</em>` : '<em>geçen yıl verisi yok</em>'}</div>`; }).join('')}
      </div>
      <div class="card" style="margin-bottom:14px"><div class="pad" style="padding-bottom:6px"><h3 style="margin:0">Gün, ay ve yıl · geçen yılla</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">Alt satırda geçen yılın aynı dönemi ve değişim. Tutarlar ${G ? 'vergiler dahil (brüt)' : 'vergiler hariç (net)'}, ₺. Satış ADR = (oda + pansiyon kahvaltı) ÷ satılan oda. Brüt: oda ve kahvaltıya KDV %${TF.kdv} + konaklama vergisi %${TF.kv}, restorana KDV %${TF.kdv}${day.est || mtd.est ? '; brüt raporu olmayan günlerde bu oranlarla hesaplandı' : ''}.</p></div>
        <div class="scroll-x"><table class="tb perf-t"><tr><th></th>${METRICS.map(([, l]) => `<th class="n">${l}</th>`).join('')}</tr>
        ${cmpRow(`Gün<div class="sub">${esc(fmtDate(d))}</div>`, day, dly)}${cmpRow(`Ay başından<div class="sub">${esc(MONTHS[Number(d.slice(5, 7)) - 1])}</div>`, mtd, mly)}${cmpRow(`Yıl başından<div class="sub">${esc(yr)}</div>`, ytd, yly)}</table></div></div>
      <div class="grid g2">
        <div class="card pad"><h3>Doluluk · son 30 gün</h3>${bars(s30, { fmt: pct, max: 100, aria: 'Son 30 gün doluluk' })}<p class="muted" style="font-size:12px;margin:2px 0 0">Koyu: ${yr} · gri: geçen yılın aynı günü</p></div>
        <div class="card pad"><h3>Önümüzdeki 30 gün · kesin rezervasyon</h3>${asOf ? `${bars(otbS, { fmt: pct, max: 100, aria: 'Önümüzdeki 30 gün doluluk' })}<p class="muted" style="font-size:12px;margin:2px 0 0">${fmtNum(otbRm)} oda-gece · ${kmoney(otbRev)} oda geliri · ${esc(fmtDate(asOf))} raporuna göre</p>` : '<span class="muted">Forecast raporu işlenmedi.</span>'}</div>
        <div class="card" style="grid-column:1/-1"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">${esc(yr)} aylık · geçen yılla</h3></div>
          <div class="pad" style="padding-top:4px">${bars(months.map((m) => ({ label: m.label, v: m.a ? m.a.roomRev : 0, lyv: m.l ? m.l.roomRev : 0 })), { fmt: kmoney, aria: 'Aylık oda geliri' })}<p class="muted" style="font-size:12px;margin:2px 0 8px">Oda geliri · koyu: ${yr} · gri: ${Number(yr) - 1}. Yalnızca işlenmiş gece raporlarındaki günler toplanır.</p></div>
          <div class="scroll-x"><table class="tb perf-t"><tr><th>Ay</th><th class="n">Gün</th><th class="n">Doluluk</th><th class="n">Oda-gece</th><th class="n">Oda ADR<div class="sub">net · brüt</div></th><th class="n">Satış ADR<div class="sub">net · brüt</div></th><th class="n">RevPAR</th><th class="n">Oda geliri</th><th class="n">Kahvaltı</th><th class="n">Restoran / Y-İ</th><th class="n">Toplam gelir</th><th class="n">Toplam · geçen yıl</th></tr>
          ${months.filter((m) => m.a || m.l).map((m) => `<tr><td>${esc(MONTHS[Number(m.m.slice(5)) - 1])}</td><td class="n">${m.a ? m.a.n / hotelsOf(h).length : 0}</td><td class="n">${m.a ? pct(m.a.occPct) : '—'}</td><td class="n">${m.a ? fmtNum(m.a.occ) : '—'}</td><td class="n">${m.a ? `${kmoney(m.a.adr)}<div class="sub">${kmoney(m.a.adrG)}</div>` : '—'}</td><td class="n">${m.a && m.a.sadr != null ? `${kmoney(m.a.sadr)}<div class="sub">${kmoney(m.a.sadrG)}</div>` : '—'}</td><td class="n">${m.a ? kmoney(m.a[mk('revpar')]) : '—'}</td><td class="n">${m.a ? kmoney(m.a[mk('roomRev')]) : '—'}</td><td class="n">${m.a && m.a.bfRev != null ? kmoney(m.a[G ? 'bfRevG' : 'bfRev']) : '—'}</td><td class="n">${m.a ? kmoney(m.a.restRev != null ? m.a[G ? 'restRevG' : 'restRev'] : m.a[mk('fbRev')]) : '—'}</td><td class="n"><b>${m.a ? kmoney(m.a[mk('totalRev')]) : '—'}</b></td><td class="n">${m.l ? `${kmoney(m.l[mk('totalRev')])} ${m.a ? chg(m.a[mk('totalRev')], m.l[mk('totalRev')]) : ''}` : '—'}</td></tr>`).join('') || `<tr><td colspan="11" class="muted">Bu yıl için işlenmiş gün yok.</td></tr>`}</table></div></div>
      </div></div>`;
  },
};
A.perfHotel = (el) => { S.perf.hotel = el.dataset.h; A._renderView(); };
A.perfMode = (el) => { S.perf.mode = el.dataset.m; A._renderView(); };
A.perfDate = (el) => { S.perf.date = el.value; A._renderView(); };
A.perfReload = () => { loadPerf(true); toast('Veriler yenileniyor…'); A._renderView(); };
A.perfSetup = () => {
  const c = cfg();
  openForm({ title: 'Otel performans verisi', data: { url: c.url || '', token: c.token || '' }, fields: [
    { k: 'url', label: 'Web uygulaması adresi', req: true, ph: 'https://script.google.com/macros/s/…/exec' },
    { k: 'token', label: 'Erişim anahtarı', req: true },
  ], onSave: async (v) => {
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(v.url.trim())) throw new Error('Adres https://script.google.com/… ile başlamalı.');
    await S.store.save('settings', { ...S.settings, id: 'main', perf: { url: v.url.trim(), token: v.token.trim() } });
    lastLoad = 0; setTimeout(() => loadPerf(true), 300); toast('Bağlantı kaydedildi; veriler yükleniyor');
  } });
};
A._perfSettingsCard = () => {
  const c = cfg(); const P = S.perf; const n = P.daily.length; const last = n ? sortBy(P.daily, (r) => r.date, -1)[0].date : '';
  return `<div class="card pad"><h3>Otel performans verisi</h3><p class="muted" style="margin-top:0">Ortunç ve Elia gece raporları her sabah otomatik işlenir; doluluk, ADR, RevPAR ve gelirler "Otel performansı" ekranına ve rapor oluşturucuya gelir.</p>
    <dl class="dl"><dt>Bağlantı</dt><dd>${c.url ? '<span class="badge olive">Kurulu</span>' : '<span class="badge gold">Kurulmadı</span>'}</dd><dt>Kayıtlı gün</dt><dd>${n ? `${fmtNum(n)} satır · son iş günü ${esc(fmtDate(last))}` : '—'}</dd></dl>
    ${can.admin() ? `<div style="margin-top:12px"><button class="btn" data-act="perfSetup">${ic('pencil')} ${c.url ? 'Değiştir' : 'Bağlantıyı gir'}</button></div>` : ''}</div>`;
};
A.perfExcel = () => {
  const P = S.perf; if (!P.daily.length) return toast('Aktarılacak veri yok.');
  const cols = [['hotel', 'Otel'], ['date', 'Tarih'], ['rooms', 'Oda kapasitesi'], ['occ', 'Satılan oda'], ['occPct', 'Doluluk %'], ['pax', 'Kişi'], ['arr', 'Giriş (oda)'], ['dep', 'Çıkış (oda)'], ['newRes', 'Yeni rezervasyon'], ['cxl', 'İptal'], ['adr', 'Oda ADR net'], ['adrG', 'Oda ADR brüt'], ['sadr', 'Satış ADR net (oda+kahvaltı)'], ['sadrG', 'Satış ADR brüt (oda+kahvaltı)'], ['revpar', 'RevPAR net'], ['roomRev', 'Oda geliri net'], ['roomRevG', 'Oda geliri brüt'], ['bfRev', 'Kahvaltı net'], ['bfRevG', 'Kahvaltı brüt'], ['restRev', 'Restoran / Y-İ net (kahvaltı hariç)'], ['restRevG', 'Restoran / Y-İ brüt'], ['otherRev', 'Diğer gelir net'], ['totalRev', 'Toplam gelir net'], ['totalRevG', 'Toplam gelir brüt']];
  const r2 = (v) => (v == null || Number.isNaN(v) ? '' : Math.round(v * 100) / 100);
  const rows = sortBy(P.daily.filter((r) => hotelsOf(P.hotel || 'all').includes(r.hotel)), (r) => r.date + r.hotel).map((r) => { const a = Object.assign(sumRows([r]), { rooms: r.rooms, occPct: r.occPct }); return cols.map(([k]) => (k === 'hotel' ? HOTELS[r.hotel] || r.hotel : k === 'date' ? r.date : ['pax', 'arr', 'dep', 'newRes', 'cxl'].includes(k) ? (r[k] ?? '') : r2(a[k]))); });
  const ws = XLSX.utils.aoa_to_sheet([cols.map((c) => c[1]), ...rows]); ws['!cols'] = cols.map(([, l]) => ({ wch: Math.max(11, l.length + 2) }));
  const ot = XLSX.utils.aoa_to_sheet([['Otel', 'Rapor tarihi', 'Konaklama günü', 'Oda', 'Oda geliri'], ...sortBy(P.otb, (o) => o.hotel + o.date).map((o) => [HOTELS[o.hotel] || o.hotel, o.asOf, o.date, o.rooms, o.roomRev])]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Günlük'); XLSX.utils.book_append_sheet(wb, ot, 'Gelecek rezervasyonlar');
  saveFile(`Otel-performansi-${today()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
};
A.perfPrint = () => {
  const L = S.perfLast; if (!L) return;
  const tr = (lab, a, l) => `<tr><td>${lab}</td>${METRICS.map(([k0, , f, isP]) => { const k = mk(k0); return `<td class="n">${a ? f(a[k]) : '—'}${l && l[k] != null ? `<br><small>${f(l[k])} · ${chg(a && a[k], l[k], isP).replace(/<[^>]+>/g, '')}</small>` : ''}</td>`; }).join('')}</tr>`;
  const html = `<div class="pdoc"><div class="ph"><b>${esc(S.settings.hotelName)}</b><span>${esc(fmtDate(today()))} · ${esc(S.user.name)}</span></div><h1>Otel performansı · ${esc(L.h === 'all' ? 'Ortunç + Elia' : HOTELS[L.h])}</h1><p class="sub">İş günü ${esc(fmtDate(L.d))} · gelirler ${S.perf.mode === 'gross' ? 'brüt (vergiler dahil)' : 'net (vergiler hariç)'}, ₺ · ADR'ler net ve brüt · alt satır: geçen yıl</p>
    <table class="tb"><tr><th></th>${METRICS.map(([, l]) => `<th class="n">${l}</th>`).join('')}</tr>${tr('Gün', L.day, L.dly)}${tr('Ay başından', L.mtd, L.mly)}${tr('Yıl başından', L.ytd, L.yly)}</table>
    <h2>Aylık</h2><table class="tb"><tr><th>Ay</th><th class="n">Doluluk</th><th class="n">Oda-gece</th><th class="n">ADR</th><th class="n">Oda geliri</th><th class="n">Toplam gelir</th><th class="n">Geçen yıl toplam</th></tr>${L.months.filter((m) => m.a || m.l).map((m) => `<tr><td>${esc(MONTHS[Number(m.m.slice(5)) - 1])}</td><td class="n">${m.a ? pct(m.a.occPct) : '—'}</td><td class="n">${m.a ? fmtNum(m.a.occ) : '—'}</td><td class="n">${m.a ? kmoney(m.a.adr) : '—'}</td><td class="n">${m.a ? kmoney(m.a.roomRev) : '—'}</td><td class="n">${m.a ? kmoney(m.a.totalRev) : '—'}</td><td class="n">${m.l ? kmoney(m.l.totalRev) : '—'}</td></tr>`).join('')}</table></div>`;
  printHtml(`Otel-performansi-${L.d}`, html);
};

/* ---------- pano kartı ---------- */
A._perfWidget = () => {
  loadPerf();
  const P = S.perf; if (!P.daily.length) return '';
  const d = lastDate('all');
  const rowsH = Object.keys(HOTELS).map((ht) => { const r = rowsOf(ht, d, d); return r.length ? [ht, sumRows(r), dayLy(ht, d), period(ht, d, '_mtd')] : null; }).filter(Boolean);
  return `<div class="card"><div class="pad" style="padding-bottom:4px;display:flex;align-items:center"><h3 style="margin:0;flex:1">Dün otelde · ${esc(fmtDate(d))}</h3><button class="btn sm" data-act="nav" data-v="perf">${ic('bed')} Otel performansı</button></div>
    <div class="scroll-x"><table class="tb perf-t"><tr><th>Otel</th><th class="n">Doluluk</th><th class="n">ADR</th><th class="n">Oda geliri</th><th class="n">Toplam</th><th class="n">Ay doluluk</th></tr>
    ${rowsH.map(([ht, a, l, m]) => `<tr><td>${esc(HOTELS[ht])}</td><td class="n">${pct(a.occPct)}<div class="sub">${l ? chg(a.occPct, l.occPct, true) : ''}</div></td><td class="n">${kmoney(a.adr)}</td><td class="n">${kmoney(a.roomRev)}</td><td class="n">${kmoney(a.totalRev)}<div class="sub">${l ? chg(a.totalRev, l.totalRev) : ''}</div></td><td class="n">${pct(m.occPct)}</td></tr>`).join('')}</table></div></div>`;
};

/* ---------- rapor oluşturucu veri seti ---------- */
A._perfDataset = () => ({
  label: 'Otel performansı (gece raporları)', dates: [['date', 'İş günü']],
  dims: () => [['hotel', 'Otel'], ['weekday', 'Hafta içi / sonu']],
  metrics: () => ({ occPct: ['Doluluk %', 'p'], rn: ['Satılan oda (oda-gece)', 'n'], cap: ['Oda kapasitesi', 'n'], adr: ['Oda ADR (net)', 'd'], adrG: ['Oda ADR (brüt)', 'd'], sadr: ['Satış ADR oda+kahvaltı (net)', 'd'], sadrG: ['Satış ADR oda+kahvaltı (brüt)', 'd'], revpar: ['RevPAR (net)', 'd'], oda: ['Oda geliri (net)', 'm'], odaG: ['Oda geliri (brüt)', 'm'], bf: ['Kahvaltı geliri (net)', 'm'], bfG: ['Kahvaltı geliri (brüt)', 'm'], fb: ['Yiyecek-içecek geliri (net)', 'm'], other: ['Diğer gelir', 'm'], net: ['Toplam gelir (net)', 'm'], netG: ['Toplam gelir (brüt)', 'm'], pax: ['Konaklayan kişi', 'n'], arr: ['Giriş (oda)', 'n'], newRes: ['Yeni rezervasyon', 'n'], cxl: ['İptal', 'n'], count: ['Gün sayısı', 'n'] }),
  rows: () => { loadPerf(); return S.perf.daily.map((r) => { const w = new Date(r.date + 'T12:00:00').getDay(); return {
    dates: { date: r.date }, dims: { hotel: HOTELS[r.hotel] || r.hotel, weekday: w === 5 || w === 6 ? 'Cuma-Cumartesi' : 'Pazar-Perşembe' },
    amt: (() => { const a = sumRows([r]); return { oda: { TRY: a.roomRev || 0 }, odaG: { TRY: a.roomRevG || 0 }, bf: { TRY: a.bfRev || 0 }, bfG: { TRY: a.bfRevG || 0 }, fb: { TRY: a.fbRev || 0 }, other: { TRY: a.otherRev || 0 }, net: { TRY: a.totalRev || 0 }, netG: { TRY: a.totalRevG || 0 } }; })(),
    n: { rn: r.occ || 0, cap: r.rooms || 0, pax: r.pax || 0, arr: r.arr || 0, newRes: r.newRes || 0, cxl: r.cxl || 0, count: 1, bfrn: r.bfRev != null && r.bfRev !== '' ? r.occ || 0 : 0 }, ref: null }; }); },
});

DS.perf = A._perfDataset();
QUICK.push(['Otel performansı · aylık (iki otel)', { ds: 'perf', dateField: 'date', period: 'thisYear', filters: [], groupBy: 'month', groupBy2: '', metrics: ['occPct', 'rn', 'adr', 'revpar', 'oda', 'net'], compare: 'prevYear', chart: 'bar' }]);
QUICK.push(['Otel performansı · otel bazında', { ds: 'perf', dateField: 'date', period: 'thisYear', filters: [], groupBy: 'hotel', groupBy2: '', metrics: ['occPct', 'rn', 'adr', 'revpar', 'oda', 'fb', 'net'], compare: 'prevYear', chart: 'bar' }]);
QUICK.push(['Otel performansı · hafta içi / sonu', { ds: 'perf', dateField: 'date', period: 'last12', filters: [], groupBy: 'weekday', groupBy2: 'hotel', metrics: ['occPct'], compare: 'none', chart: 'bar' }]);
