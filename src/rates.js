// Oda fiyatları: dönemlere göre Superior fiyatı + oda tipi çarpanları, hedef doluluk (oda-gece) ve hedef ADR,
// fiyat revizyonları (ilk fiyattan yıl sonuna), tahmini gelir, bütçe ve gerçekleşen karşılaştırması, kalan oda karışımı önerisi
import * as XLSX from 'xlsx';
import { S, A, V, $, $$, esc, ic, today, fmtDate, fmtNum, money, num, MONTHS, MON3, toast, can, errText, closeModal, stamp, confirmBox } from './core.js';
import { printHtml, saveFile } from './print.js';
import { budgetSeries } from './budget.js';

export const ELIA_TYPES = [
  { k: 'dlx', label: 'Deluxe', count: 0, mult: 1, bf: 2, nights: false },
  { k: 'exd', label: 'Executive DBL', count: 0, mult: 1.1428, bf: 2, nights: false },
  { k: 'ext', label: 'Executive TRPL', count: 0, mult: 1.2557, bf: 3, nights: false },
  { k: 'as', label: 'Elia Antique Suit', count: 0, mult: 1.5, bf: 2, nights: false },
  { k: 'ast', label: 'Elia Antique Suit Trpl', count: 0, mult: 1.6785, bf: 3, nights: false },
  { k: 'atd', label: 'Elia Antique Terrace Deluxe', count: 0, mult: 1.3928, bf: 2, nights: false },
  { k: 'ad', label: 'Elia Antique Deluxe', count: 0, mult: 1.2771, bf: 2, nights: false },
  { k: 'asr', label: 'Elia Antique Standart Room', count: 0, mult: 1.1785, bf: 2, nights: false },
  { k: 'house', label: 'Elia Antique House', count: 1, mult: 0, fixed: true, bf: 2, nights: false },
];
// "2027 Elia Rates": Deluxe fiyatı, Antique House ayrı fiyat, dönem başına toplam geceleme ve ADR
const SEED_ELIA_2027 = [
  ['Ocak', '01-01', '01-31', 4500, 11500, 40, 4500], ['Şubat', '02-01', '02-28', 4500, 11500, 40, 4500], ['Mart', '03-01', '03-31', 4500, 11500, 40, 5900],
  ['Mart (08-11) Ramazan Bayramı', '03-08', '03-11', 5800, 13500, 30, 6500], ['Nisan', '04-01', '04-30', 5250, 13500, 80, 6250], ['Mayıs', '05-01', '05-31', 6850, 14500, 190, 7100],
  ['Mayıs (15-19) Kurban Bayramı', '05-15', '05-19', 7250, 16500, 60, 7600], ['Haziran (01-14)', '06-01', '06-14', 7900, 18100, 85, 8000], ['Haziran (15-30)', '06-15', '06-30', 8100, 18100, 115, 8250],
  ['Temmuz', '07-01', '07-31', 9100, 20000, 310, 9500], ['Ağustos', '08-01', '08-31', 9850, 20000, 420, 11950], ['Eylül', '09-01', '09-30', 7100, 18500, 250, 8250],
  ['Ekim', '10-01', '10-31', 4890, 14500, 80, 6250], ['Kasım', '11-01', '11-30', 4850, 12500, 40, 5500], ['Aralık', '12-01', '12-29', 3250, 12500, 40, 5500], ['Aralık · Yılbaşı', '12-30', '12-31', 5800, 15500, 0, 0],
].map(([label, f, t, dlx, house, nt, adr], i) => ({ id: 'e' + (i + 1), label, from: `2027-${f}`, to: `2027-${t}`, days: 'all', spr: dlx, ov: { house }, nt, adr }));
export const DEF_TYPES = [
  { k: 'spr', label: 'Superior', count: 16, mult: 1, bf: 2, nights: true },
  { k: 'sprt', label: 'Superior Triple', count: 6, mult: 1.35, bf: 3, nights: true },
  { k: 'dlx', label: 'Deluxe', count: 14, mult: 1.3, bf: 2, nights: true },
  { k: 'suit', label: 'Suit', count: 3, mult: 1.74, bf: 2, nights: true },
  { k: 'suitt', label: 'Suit (3 kişi)', count: 0, mult: 2, bf: 3, nights: false },
  { k: 'ps', label: 'Panoramik Suit', count: 1, mult: 1.9, bf: 2, nights: true },
  { k: 'pst', label: 'Panoramik Suit (3 kişi)', count: 0, mult: 2.15, bf: 3, nights: false },
];
// "2027 doluluk ve fiyatlar (güncel).xlsx" · 2027 Erken Rezervasyon Fiyatlar (oda + kahvaltı, vergiler dahil)
const SEED_2027 = [{"label":"Ocak","from":"2027-01-01","to":"2027-01-31","days":"all","spr":11500,"n":{"spr":30,"sprt":5,"dlx":17,"suit":13,"ps":10},"adr":12000},{"label":"Şubat","from":"2027-02-01","to":"2027-02-28","days":"all","spr":11500,"n":{"spr":58,"sprt":10,"dlx":25,"suit":8,"ps":5},"adr":12000},{"label":"Mart (Hafta İçi)","from":"2027-03-01","to":"2027-03-31","days":"wd","spr":11500,"n":{"spr":55,"sprt":14,"dlx":16,"suit":11,"ps":3},"adr":12000},{"label":"Mart (Hafta Sonu)","from":"2027-03-01","to":"2027-03-31","days":"we","spr":12500,"n":{"spr":63,"sprt":17,"dlx":35,"suit":14,"ps":5},"adr":12250},{"label":"Mart (08-11) Ramazan Bayramı","from":"2027-03-08","to":"2027-03-11","days":"all","spr":15350,"n":{"spr":32,"sprt":7,"dlx":28,"suit":1,"ps":1},"adr":19000},{"label":"Nisan (Hafta İçi)","from":"2027-04-01","to":"2027-04-30","days":"wd","spr":13150,"n":{"spr":68,"sprt":11,"dlx":30,"suit":12,"ps":4},"adr":14500},{"label":"Nisan (Hafta Sonu)","from":"2027-04-01","to":"2027-04-30","days":"we","spr":14700,"n":{"spr":65,"sprt":10,"dlx":49,"suit":15,"ps":8},"adr":14900},{"label":"Mayıs (01-14) (Hafta İçi)","from":"2027-05-01","to":"2027-05-14","days":"wd","spr":18570,"n":{"spr":16,"sprt":2,"dlx":11,"suit":1,"ps":1},"adr":19200},{"label":"Mayıs (01-14) (Hafta Sonu)","from":"2027-05-01","to":"2027-05-14","days":"we","spr":19950,"n":{"spr":57,"sprt":7,"dlx":43,"suit":10,"ps":2},"adr":20500},{"label":"Mayıs (15-19) Kurban Bayramı","from":"2027-05-15","to":"2027-05-19","days":"all","spr":22000,"n":{"spr":100,"sprt":26,"dlx":61,"suit":25,"ps":7},"adr":23500},{"label":"Mayıs (20-31)","from":"2027-05-20","to":"2027-05-31","days":"all","spr":19950,"n":{"spr":57,"sprt":7,"dlx":43,"suit":10,"ps":2},"adr":21000},{"label":"Haziran (01-13)","from":"2027-06-01","to":"2027-06-13","days":"all","spr":22000,"n":{"spr":100,"sprt":26,"dlx":61,"suit":25,"ps":7},"adr":25000},{"label":"Haziran (14-20)","from":"2027-06-14","to":"2027-06-20","days":"all","spr":26180,"n":{"spr":65,"sprt":20,"dlx":39,"suit":17,"ps":8},"adr":29000},{"label":"Haziran (21-30)","from":"2027-06-21","to":"2027-06-30","days":"all","spr":28730,"n":{"spr":120,"sprt":40,"dlx":94,"suit":12,"ps":8},"adr":31500},{"label":"Temmuz (01-10)","from":"2027-07-01","to":"2027-07-10","days":"all","spr":34650,"n":{"spr":139,"sprt":45,"dlx":70,"suit":26,"ps":7},"adr":35500},{"label":"Temmuz (11-18)","from":"2027-07-11","to":"2027-07-18","days":"all","spr":40150,"n":{"spr":125,"sprt":47,"dlx":100,"suit":19,"ps":8},"adr":43150},{"label":"Temmuz (19-31)","from":"2027-07-19","to":"2027-07-31","days":"all","spr":46900,"n":{"spr":160,"sprt":65,"dlx":125,"suit":27,"ps":9},"adr":49250},{"label":"Ağustos (01-15)","from":"2027-08-01","to":"2027-08-15","days":"all","spr":46900,"n":{"spr":185,"sprt":86,"dlx":170,"suit":35,"ps":11},"adr":49260},{"label":"Ağustos (16-31)","from":"2027-08-16","to":"2027-08-31","days":"all","spr":43600,"n":{"spr":190,"sprt":84,"dlx":170,"suit":36,"ps":10},"adr":47000},{"label":"Eylül (01-12) (Hafta Sonu)","from":"2027-09-01","to":"2027-09-12","days":"we","spr":41850,"n":{"spr":62,"sprt":22,"dlx":55,"suit":12,"ps":4},"adr":44200},{"label":"Eylül (01-12) (Hafta İçi)","from":"2027-09-01","to":"2027-09-12","days":"wd","spr":38000,"n":{"spr":105,"sprt":37,"dlx":84,"suit":22,"ps":6},"adr":41000},{"label":"Eylül (13-30)","from":"2027-09-13","to":"2027-09-30","days":"all","spr":28100,"n":{"spr":165,"sprt":29,"dlx":54,"suit":25,"ps":3},"adr":35500},{"label":"Ekim","from":"2027-10-01","to":"2027-10-31","days":"all","spr":15350,"n":{"spr":32,"sprt":7,"dlx":28,"suit":1,"ps":1},"adr":15700},{"label":"Kasım","from":"2027-11-01","to":"2027-11-30","days":"all","spr":13150,"n":{"spr":68,"sprt":11,"dlx":30,"suit":12,"ps":4},"adr":13100},{"label":"Aralık","from":"2027-12-01","to":"2027-12-31","days":"all","spr":13150,"n":{"spr":68,"sprt":11,"dlx":30,"suit":12,"ps":4},"adr":13100}];
const DAYT = { all: 'Tüm günler', wd: 'Hafta içi', we: 'Hafta sonu (Cuma-Cumartesi)' };

/* ---------- veri ---------- */
export const rid = (y, h) => ((h || S.rates.hotel || 'ortunc') === 'ortunc' ? String(y) : `${h || S.rates.hotel}-${y}`);
export const rdoc = (y, h) => { const r = (S.data.rates || []).find((x) => x.id === rid(y, h)); return r ? { hotel: h || S.rates.hotel || 'ortunc', ...r } : null; };
const typesOf = (d) => (d && d.types && d.types.length ? d.types : d && d.hotel === 'elia' ? ELIA_TYPES : DEF_TYPES);
export const typesFor = (h, y) => typesOf(rdoc(y, h) || { hotel: h });
export const HOTEL_L = { ortunc: 'Ortunç Otel', elia: 'Elia Otel' };
const baseL = (d) => typesOf(d)[0].label;
const NT = (d) => typesOf(d).filter((t) => t.nights);
const rnd = (v, step) => (step ? Math.round(v / step) * step : Math.round(v));
export const priceOf = (d, p, k) => { const o = p.ov && p.ov[k]; if (o != null && o !== '') return num(o); const t = typesOf(d).find((x) => x.k === k); if (!t || t.fixed) return 0; return rnd(num(p.spr) * num(t.mult), num(d.round ?? 50)); };
const isWe = (iso) => { const w = new Date(iso + 'T12:00:00').getDay(); return w === 5 || w === 6; };
const addD = (iso, n) => { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
// her gece hangi döneme ait: tarih aralığı ve gün tipi tutan dönemlerden en dar olanı
export function dateMap(d) {
  const map = {}; if (!d) return map; const ps = d.periods || [];
  ps.forEach((p, i) => { if (!p.from || !p.to) return; const span = (new Date(p.to) - new Date(p.from)) / 864e5;
    for (let x = p.from; x <= p.to; x = addD(x, 1)) { if ((p.days === 'we' && !isWe(x)) || (p.days === 'wd' && isWe(x))) continue; const c = map[x]; if (!c || span < c.span) map[x] = { id: p.id, span, i }; } });
  return map;
}
export function stats(d, p) {
  const n = (k) => num((p.n || {})[k]); const ts = NT(d);
  const byType = ts.length > 0;
  const nights = byType ? ts.reduce((s, t) => s + n(t.k), 0) : num(p.nt);
  const list = byType ? ts.reduce((s, t) => s + n(t.k) * priceOf(d, p, t.k), 0) : nights * priceOf(d, p, typesOf(d)[0].k);
  const plan = nights * num(p.adr); const bfPax = byType ? ts.reduce((s, t) => s + n(t.k) * num(t.bf), 0) : nights * 2; const bfRev = bfPax * num(d.bfPrice ?? 2100);
  return { nights, list, plan, bfPax, bfRev, room: plan - bfRev, listAdr: nights ? list / nights : 0 };
}
// kesin rezervasyon (gece raporu: ileri tarihli oda sayısı) dönem bazında
function otbBy(d) {
  const map = dateMap(d); const o = {}; (S.perf && S.perf.otb || []).forEach((r) => { if (r.hotel !== (d.hotel || 'ortunc')) return; const m = map[r.date]; if (!m) return; const x = o[m.id] || (o[m.id] = { rooms: 0, rev: 0, revDays: 0 }); x.rooms += r.rooms || 0; if (r.roomRev !== '' && r.roomRev != null) { x.rev += Number(r.roomRev) || 0; x.revDays++; } });
  // geçmiş günler (iş günü geçmiş): gerçekleşen satılan oda
  (S.perf && S.perf.daily || []).forEach((r) => { if (r.hotel !== (d.hotel || 'ortunc')) return; const m = map[r.date]; if (!m) return; const x = o[m.id] || (o[m.id] = { rooms: 0, rev: 0, revDays: 0 }); x.rooms += r.occ || 0; x.past = (x.past || 0) + (r.occ || 0); });
  return o;
}
// ay ay plan (dönem değerleri dönemin gecelerine eşit dağıtılır)
function monthPlan(d) {
  const map = dateMap(d); const cnt = {}; Object.values(map).forEach((m) => { cnt[m.id] = (cnt[m.id] || 0) + 1; });
  const o = Array.from({ length: 12 }, () => ({ nights: 0, plan: 0, list: 0, bfRev: 0 }));
  Object.entries(map).forEach(([iso, m]) => { const p = (d.periods || []).find((x) => x.id === m.id); if (!p || !cnt[m.id]) return; const st = stats(d, p); const f = 1 / cnt[m.id]; const mo = Number(iso.slice(5, 7)) - 1; if (!iso.startsWith(String(d.year))) return; o[mo].nights += st.nights * f; o[mo].plan += st.plan * f; o[mo].list += st.list * f; o[mo].bfRev += st.bfRev * f; });
  return o;
}
// kalan oda karışımı önerisi: hedef geliri tutturmak için kalan hedef odaları gerçekleşenin fazlası/eksiği kadar ölçekle
export function mixSuggest(d, periods) {
  const ts = NT(d); const act = d.actual || {};
  const row = ts.map((t) => { let tgt = 0, a = 0, rev = 0, arev = 0; periods.forEach((p) => { const n = num((p.n || {})[t.k]); const pr = priceOf(d, p, t.k); const ak = num(((act[p.id] || {})[t.k])); tgt += n; rev += n * pr; a += ak; arev += ak * pr; }); return { t, tgt, a, rev, arev, avg: tgt ? rev / tgt : a ? arev / a : 0 }; });
  const T = row.reduce((s, r) => s + r.rev, 0), Ach = row.reduce((s, r) => s + r.arev, 0); const R = Math.max(0, T - Ach);
  const remT = row.reduce((s, r) => s + Math.max(0, r.tgt - r.a) * r.avg, 0); const f = remT ? R / remT : 0;
  row.forEach((r) => { r.rem = Math.max(0, r.tgt - r.a); r.need = r.a >= r.tgt ? 0 : Math.ceil(r.rem * f); });
  return { row, T, Ach, R, f };
}

/* ---------- ekran ---------- */
S.rates = S.rates || { year: Math.max(2027, Number(today().slice(0, 4))), tab: 'list', ver: null, hotel: 'ortunc' };
const km = (v) => (v == null || Number.isNaN(v) ? '—' : Math.abs(v) >= 1e6 ? `₺${(v / 1e6).toFixed(2).replace('.', ',')} mn` : money(Math.round(v)));
const pc = (v) => (v == null || !Number.isFinite(v) ? '—' : `%${Math.round(v)}`);
const chg = (a, b) => { if (!b || a == null || a === b) return ''; const p = ((a - b) / b) * 100; return `<span class="${p >= 0 ? 'dl-up' : 'dl-dn'}">${p >= 0 ? '▲' : '▼'} %${Math.abs(p).toFixed(1).replace('.', ',')}</span>`; };
export function versions(y) { const d = rdoc(y); if (!d) return []; return [...(d.revisions || []).map((r, i) => ({ ...r, label: i === 0 ? 'İlk fiyatlar' : `Revize ${i}` })), { ...d, label: (d.revisions || []).length ? `Revize ${(d.revisions || []).length} (güncel)` : 'Güncel', at: d.updatedAt, by: d.updatedByName, note: (d.rev || {}).note || '', eff: (d.rev || {}).eff || '', current: true }]; }
V.rates = {
  title: () => 'Oda fiyatları',
  head: () => `${can.admin() ? `<button class="btn pri" data-act="rateEdit">${ic('pencil')}<span class="hide-m"> Fiyatları düzenle / revize et</span></button><button class="btn" data-act="rateActual">${ic('check')}<span class="hide-m"> Oda tipine göre satış</span></button>` : ''}<button class="btn" data-act="rateExcel">${ic('table')}<span class="hide-m"> Excel</span></button><button class="btn" data-act="ratePrint">${ic('printer')}<span class="hide-m"> PDF</span></button>`,
  body: () => {
    if (A._loadPerf) A._loadPerf();
    const R = S.rates; const y = R.year; const d0 = rdoc(y); const vs = versions(y);
    const yearSeg = `<div class="seg" role="group" aria-label="Otel">${Object.entries(HOTEL_L).map(([k, l]) => `<button class="${R.hotel === k ? 'on' : ''}" data-act="rateHotel" data-h="${k}">${l}</button>`).join('')}</div><div class="seg" role="group" aria-label="Yıl">${[y - 1, y, y + 1].map((v) => `<button class="${v === y ? 'on' : ''}" data-act="rateYear" data-y="${v}">${v}</button>`).join('')}</div>`;
    if (!d0) return `<div class="perfbar">${yearSeg}</div><div class="card empty"><b>${HOTEL_L[R.hotel]} · ${y} için fiyat listesi yok</b>Dönemleri, ana oda fiyatını, oda tipi çarpanlarını ve hedef doluluğu girin; Excel fiyat dosyanızı da yükleyebilirsiniz.${can.admin() ? `<div><button class="btn pri" data-act="rateEdit">${ic('pencil')} Fiyat listesi oluştur</button>${y === 2027 ? ` <button class="btn" data-act="rateSeed">2027 fiyat ${R.hotel === 'elia' ? 'listesindeki (PDF)' : 'dosyasındaki'} rakamlarla başlat</button>` : ''}</div>` : ''}</div>`;
    const d = { ...d0, year: y }; const ts = typesOf(d); const nts = NT(d); const ps = d.periods || [];
    const first = vs[0]; const otb = otbBy(d); const mp = monthPlan(d); const bud = budgetSeries(y, [d.hotel || 'ortunc'], false);
    const tot = ps.reduce((a, p) => { const s = stats(d, p); a.nights += s.nights; a.plan += s.plan; a.list += s.list; a.bfRev += s.bfRev; a.bfPax += s.bfPax; return a; }, { nights: 0, plan: 0, list: 0, bfRev: 0, bfPax: 0 });
    const otbN = Object.values(otb).reduce((s, x) => s + x.rooms, 0);
    const mix = mixSuggest(d, ps); const hasAct = Object.keys(d.actual || {}).length > 0;
    const firstP = (p, k) => { if (!first || first.current) return null; const fp = (first.periods || []).find((x) => x.id === p.id); return fp ? priceOf({ ...first, types: first.types || d.types, round: first.round ?? d.round }, fp, k) : null; };
    S.ratesLast = { d, tot };
    return `<div class="perf">
      <div class="perfbar">${yearSeg}<div class="seg" role="group" aria-label="Görünüm">${[['list', 'Fiyat listesi'], ['plan', 'Hedef doluluk ve gelir'], ['track', 'Hedefin neresindeyiz'], ['rev', 'Fiyat revizyonları']].map(([k, l]) => `<button class="${R.tab === k ? 'on' : ''}" data-act="rateTab" data-t="${k}">${l}</button>`).join('')}</div></div>
      <div class="kband">
        <div class="kb"><small>Hedef gelir · oda + kahvaltı</small><b>${km(tot.plan)}</b><em>hedef ADR ile · brüt</em><span class="kfoot">liste fiyatıyla ${km(tot.list)}</span></div>
        <div class="kb"><small>Hedef oda-gece</small><b>${fmtNum(tot.nights)}</b><em>ort. hedef ADR ${km(tot.nights ? tot.plan / tot.nights : null)}</em></div>
        <div class="kb"><small>Oda geliri (kahvaltı hariç)</small><b>${km(tot.plan - tot.bfRev)}</b><em>kahvaltı ${km(tot.bfRev)} · ${fmtNum(tot.bfPax)} kişi × ${money(d.bfPrice ?? 2100)}</em></div>
        <div class="kb"><small>Gelir bütçesi · ${HOTEL_L[d.hotel]} oda + kahvaltı</small><b>${bud.set ? km(bud.roomRev.reduce((a, b) => a + b, 0) + bud.bfRev.reduce((a, b) => a + b, 0)) : '—'}</b><em>${bud.set ? `fiyat planı bütçenin ${pc((tot.plan / (bud.roomRev.reduce((a, b) => a + b, 0) + bud.bfRev.reduce((a, b) => a + b, 0))) * 100)}'ü` : 'bütçe girilmedi'}</em></div>
        <div class="kb"><small>Satılan / kesin oda-gece</small><b>${fmtNum(otbN)}</b><em>hedefin ${pc(tot.nights ? (otbN / tot.nights) * 100 : null)}'si · gece raporlarından</em></div>
        <div class="kb"><small>Fiyat sürümü</small><b>${esc(vs[vs.length - 1].label.replace(' (güncel)', ''))}</b><em>${vs[vs.length - 1].eff ? 'yürürlük ' + esc(fmtDate(vs[vs.length - 1].eff)) : ''}</em></div>
      </div>
      ${R.tab === 'list' ? `<div class="card"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">${y} fiyat listesi</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">Oda + kahvaltı, vergiler dahil ₺. Diğer oda tipleri ${esc(baseL(d))} × çarpan (${ts.slice(1).map((t) => (t.fixed ? `${esc(t.label)} ayrı fiyat` : `${esc(t.label)} ×${String(t.mult).replace('.', ',')}`)).join(' · ')}) ile hesaplanır, ${d.round ?? 50} ₺'ye yuvarlanır; elle değiştirilen fiyatlar <u>altı çizili</u>. ▲▼ ilk fiyata göre değişim.</p></div>
        <div class="scroll-x"><table class="tb perf-t rtab"><tr><th>Dönem</th><th>Tarih</th>${ts.map((t) => `<th class="n">${esc(t.label)}</th>`).join('')}</tr>
        ${ps.map((p) => `<tr><td><b>${esc(p.label)}</b></td><td class="sub" style="white-space:nowrap">${esc(fmtDate(p.from))} – ${esc(fmtDate(p.to))}${p.days !== 'all' ? `<br>${DAYT[p.days]}` : ''}</td>${ts.map((t) => { const v = priceOf(d, p, t.k); const f0 = firstP(p, t.k); return `<td class="n"><span class="${p.ov && p.ov[t.k] != null && p.ov[t.k] !== '' ? 'ovr' : ''}">${money(v)}</span>${f0 != null && f0 !== v ? `<div class="sub">${chg(v, f0)}</div>` : ''}</td>`; }).join('')}</tr>`).join('')}</table></div></div>` : ''}
      ${R.tab === 'plan' ? `<div class="card" style="margin-bottom:14px"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">Hedef doluluk ve tahmini gelir</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">Hedef gelir = toplam oda-gece × hedef ADR (oda + kahvaltı, brüt). Liste gelir = oda tipi oda-gece × liste fiyatı. Kahvaltı: kişi sayısı (2, triple 3) × ${money(d.bfPrice ?? 2100)}.</p></div>
        <div class="scroll-x"><table class="tb perf-t"><tr><th>Dönem</th>${nts.map((t) => `<th class="n">${esc(t.label)}</th>`).join('')}<th class="n">Oda-gece</th><th class="n">Hedef ADR</th><th class="n">Liste ort.</th><th class="n">Hedef gelir</th><th class="n">Liste gelir</th><th class="n">Satılan / kesin</th></tr>
        ${ps.map((p) => { const s = stats(d, p); const o = otb[p.id] || { rooms: 0 }; return `<tr><td>${esc(p.label)}</td>${nts.map((t) => `<td class="n">${fmtNum(num((p.n || {})[t.k]))}</td>`).join('')}<td class="n"><b>${fmtNum(s.nights)}</b></td><td class="n">${money(num(p.adr))}</td><td class="n">${km(s.listAdr)}</td><td class="n"><b>${km(s.plan)}</b></td><td class="n">${km(s.list)}</td><td class="n">${fmtNum(o.rooms)} <span class="sub">${pc(s.nights ? (o.rooms / s.nights) * 100 : null)}</span></td></tr>`; }).join('')}
        <tr class="tot"><td><b>Toplam</b></td>${nts.map((t) => `<td class="n"><b>${fmtNum(ps.reduce((a, p) => a + num((p.n || {})[t.k]), 0))}</b></td>`).join('')}<td class="n"><b>${fmtNum(tot.nights)}</b></td><td class="n"><b>${km(tot.nights ? tot.plan / tot.nights : null)}</b></td><td class="n"><b>${km(tot.nights ? tot.list / tot.nights : null)}</b></td><td class="n"><b>${km(tot.plan)}</b></td><td class="n"><b>${km(tot.list)}</b></td><td class="n"><b>${fmtNum(otbN)}</b></td></tr></table></div></div>
        <div class="card"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">Aylık · fiyat planı, gelir bütçesi, satılan</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">Brüt ₺, ${HOTEL_L[d.hotel]} oda + kahvaltı. Dönem hedefleri dönemin gecelerine eşit dağıtılır.</p></div>
        <div class="scroll-x"><table class="tb perf-t"><tr><th>Ay</th><th class="n">Plan oda-gece</th><th class="n">Bütçe oda-gece</th><th class="n">Satılan / kesin</th><th class="n">Plan gelir</th><th class="n">Bütçe oda + kahvaltı</th><th class="n">Plan / bütçe</th></tr>
        ${MONTHS.map((mn, i) => { const bv = bud.set ? bud.roomRev[i] + bud.bfRev[i] : null; const sold = (S.perf.otb || []).filter((r) => r.hotel === d.hotel && r.date.startsWith(`${y}-${String(i + 1).padStart(2, '0')}`)).reduce((a, r) => a + (r.rooms || 0), 0) + (S.perf.daily || []).filter((r) => r.hotel === d.hotel && r.date.startsWith(`${y}-${String(i + 1).padStart(2, '0')}`)).reduce((a, r) => a + (r.occ || 0), 0); return `<tr><td>${mn}</td><td class="n">${fmtNum(mp[i].nights)}</td><td class="n">${bud.set ? fmtNum(bud.rn[i]) : '—'}</td><td class="n">${fmtNum(sold)}</td><td class="n"><b>${km(mp[i].plan)}</b></td><td class="n">${km(bv)}</td><td class="n">${bv ? pc((mp[i].plan / bv) * 100) : '—'}</td></tr>`; }).join('')}</table></div></div>` : ''}
      ${R.tab === 'track' ? `<div class="card" style="margin-bottom:14px"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">Oda tipine göre hedef ve kalan</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">${hasAct ? `Gerçekleşen oda tipi satışları girildi. Hedef gelir (liste fiyatıyla) ${km(mix.T)}, gerçekleşen ${km(mix.Ach)}, kalan ${km(mix.R)}. "Yeterli" sütunu, kalan geliri tutturmak için diğer oda tiplerinden kaç oda daha satmanın yettiğini gösterir.` : 'Oda tipine göre satış girilmedi. Sağ üstteki "Oda tipine göre satış" ile dönem dönem gerçekleşen oda-geceleri girin (Opera oda tipi raporu gece mailine eklenirse otomatik okunur).'}</p></div>
        <div class="scroll-x"><table class="tb perf-t"><tr><th>Oda tipi</th><th class="n">Oda sayısı</th><th class="n">Hedef oda-gece</th><th class="n">Satılan</th><th class="n">%</th><th class="n">Kalan (hedefe göre)</th><th class="n">Yeterli</th><th class="n">Ort. liste fiyatı</th></tr>
        ${mix.row.map((r) => `<tr><td><b>${esc(r.t.label)}</b></td><td class="n">${r.t.count || ''}</td><td class="n">${fmtNum(r.tgt)}</td><td class="n">${hasAct ? fmtNum(r.a) : '—'}</td><td class="n">${hasAct ? pc(r.tgt ? (r.a / r.tgt) * 100 : null) : '—'}</td><td class="n">${hasAct ? fmtNum(r.rem) : fmtNum(r.tgt)}</td><td class="n">${hasAct ? (r.a >= r.tgt ? '<span class="dl-up">hedef aşıldı</span>' : `<b>${fmtNum(r.need)}</b>${r.need < r.rem ? ` <span class="dl-up">(${fmtNum(r.rem - r.need)} az)</span>` : r.need > r.rem ? ` <span class="dl-dn">(${fmtNum(r.need - r.rem)} fazla)</span>` : ''}`) : '—'}</td><td class="n">${km(r.avg)}</td></tr>`).join('')}</table></div></div>
        <div class="card"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">Dönemlere göre hedefin neresindeyiz</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">Satılan / kesin: gece raporlarındaki gerçekleşen ve ileri tarihli kesin oda-geceler (oda tipi ayrımı olmadan). Kalan gelir = hedef gelir − satılan oda-gece × hedef ADR.</p></div>
        <div class="scroll-x"><table class="tb perf-t"><tr><th>Dönem</th><th class="n">Hedef oda-gece</th><th class="n">Satılan / kesin</th><th class="n">%</th><th class="n">Kalan oda-gece</th><th class="n">Hedef gelir</th><th class="n">Kalan gelir</th><th></th></tr>
        ${ps.map((p) => { const s = stats(d, p); const o = otb[p.id] || { rooms: 0 }; const pp = s.nights ? (o.rooms / s.nights) * 100 : null; return `<tr><td>${esc(p.label)}</td><td class="n">${fmtNum(s.nights)}</td><td class="n">${fmtNum(o.rooms)}</td><td class="n">${pc(pp)}</td><td class="n">${fmtNum(Math.max(0, s.nights - o.rooms))}</td><td class="n">${km(s.plan)}</td><td class="n">${km(Math.max(0, s.plan - o.rooms * num(p.adr)))}</td><td style="min-width:90px"><div class="pbar"><i style="width:${Math.min(100, pp || 0)}%;background:${(pp || 0) >= 100 ? '#4F6B2E' : 'var(--primary)'}"></i></div></td></tr>`; }).join('')}</table></div></div>` : ''}
      ${R.tab === 'rev' ? revView(y, d, vs) : ''}
    </div>`;
  },
};
function revView(y, d, vs) {
  if (vs.length < 2) return `<div class="card empty"><b>Henüz fiyat revizesi yok</b>Fiyatları düzenleyip kaydettiğinizde her kayıt bir revize olur; ilk fiyatlardan yıl sonuna kadar her oda tipinin değişimi burada izlenir.</div>`;
  const ts = typesOf(d); const ps = d.periods || []; const first = vs[0];
  const pv = (v, p, k) => { const vp = (v.periods || []).find((x) => x.id === p.id); return vp ? priceOf({ ...v, types: v.types || d.types, round: v.round ?? d.round }, vp, k) : null; };
  // oda tipi bazında ortalama değişim (dönemlerin hedef oda-gecesiyle ağırlıklı)
  const typeChg = ts.map((t) => { let w = 0, a0 = 0, a1 = 0; ps.forEach((p) => { const f0 = pv(first, p, t.k); const f1 = priceOf(d, p, t.k); const n = num((p.n || {})[t.nights ? t.k : t.k.replace(/t$/, '')]) || 1; if (f0 == null) return; w += n; a0 += f0 * n; a1 += f1 * n; }); return { t, p0: w ? a0 / w : null, p1: w ? a1 / w : null }; });
  return `<div class="card" style="margin-bottom:14px"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">Sürümler</h3></div>
    <div class="scroll-x"><table class="tb perf-t"><tr><th>Sürüm</th><th>Kayıt</th><th>Yürürlük</th><th>Not</th><th class="n">Ort. ${esc(baseL(d))}</th><th class="n">Liste gelir</th><th></th></tr>
    ${vs.map((v, i) => { const vd = { ...v, types: v.types || d.types, round: v.round ?? d.round, bfPrice: v.bfPrice ?? d.bfPrice }; const L = (v.periods || []).reduce((s, p) => s + stats(vd, p).list, 0); const sp = (v.periods || []).length ? (v.periods || []).reduce((s, p) => s + num(p.spr), 0) / (v.periods || []).length : 0; return `<tr class="${v.current ? 'cur' : ''}"><td><b>${esc(v.label)}</b></td><td>${v.at ? esc(fmtDate(new Date(v.at).toISOString().slice(0, 10))) : ''}${v.by ? ' · ' + esc(v.by) : ''}</td><td>${v.eff ? esc(fmtDate(v.eff)) : '—'}</td><td>${esc(v.note || '')}</td><td class="n">${money(Math.round(sp))}</td><td class="n">${km(L)}</td><td class="n" style="white-space:nowrap"><button class="btn sm" data-act="rateVerX" data-i="${i}" title="Excel">${ic('table')}</button> <button class="btn sm" data-act="rateVerP" data-i="${i}" title="PDF">${ic('printer')}</button></td></tr>`; }).join('')}</table></div></div>
    <div class="card" style="margin-bottom:14px"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">Oda tipine göre ilk fiyattan bugüne</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">Dönemlerin hedef oda-gecesiyle ağırlıklı ortalama fiyat.</p></div>
    <div class="scroll-x"><table class="tb perf-t"><tr><th>Oda tipi</th><th class="n">İlk fiyatlar</th><th class="n">Güncel</th><th class="n">Fark</th><th class="n">Değişim</th></tr>${typeChg.map((x) => `<tr><td>${esc(x.t.label)}</td><td class="n">${money(Math.round(x.p0 || 0))}</td><td class="n">${money(Math.round(x.p1 || 0))}</td><td class="n">${x.p0 != null ? money(Math.round(x.p1 - x.p0)) : '—'}</td><td class="n">${chg(x.p1, x.p0) || '—'}</td></tr>`).join('')}</table></div></div>
    <div class="card"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">Dönem ve oda tipine göre fiyat geçmişi</h3></div>
    <div class="scroll-x"><table class="tb perf-t"><tr><th>Dönem</th><th>Oda tipi</th>${vs.map((v) => `<th class="n">${esc(v.label.replace(' (güncel)', ''))}</th>`).join('')}<th class="n">İlk → güncel</th></tr>
    ${ps.flatMap((p) => ts.map((t, j) => { const row = vs.map((v) => pv(v, p, t.k)); const ch = row.some((x, i) => i && x !== row[i - 1]); if (!ch) return ''; return `<tr><td>${j === 0 || true ? esc(p.label) : ''}</td><td>${esc(t.label)}</td>${row.map((x, i) => `<td class="n">${x == null ? '—' : money(x)}${i && x != null && row[i - 1] != null && x !== row[i - 1] ? `<div class="sub">${chg(x, row[i - 1])}</div>` : ''}</td>`).join('')}<td class="n">${chg(row[row.length - 1], row[0]) || '—'}</td></tr>`; })).join('') || `<tr><td colspan="${vs.length + 3}" class="muted">Revizelerde fiyat değişikliği yok.</td></tr>`}</table></div></div>`;
}
A.rateYear = (el) => { S.rates.year = Number(el.dataset.y); A._renderView(); };
A.rateHotel = (el) => { S.rates.hotel = el.dataset.h; A._renderView(); };
A.rateTab = (el) => { S.rates.tab = el.dataset.t; A._renderView(); };

/* ---------- düzenleyici ---------- */
let RE = null;
const newId = () => 'p' + Math.random().toString(36).slice(2, 8);
function seedDoc(y, h) { if (h === 'elia') return { year: y, hotel: 'elia', round: 1, bfPrice: 0, types: JSON.parse(JSON.stringify(ELIA_TYPES)), periods: JSON.parse(JSON.stringify(SEED_ELIA_2027)) }; return { year: y, hotel: 'ortunc', round: 50, bfPrice: 2100, types: JSON.parse(JSON.stringify(DEF_TYPES)), periods: SEED_2027.map((p, i) => ({ id: 'p' + (i + 1), ...JSON.parse(JSON.stringify(p)), ov: {} })) }; }
export function openRates(y) {
  const d = rdoc(y);
  const h = S.rates.hotel || 'ortunc';
  RE = { y, h, tab: 'price', doc: d ? JSON.parse(JSON.stringify({ hotel: h, round: d.round ?? 50, bfPrice: d.bfPrice ?? 2100, types: typesOf(d), periods: d.periods || [] })) : { hotel: h, round: h === 'elia' ? 1 : 50, bfPrice: h === 'elia' ? 0 : 2100, types: JSON.parse(JSON.stringify(h === 'elia' ? ELIA_TYPES : DEF_TYPES)), periods: [] } };
  rRender();
}
A.rateEdit = () => openRates(S.rates.year);
A.rateSeed = async () => {
  if (RE) { Object.assign(RE.doc, seedDoc(RE.y, RE.h)); toast('2027 fiyat listesindeki rakamlar dolduruldu; kontrol edip kaydedin'); rRender(); return; }
  openRates(S.rates.year); Object.assign(RE.doc, seedDoc(RE.y, RE.h)); rRender();
};
function rRender() {
  const d = { ...RE.doc, year: RE.y }; const ts = typesOf(d); const nts = NT(d); const has = !!rdoc(RE.y, RE.h); const nrev = ((rdoc(RE.y, RE.h) || {}).revisions || []).length;
  const tabs = [['price', 'Fiyatlar'], ['nights', 'Hedef doluluk'], ['types', 'Oda tipleri ve çarpanlar'], ['bulk', 'Toplu fiyat değişikliği']];
  let body = '';
  if (RE.tab === 'price') body = `<table class="tb bgrid"><tr><th>Dönem</th><th>Başlangıç</th><th>Bitiş</th><th>Günler</th>${ts.map((t, ti) => `<th class="n">${esc(t.label)}${ti ? `<div class="sub">${t.fixed ? 'ayrı fiyat' : '×' + String(t.mult).replace('.', ',')}</div>` : ''}</th>`).join('')}<th></th></tr>
    ${d.periods.map((p, i) => `<tr><td><input class="inp" style="min-width:190px;text-align:left" data-p="${i}.label" value="${esc(p.label || '')}"></td><td><input type="date" class="inp" data-p="${i}.from" value="${esc(p.from || '')}"></td><td><input type="date" class="inp" data-p="${i}.to" value="${esc(p.to || '')}"></td><td><select class="inp" data-p="${i}.days">${Object.entries(DAYT).map(([k, l]) => `<option value="${k}" ${p.days === k ? 'selected' : ''}>${l.replace(' (Cuma-Cumartesi)', '')}</option>`).join('')}</select></td>
      ${ts.map((t, ti) => ti === 0 ? `<td><input class="inp n spr" inputmode="decimal" data-p="${i}.spr" value="${p.spr || ''}"></td>` : `<td><input class="inp n ${p.ov && p.ov[t.k] != null && p.ov[t.k] !== '' ? 'ovr' : ''}" inputmode="decimal" data-ov="${i}.${t.k}" value="${p.ov && p.ov[t.k] != null && p.ov[t.k] !== '' ? p.ov[t.k] : ''}" placeholder="${t.fixed ? 'fiyat girin' : priceOf(d, p, t.k)}" title="${t.fixed ? 'Bu oda tipinin fiyatı ayrı girilir' : `Boş bırakılırsa ${esc(baseL(d))} × çarpan`}"></td>`).join('')}<td><button class="x" data-act="ratePDel" data-i="${i}" aria-label="Dönemi sil">${ic('x')}</button></td></tr>`).join('')}</table>
    <div class="acts" style="margin-top:8px"><button class="btn sm" data-act="ratePAdd">${ic('plus')} Dönem ekle</button><span class="hint">Gri rakamlar formülden gelir; bir oda tipi için farklı fiyat isterseniz kutuya yazın, silerseniz formüle döner. Aynı güne birden çok dönem düşerse en dar tarih aralıklı dönem geçerlidir (ör. bayram).</span></div>`;
  if (RE.tab === 'nights') body = `<table class="tb bgrid"><tr><th>Dönem</th>${nts.length ? nts.map((t) => `<th class="n">${esc(t.label)}<div class="sub">oda-gece</div></th>`).join('') : '<th class="n">Hedef oda-gece</th>'}<th class="n">Hedef ADR<div class="sub">oda+kahvaltı, brüt</div></th><th class="n">Toplam</th><th class="n">Hedef gelir</th></tr>
    ${d.periods.map((p, i) => { const s = stats(d, p); return `<tr><td>${esc(p.label)}</td>${nts.length ? nts.map((t) => `<td><input class="inp n" inputmode="decimal" data-n="${i}.${t.k}" value="${num((p.n || {})[t.k]) || ''}"></td>`).join('') : `<td><input class="inp n" inputmode="decimal" data-p="${i}.nt" value="${num(p.nt) || ''}"></td>`}<td><input class="inp n" inputmode="decimal" data-p="${i}.adr" value="${p.adr || ''}"></td><td class="n">${fmtNum(s.nights)}</td><td class="n">${money(Math.round(s.plan))}</td></tr>`; }).join('')}</table>`;
  if (RE.tab === 'types') body = `<div class="form" style="max-width:720px;margin-bottom:10px"><div class="fld half"><label>Kahvaltı fiyatı (kişi, brüt)</label><input class="inp" inputmode="decimal" data-g="bfPrice" value="${d.bfPrice ?? 2100}"></div><div class="fld half"><label>Yuvarlama (₺)</label><input class="inp" inputmode="decimal" data-g="round" value="${d.round ?? 50}"></div></div>
    <table class="tb bgrid"><tr><th>Oda tipi</th><th class="n">Oda sayısı</th><th class="n">Çarpan (× ${esc(baseL(d))})</th><th class="n">Kahvaltı kişi / oda</th><th>Hedef oda-gece girilir</th></tr>${ts.map((t, i) => `<tr><td><input class="inp" style="text-align:left;min-width:180px" data-t="${i}.label" value="${esc(t.label)}"></td><td><input class="inp n" data-t="${i}.count" value="${t.count}"></td><td><input class="inp n" data-t="${i}.mult" value="${t.fixed ? '' : t.mult}" ${i === 0 || t.fixed ? 'disabled' : ''} placeholder="${t.fixed ? 'ayrı fiyat' : ''}"></td><td><input class="inp n" data-t="${i}.bf" value="${t.bf}"></td><td><select class="inp" data-t="${i}.nights"><option value="1" ${t.nights ? 'selected' : ''}>Evet</option><option value="0" ${t.nights ? '' : 'selected'}>Hayır (yalnız fiyat)</option></select></td></tr>`).join('')}</table>`;
  if (RE.tab === 'bulk') body = `<div class="form" style="max-width:640px"><div class="fld"><label for="rbP">Dönemler</label><select id="rbP" class="inp" multiple size="8">${d.periods.map((p, i) => `<option value="${i}" selected>${esc(p.label)}</option>`).join('')}</select><span class="hint">Ctrl / Shift ile birden çok dönem seçin.</span></div>
    <div class="fld half"><label for="rbOp">İşlem</label><select id="rbOp" class="inp"><option value="pct">${esc(baseL(d))} fiyatını yüzde artır / azalt</option><option value="add">${esc(baseL(d))} fiyatına tutar ekle / çıkar</option><option value="adr">Hedef ADR'yi yüzde artır / azalt</option></select></div>
    <div class="fld half"><label for="rbV">Değer</label><input id="rbV" class="inp" inputmode="decimal" placeholder="ör. 5 ya da -3"></div>
    <div class="fld"><button class="btn pri" data-act="rateBulk">Uygula</button> <span class="hint">Diğer oda tipleri çarpanla birlikte değişir; elle girilmiş fiyatlar da aynı oranda güncellenir.</span></div></div>`;
  $('#modal').innerHTML = `<div class="ov center"><div class="modal bmodal"><div class="mh"><h2>${HOTEL_L[RE.h]} · ${RE.y} oda fiyatları${has ? ` · ${nrev ? 'revize ' + nrev : 'ilk fiyatlar'}` : ''}</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb"><div class="dayhead"><div class="seg">${tabs.map(([k, l]) => `<button class="${RE.tab === k ? 'on' : ''}" data-act="rateETab" data-t="${k}">${l}</button>`).join('')}</div><span class="sp"></span><label class="btn sm" style="cursor:pointer">${ic('upload')} Excel'den yükle<input type="file" accept=".xlsx,.xls" id="rImport" hidden></label>${RE.y === 2027 ? '<button class="btn sm" data-act="rateSeed">2027 fiyat listesindeki rakamlar</button>' : ''}</div>
      <div class="scroll-x" id="rBody">${body}</div><p class="err" id="rErr" role="alert"></p></div>
    <div class="mf">${has && can.admin() ? '<button class="btn danger sp" data-act="rateDelAll">Listeyi sil</button>' : ''}<button class="btn" data-act="closeModal">Vazgeç</button><button class="btn pri" data-act="rateSave">${has ? 'Revize olarak kaydet' : 'Kaydet'}</button></div></div></div>`;
  rWire();
}
const pnum = (v) => { const s = String(v ?? '').trim(); if (/^-?\d+(\.\d+)?$/.test(s) && !/^-?\d{1,3}\.\d{3}$/.test(s)) return Number(s); return num(s); };
function rWire() {
  const D = RE.doc;
  $$('#rBody [data-p]').forEach((el) => el.addEventListener('change', () => { const [i, k] = el.dataset.p.split('.'); D.periods[i][k] = ['spr', 'adr', 'nt'].includes(k) ? pnum(el.value) : el.value; if (['spr'].includes(k) || RE.tab === 'nights') rRender(); }));
  $$('#rBody [data-ov]').forEach((el) => el.addEventListener('change', () => { const [i, k] = el.dataset.ov.split('.'); const p = D.periods[i]; p.ov = p.ov || {}; if (el.value.trim() === '') delete p.ov[k]; else p.ov[k] = pnum(el.value); el.classList.toggle('ovr', el.value.trim() !== ''); }));
  $$('#rBody [data-n]').forEach((el) => el.addEventListener('change', () => { const [i, k] = el.dataset.n.split('.'); const p = D.periods[i]; p.n = p.n || {}; p.n[k] = pnum(el.value); rRender(); }));
  $$('#rBody [data-t]').forEach((el) => el.addEventListener('change', () => { const [i, k] = el.dataset.t.split('.'); const t = D.types[i]; t[k] = k === 'label' ? el.value : k === 'nights' ? el.value === '1' : pnum(el.value); }));
  $$('#rBody [data-g]').forEach((el) => el.addEventListener('change', () => { D[el.dataset.g] = pnum(el.value); }));
  const imp = $('#rImport'); if (imp) imp.onchange = () => rImport(imp.files[0]);
}
A.rateETab = (el) => { RE.tab = el.dataset.t; rRender(); };
A.ratePAdd = () => { const last = RE.doc.periods[RE.doc.periods.length - 1]; RE.doc.periods.push({ id: newId(), label: 'Yeni dönem', from: last ? addD(last.to, 1) : `${RE.y}-01-01`, to: last ? addD(last.to, 7) : `${RE.y}-01-31`, days: 'all', spr: last ? last.spr : 0, n: {}, adr: last ? last.adr : 0, ov: {} }); rRender(); };
A.ratePDel = (el) => { RE.doc.periods.splice(Number(el.dataset.i), 1); rRender(); };
A.rateBulk = () => {
  const idx = [...$('#rbP').selectedOptions].map((o) => Number(o.value)); const op = $('#rbOp').value; const v = pnum($('#rbV').value); if (!$('#rbV').value.trim()) return toast('Bir değer girin.');
  idx.forEach((i) => { const p = RE.doc.periods[i]; if (op === 'adr') { p.adr = Math.round(num(p.adr) * (1 + v / 100)); return; } const old = num(p.spr); const nw = op === 'pct' ? old * (1 + v / 100) : old + v; p.spr = Math.round(nw / (RE.doc.round || 1)) * (RE.doc.round || 1); const r = old ? p.spr / old : 1; Object.keys(p.ov || {}).forEach((k) => { p.ov[k] = Math.round((num(p.ov[k]) * r) / (RE.doc.round || 1)) * (RE.doc.round || 1); }); });
  toast(`${idx.length} dönem güncellendi`); RE.tab = 'price'; rRender();
};
A.rateSave = async (el) => {
  const prev = rdoc(RE.y, RE.h); const D = RE.doc;
  const bad = D.periods.find((p) => !p.from || !p.to || p.to < p.from); if (bad) { $('#rErr').textContent = `"${bad.label}" dönemindeki tarihleri kontrol edin.`; return; }
  const doSave = async (note, eff) => {
    el.disabled = true;
    try {
      const snap = prev ? { no: (prev.revisions || []).length, at: prev.updatedAt || prev.createdAt || Date.now(), by: prev.updatedByName || '', note: (prev.rev && prev.rev.note) || ((prev.revisions || []).length ? '' : 'İlk fiyatlar'), eff: (prev.rev && prev.rev.eff) || '', periods: prev.periods || [], types: typesOf(prev), round: prev.round ?? 50, bfPrice: prev.bfPrice ?? 2100 } : null;
      const revisions = [...((prev && prev.revisions) || []), ...(snap ? [snap] : [])];
      await S.store.save('rates', stamp({ ...(prev || {}), ...D, id: rid(RE.y, RE.h), hotel: RE.h, year: RE.y, revisions, rev: { no: revisions.length, note: note || '', eff: eff || '', at: Date.now(), by: S.user.name } }));
      toast(prev ? `Revize ${revisions.length} kaydedildi` : 'Fiyat listesi kaydedildi'); closeModal(); RE = null;
    } catch (e) { $('#rErr').textContent = errText(e); el.disabled = false; }
  };
  if (!prev) return doSave('', today());
  const n = (prev.revisions || []).length + 1;
  $('#rErr').innerHTML = `<span style="color:var(--ink)">Revize ${n}: </span><input id="rNote" class="inp" style="width:min(340px,100%);display:inline-block" placeholder="ör. Temmuz fiyatları %8 artırıldı"> <label style="color:var(--ink)">yürürlük <input id="rEff" type="date" class="inp" style="width:auto;display:inline-block" value="${today()}"></label> <button class="btn sm pri" id="rGo">Kaydet</button>`;
  $('#rNote').focus(); $('#rGo').onclick = () => doSave($('#rNote').value.trim(), $('#rEff').value);
};
A.rateDelAll = () => confirmBox(`${HOTEL_L[RE.h]} ${RE.y} fiyat listesi ve tüm revizeleri silinecek.`, 'Sil', async () => { await S.store.remove('rates', rid(RE.y, RE.h)); toast('Silindi'); closeModal(); RE = null; });

/* ---------- oda tipine göre gerçekleşen ---------- */
A.rateActual = () => {
  const y = S.rates.year; const d = rdoc(y); if (!d) return toast('Önce fiyat listesini oluşturun.'); const nts = NT(d); const act = d.actual || {}; if (!nts.length) return toast('Bu otelde hedef doluluk oda tipine göre girilmiyor; önce oda tipi gecelemelerini tanımlayın.');
  $('#modal').innerHTML = `<div class="ov center"><div class="modal bmodal"><div class="mh"><h2>${y} · oda tipine göre satılan oda-gece</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div><div class="mb">
    <p class="muted" style="margin-top:0">Opera'dan aldığınız oda tipi dağılımını dönem dönem girin (kesin rezervasyon + konaklamış). Bu giriş fiyat revizesi sayılmaz.</p>
    <div class="scroll-x"><table class="tb bgrid"><tr><th>Dönem</th>${nts.map((t) => `<th class="n">${esc(t.label)}<div class="sub">satılan / hedef</div></th>`).join('')}</tr>
    ${(d.periods || []).map((p) => `<tr><td>${esc(p.label)}</td>${nts.map((t) => `<td><input class="inp n" inputmode="decimal" data-a="${p.id}.${t.k}" value="${num((act[p.id] || {})[t.k]) || ''}" placeholder="/ ${num((p.n || {})[t.k])}"></td>`).join('')}</tr>`).join('')}</table></div><p class="err" id="raErr"></p></div>
    <div class="mf"><button class="btn" data-act="closeModal">Vazgeç</button><button class="btn pri" data-act="rateActSave">Kaydet</button></div></div></div>`;
};
A.rateActSave = async (el) => {
  const y = S.rates.year; const d = rdoc(y); const act = {};
  $$('[data-a]').forEach((x) => { const [pid, k] = x.dataset.a.split('.'); if (x.value.trim() === '') return; (act[pid] = act[pid] || {})[k] = pnum(x.value); });
  el.disabled = true;
  try { const { hotel, ...rest } = d; await S.store.save('rates', { ...rest, hotel, id: rid(y, hotel), actual: act, actualAt: Date.now(), actualBy: S.user.name }); toast('Satılan oda-geceler kaydedildi'); closeModal(); S.rates.tab = 'track'; } catch (e) { $('#raErr').textContent = errText(e); el.disabled = false; }
};

/* ---------- Excel içe aktarma (fiyat dosyası biçimi) ---------- */
const TRM = { ocak: 1, 'şubat': 2, mart: 3, nisan: 4, 'mayıs': 5, haziran: 6, temmuz: 7, 'ağustos': 8, 'eylül': 9, ekim: 10, 'kasım': 11, 'aralık': 12 };
async function rImport(file) {
  if (!file) return;
  try {
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
    const name = wb.SheetNames.find((n) => /${RE.y}/.test(n) && /erken/i.test(n) && !/\(/.test(n)) || wb.SheetNames.find((n) => new RegExp(String(RE.y)).test(n)) || wb.SheetNames[0];
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
    const hi = aoa.findIndex((r) => (r || []).some((v) => typeof v === 'string' && /^\s*spr\s*$/i.test(v))); if (hi < 0) throw new Error('"Spr" başlığı bulunamadı.');
    const h = aoa[hi].map((v) => (typeof v === 'string' ? v.trim().toLocaleLowerCase('tr-TR') : ''));
    const col = (re) => h.findIndex((v) => re.test(v));
    const C = { spr: col(/^spr$/), sprt: col(/^spr trpl/), dlx: col(/^dlx/), suit: col(/^suit dbl|^suİt dbl|^sui̇t dbl/), ps: col(/^p\.su.*dbl/), adr: col(/^adr/) };
    const nightsAfter = (c) => (c >= 0 && /geceleme/.test(h[c + 1] || '') ? c + 1 : -1);
    const out = [];
    aoa.slice(hi + 1).forEach((r) => {
      const lab = String((r || [])[0] || '').trim(); const spr = num((r || [])[C.spr]); if (!lab || !spr) return;
      const l = lab.toLocaleLowerCase('tr-TR'); const mo = Object.entries(TRM).find(([k]) => l.startsWith(k)); if (!mo) return;
      const m = lab.match(/\((\d\d)-(\d\d)\)/); const last = new Date(RE.y, mo[1], 0).getDate();
      const d1 = m ? Number(m[1]) : 1, d2 = m ? Number(m[2]) : last; const pad = (x) => String(x).padStart(2, '0');
      const n = {}; ['spr', 'sprt', 'dlx', 'suit', 'ps'].forEach((k) => { const c = nightsAfter(C[k]); if (c >= 0) n[k] = num(r[c]); });
      out.push({ id: newId(), label: lab.replace(/\s+/g, ' '), from: `${RE.y}-${pad(mo[1])}-${pad(d1)}`, to: `${RE.y}-${pad(mo[1])}-${pad(d2)}`, days: /sonu/.test(l) ? 'we' : /içi|i̇çi/.test(l) ? 'wd' : 'all', spr, n, adr: C.adr >= 0 ? num(r[C.adr]) : 0, ov: {} });
    });
    if (!out.length) throw new Error('Dönem satırı bulunamadı.');
    // aynı adlı dönemler önceki kimliği korusun (revizyon geçmişi için)
    out.forEach((p) => { const o = RE.doc.periods.find((x) => x.label === p.label); if (o) p.id = o.id; });
    RE.doc.periods = out; toast(`"${name}" sayfasından ${out.length} dönem alındı; diğer oda tipleri çarpanlarla hesaplandı`); RE.tab = 'price'; rRender();
  } catch (e) { $('#rErr').textContent = 'Excel okunamadı: ' + (e.message || e); }
}

/* ---------- Excel / PDF ---------- */
function verDoc(y, i) { const vs = versions(y); const v = i == null ? vs[vs.length - 1] : vs[i]; const d = rdoc(y); return { v, d: { ...v, hotel: d.hotel, year: y, types: v.types || typesOf(d), round: v.round ?? d.round ?? 50, bfPrice: v.bfPrice ?? d.bfPrice ?? 2100 }, vs }; }
export function exportRates(y, i) {
  if (!rdoc(y)) return toast('Bu yıl için fiyat listesi yok.');
  const { v, d, vs } = verDoc(y, i); const ts = typesOf(d); const nts = NT(d); const ps = d.periods || [];
  const wb = XLSX.utils.book_new();
  const head = ['Dönem', 'Başlangıç', 'Bitiş', 'Günler', ...ts.flatMap((t) => (t.nights ? [t.label, `${t.label} geceleme`] : [t.label])), 'Toplam geceleme', 'Hedef ADR', 'Total (hedef gelir)', 'Liste gelir'];
  const rows = [[`${y} Rate-TL · ${v.label} · oda + kahvaltı, vergiler dahil`], [], head];
  ps.forEach((p) => { const s = stats(d, p); rows.push([p.label, p.from, p.to, DAYT[p.days], ...ts.flatMap((t) => (t.nights ? [priceOf(d, p, t.k), num((p.n || {})[t.k])] : [priceOf(d, p, t.k)])), s.nights, num(p.adr), Math.round(s.plan), Math.round(s.list)]); });
  const T = ps.reduce((a, p) => { const s = stats(d, p); a.n += s.nights; a.plan += s.plan; a.bf += s.bfRev; a.pax += s.bfPax; return a; }, { n: 0, plan: 0, bf: 0, pax: 0 });
  rows.push([], ['Top. geceleme', T.n], ['Pax kahvaltı', T.pax], ['Room & Breakfast', Math.round(T.plan)], ['Breakfast', Math.round(T.bf)], ['Room', Math.round(T.plan - T.bf)]);
  const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = head.map((x, k) => ({ wch: k === 0 ? 30 : 12 })); XLSX.utils.book_append_sheet(wb, ws, `${y} fiyatlar`);
  // günlük fiyat (Opera'ya giriş için)
  const map = dateMap(d); const day = [['Tarih', 'Gün', 'Dönem', ...ts.map((t) => t.label)]];
  Object.keys(map).sort().forEach((iso) => { const p = ps.find((x) => x.id === map[iso].id); day.push([iso, ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][new Date(iso + 'T12:00:00').getDay()], p.label, ...ts.map((t) => priceOf(d, p, t.k))]); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(day), 'Günlük fiyat');
  if (vs.length > 1) {
    const hist = [['Dönem', 'Oda tipi', ...vs.map((x) => `${x.label}${x.eff ? ' (' + x.eff + ')' : ''}`), 'İlk → güncel %']];
    ps.forEach((p) => ts.forEach((t) => { const row = vs.map((x) => { const xp = (x.periods || []).find((q) => q.id === p.id); return xp ? priceOf({ ...x, types: x.types || ts, round: x.round ?? d.round }, xp, t.k) : ''; }); const a = row.find((z) => z !== ''); const b = row[row.length - 1]; hist.push([p.label, t.label, ...row, a && b ? Math.round(((b - a) / a) * 1000) / 10 : '']); }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hist), 'Revize geçmişi');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Sürüm', 'Kayıt', 'Yürürlük', 'Hazırlayan', 'Not'], ...vs.map((x) => [x.label, x.at ? new Date(x.at).toISOString().slice(0, 10) : '', x.eff || '', x.by || '', x.note || ''])]), 'Sürümler');
  }
  const act = rdoc(y).actual; if (act && Object.keys(act).length) { const mix = mixSuggest(d, ps); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Oda tipi', 'Hedef oda-gece', 'Satılan', 'Kalan', 'Yeterli', 'Ort. liste fiyatı'], ...mix.row.map((r) => [r.t.label, r.tgt, r.a, r.rem, r.need, Math.round(r.avg)])]), 'Hedef ve kalan'); }
  saveFile(`Oda-fiyatlari-${HOTEL_L[d.hotel].split(' ')[0]}-${y}-${v.label.replace(/[^\p{L}\p{N}]+/gu, '-')}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
}
export function printRates(y, i) {
  if (!rdoc(y)) return toast('Bu yıl için fiyat listesi yok.');
  const { v, d } = verDoc(y, i); const ts = typesOf(d); const nts = NT(d); const ps = d.periods || [];
  const T = ps.reduce((a, p) => { const s = stats(d, p); a.n += s.nights; a.plan += s.plan; a.bf += s.bfRev; return a; }, { n: 0, plan: 0, bf: 0 });
  printHtml(`Oda-fiyatlari-${y}`, `<div class="pdoc"><div class="ph"><b>${esc(S.settings.hotelName)}</b><span>${esc(fmtDate(today()))} · ${esc(S.user.name)}</span></div><h1>${HOTEL_L[d.hotel]} · ${y} oda fiyatları · ${esc(v.label)}</h1><p class="sub">Oda + kahvaltı, vergiler dahil ₺${v.eff ? ' · yürürlük ' + esc(fmtDate(v.eff)) : ''}${v.note ? ' · ' + esc(v.note) : ''}</p>
    <table class="tb" style="font-size:9.5px"><tr><th>Dönem</th><th>Tarih</th>${ts.map((t) => `<th class="n">${esc(t.label)}</th>`).join('')}<th class="n">Hedef oda-gece</th><th class="n">Hedef ADR</th><th class="n">Hedef gelir</th></tr>
    ${ps.map((p) => { const s = stats(d, p); return `<tr><td>${esc(p.label)}</td><td style="white-space:nowrap">${esc(fmtDate(p.from))} – ${esc(fmtDate(p.to))}${p.days !== 'all' ? ' · ' + (p.days === 'we' ? 'hafta sonu' : 'hafta içi') : ''}</td>${ts.map((t) => `<td class="n">${money(priceOf(d, p, t.k))}</td>`).join('')}<td class="n">${fmtNum(s.nights)}</td><td class="n">${money(num(p.adr))}</td><td class="n">${money(Math.round(s.plan))}</td></tr>`; }).join('')}
    <tr><td colspan="${ts.length + 2}"><b>Toplam · oda ${money(Math.round(T.plan - T.bf))} + kahvaltı ${money(Math.round(T.bf))}</b></td><td class="n"><b>${fmtNum(T.n)}</b></td><td class="n"><b>${money(Math.round(T.n ? T.plan / T.n : 0))}</b></td><td class="n"><b>${money(Math.round(T.plan))}</b></td></tr></table></div>`, '@page{size:A4 landscape;margin:9mm}');
}
A.rateExcel = () => exportRates(S.rates.year);
A.ratePrint = () => printRates(S.rates.year);
A.rateVerX = (el) => exportRates(S.rates.year, Number(el.dataset.i));
A.rateVerP = (el) => printRates(S.rates.year, Number(el.dataset.i));
