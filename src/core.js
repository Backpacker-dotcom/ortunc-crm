import {
  House, Building2, Users, Handshake, Heart, ListChecks, CalendarDays, ChartColumn, Settings, Plus, Search, X, Phone, Mail,
  MessageCircle, Check, ChevronLeft, ChevronRight, Printer, Download, Upload, Pencil, Menu, MapPin, StickyNote,
  Presentation, Share2, LogOut, Briefcase, Flag, Cake, TriangleAlert, Copy, BedDouble, Ban, SlidersHorizontal, TrendingUp, TrendingDown, ArrowUpDown, Columns3, Table2, LayoutGrid, Target, Layers, Gift,
} from 'lucide';

const ICONS = {
  house: House, building: Building2, users: Users, handshake: Handshake, heart: Heart, list: ListChecks, calendar: CalendarDays,
  chart: ChartColumn, settings: Settings, plus: Plus, search: Search, x: X, phone: Phone, mail: Mail, wa: MessageCircle,
  check: Check, left: ChevronLeft, right: ChevronRight, printer: Printer, download: Download, upload: Upload, pencil: Pencil,
  menu: Menu, pin: MapPin, note: StickyNote, meeting: Presentation, share: Share2, logout: LogOut, briefcase: Briefcase,
  flag: Flag, cake: Cake, warn: TriangleAlert, copy: Copy, bed: BedDouble, ban: Ban, sliders: SlidersHorizontal, up: TrendingUp, down: TrendingDown, sort: ArrowUpDown, cols: Columns3, table: Table2, grid: LayoutGrid, target: Target, layers: Layers, gift: Gift,
};
export const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${(ICONS[n] || []).map(([t, a]) => `<${t} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')}</svg>`;

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- sabitler ---------- */
export const ACC_TYPES = { acente: 'Acente', operator: 'Tur operatörü', ota: 'Online kanal (OTA)', kurumsal: 'Kurumsal firma', diger: 'Diğer' };
export const ACC_STATUS = { aktif: 'Aktif', potansiyel: 'Potansiyel', pasif: 'Pasif' };
export const OPP_KINDS = { grup: 'Grup konaklama', toplanti: 'Toplantı / seminer', yemek: 'Yemek organizasyonu', etkinlik: 'Özel etkinlik' };
export const OPP_STAGES = [['talep', 'Talep'], ['teklif', 'Teklif hazırla'], ['gorusme', 'Görüşme'], ['opsiyon', 'Opsiyon'], ['kazanildi', 'Kesinleşti'], ['kaybedildi', 'Kaybedildi']];
export const WED_STAGES = [['talep', 'Talep'], ['teklif', 'Teklif hazırla'], ['gezi', 'Mekân gezisi'], ['opsiyon', 'Opsiyon'], ['sozlesme', 'Sözleşme'], ['kaybedildi', 'Kaybedildi']];
export const ACT_TYPES = { ziyaret: 'Satış ziyareti', telefon: 'Telefon', eposta: 'E-posta', toplanti: 'Toplantı', fuar: 'Fuar', not: 'Not' };
export const ACT_ICON = { ziyaret: 'briefcase', telefon: 'phone', eposta: 'mail', toplanti: 'meeting', fuar: 'flag', not: 'note' };
export const ROLES = { yonetici: 'Yönetici', satis: 'Satış', onburo: 'Ön büro', izleyici: 'İzleyici' };
export const CURS = [['TRY', '₺ TL'], ['EUR', '€ Euro'], ['USD', '$ Dolar'], ['GBP', '£ Sterlin']];
export const CUR_SYM = { TRY: '₺', EUR: '€', USD: '$', GBP: '£' };
export const COL_LABEL = { accounts: 'Acente / Firma', guests: 'Misafir', opps: 'Grup & Etkinlik', weddings: 'Düğün', blacklist: 'Kara liste' };
export const EINV = { efatura: 'e-Fatura mükellefi', earsiv: 'e-Arşiv (mükellef değil)', yurtdisi: 'Yurt dışı firma' };
export const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
export const STAGE_BADGE = { talep: '', teklif: 'gold', gorusme: 'gold', gezi: 'gold', opsiyon: 'terra', kazanildi: 'olive', sozlesme: 'olive', kaybedildi: 'red' };
export const DEFAULT_SETTINGS = {
  hotelName: 'Ortunç Otel',
  properties: ['Ortunç Otel', 'Elia Otel', 'Elia Antique', 'Elia Antique House', 'Ortunç Restoran'],
  sources: ['Telefon', 'E-posta', 'Web sitesi', 'Instagram', 'Tavsiye', 'Acente', 'Fuar', 'Otele gelen'],
  segments: ['Kurumsal', 'MICE / toplantı', 'Tur operatörü / grup', 'Bireysel (FIT)', 'OTA', 'Düğün & sosyal etkinlik', 'Kamu', 'Spor / kültür grubu', 'Diğer'],
  channels: ['Direkt (telefon / e-posta)', 'Web sitesi', 'Acente', 'Tur operatörü', 'OTA', 'GDS', 'Kurumsal anlaşma', 'Sosyal medya', 'Fuar'],
  phone: '', email: '', address: '',
  offerNote: 'Teklifimiz belirtilen geçerlilik tarihine kadar geçerlidir. Tarih, kapora ödemesi ile kesinleşir. Fiyatlara KDV dahildir.',
};

/* ---------- durum ---------- */
export const S = {
  store: null, gate: 'loading', gateInfo: {}, user: null, view: 'pano', q: '', f: {},
  data: { accounts: [], guests: [], opps: [], weddings: [], activities: [], tasks: [], files: [], blacklist: [], reports: [], targets: [], visits: [], rates: [], blocks: [], events: [], campaigns: [], users: [] },
  settings: { ...DEFAULT_SETTINGS }, sheet: null, calMonth: null, repYear: new Date().getFullYear(),
};
export const A = {}; // eylemler (data-act)
export const V = {}; // görünümler

/* ---------- yardımcılar ---------- */
const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());
export const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const MON3 = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const fmtDate = (s) => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return d && m && y ? `${d}.${m}.${y}` : String(s); };
export const fmtDateLong = (s) => { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
export const fmtRange = (a, b) => (a && b && a !== b ? `${fmtDate(a)} – ${fmtDate(b)}` : fmtDate(a || b));
export const fmtTs = (t) => (t ? fmtDate(iso(new Date(t))) : '');
export const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
export const fmtNum = (n) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
export const money = (n, cur = 'TRY') => `${Math.round(n || 0) < 0 ? '−' : ''}${CUR_SYM[cur] || ''}${fmtNum(Math.abs(n || 0))}`;
export const sumByCur = (list, valFn) => {
  const m = {};
  list.forEach((x) => { const v = valFn(x); if (v) m[x.currency || 'TRY'] = (m[x.currency || 'TRY'] || 0) + v; });
  return m;
};
export const moneyMap = (m) => { const k = Object.keys(m); return k.length ? k.map((c) => money(m[c], c)).join(' · ') : '—'; };
export const trLower = (s) => String(s ?? '').toLocaleLowerCase('tr-TR');
export const match = (q, ...parts) => { const n = trLower(q).trim(); return !n || parts.some((p) => trLower(p).includes(n)); };
export const initials = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toLocaleUpperCase('tr-TR');
export const digits = (s) => String(s || '').replace(/\D/g, '');
export const waNum = (p) => { let d = digits(p); if (d.length === 11 && d[0] === '0') d = '9' + d; else if (d.length === 10) d = '90' + d; return d; };
export const byId = (col, id) => S.data[col].find((x) => x.id === id);
export const userName = (uid) => { const u = S.data.users.find((x) => x.id === uid); return u ? u.name : ''; };
export const stageLabel = (list, k) => (list.find((s) => s[0] === k) || [k, k])[1];
export const sortBy = (arr, fn, dir = 1) => arr.slice().sort((a, b) => { const x = fn(a), y = fn(b); return (x > y ? 1 : x < y ? -1 : 0) * dir; });
export const opts = (obj) => Object.entries(obj);

/* ---------- misafir özel günleri ---------- */
export const OCC = { dogum: 'Doğum günü', yildonumu: 'Evlilik yıl dönümü', ozel: 'Özel gün' };
export function guestOccasions(g) {
  const o = [];
  if (g.birthday) o.push({ type: 'dogum', key: 'dogum', label: 'Doğum günü', date: g.birthday });
  if (g.anniversary) o.push({ type: 'yildonumu', key: 'yildonumu', label: 'Evlilik yıl dönümü', date: g.anniversary });
  (g.specials || []).forEach((s, i) => { if (s && s.date) o.push({ type: 'ozel', key: 'ozel' + i, label: s.label || 'Özel gün', date: s.date }); });
  return o;
}
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const mdOn = (date, year) => { let m = String(date).slice(5, 10); if (m === '02-29' && !isLeap(Number(year))) m = '02-28'; return m; };
export const occursOn = (o, day) => mdOn(o.date, day.slice(0, 4)) === day.slice(5, 10);
export function occasionsOn(day) {
  const out = [];
  S.data.guests.forEach((g) => guestOccasions(g).forEach((o) => { if (occursOn(o, day)) out.push({ ...o, g, day }); }));
  return out;
}
export const nextOccurrence = (o, from = today()) => { for (let i = 0; i < 367; i++) { const d = addDays(from, i); if (occursOn(o, d)) return d; } return ''; };
export const stayOn = (g, day) => (g.stays || []).find((s) => s.checkIn && s.checkIn <= day && (!s.checkOut || s.checkOut >= day));
export const yearsSince = (date, day) => { const y = Number(String(date).slice(0, 4)), n = Number(day.slice(0, 4)) - y; return y > 1900 && n > 0 && n < 111 ? n : 0; };
/* ---------- fiyat kalemleri ve vergiler ---------- */
// Her kalem: { name, qty, price, cur, kdv(%), kv(%), mode: 'dahil' | 'ekle' }
// Konaklama vergisi KDV hariç bedel üzerinden alınır; KDV matrahına konaklama vergisi dahildir.
// Konaklama vergisi varsayılanı %1. (Eski sürümde %2 kaydedilmişse ve oran elle değiştirilmemişse %1 kabul edilir.)
export const taxCfg = () => { const t = { kdv: 10, kv: 1, mode: 'dahil', ...(S.settings.tax || {}) }; if (!t.v2 && Number(t.kv) === 2) t.kv = 1; return t; };
const kvFix = (v) => (!(S.settings.tax && S.settings.tax.v2) && Number(v) === 2 ? 1 : v);
export const KDV_OPTS = [['0', 'Yok'], ['1', '%1'], ['10', '%10'], ['20', '%20']];
export const kvOpts = () => [['0', 'Yok'], [String(taxCfg().kv), `%${taxCfg().kv}`]];
export const MODE_OPTS = [['dahil', 'Dahil'], ['ekle', 'Eklenecek']];
export const DEPTS = [['oda', 'Oda'], ['yi', 'Yiyecek-içecek'], ['salon', 'Salon / MICE'], ['diger', 'Diğer']];
export const DEPT_LABEL = Object.fromEntries(DEPTS);
export const deptOf = (it) => it.dept || (num(it.kv) > 0 || /konaklama|oda|room/i.test(it.name || '') ? 'oda' : /salon|toplantı|meeting|ekipman|teknik/i.test(it.name || '') ? 'salon' : /yemek|menü|kahvaltı|coffee|içecek|kokteyl|pasta|ikram|büfe|gala/i.test(it.name || '') ? 'yi' : 'diger');
export const QTY_RULES = [['kisi_gun', 'Kişi × gün'], ['kisi_gece', 'Kişi × gece'], ['kisi', 'Kişi sayısı'], ['oda_gece', 'Oda × gece'], ['gun', 'Gün sayısı'], ['gece', 'Gece sayısı'], ['adet', '1 adet']];
const P = (id, name, rule, kdv, kv = 0, price = '', dept = '') => ({ id, name, rule, kdv, kv, price, cur: 'TRY', mode: '', dept });
export const DEFAULT_PRESETS = {
  opps: [P('konaklama', 'Konaklama (oda × gece)', 'oda_gece', 10, 1, '', 'oda'), P('coffee', 'Coffee break (kişi başı)', 'kisi_gun', 10, 0, '', 'yi'), P('ogle', 'Öğle yemeği (kişi başı)', 'kisi_gun', 10, 0, '', 'yi'),
    P('aksam', 'Akşam yemeği (kişi başı)', 'kisi_gece', 10, 0, '', 'yi'), P('salonyarim', 'Toplantı salonu · yarım gün', 'gun', 20, 0, '', 'salon'), P('salontam', 'Toplantı salonu · tam gün', 'gun', 20, 0, '', 'salon'), P('ozel', '', 'adet', 20, 0, '', 'diger')],
  weddings: [P('menu', 'Menü (kişi başı)', 'kisi', 10, 0, '', 'yi'), P('icecek', 'İçecek paketi (kişi başı)', 'kisi', 20, 0, '', 'yi'), P('susleme', 'Süsleme ve çiçek', 'adet', 20, 0, '', 'diger'), P('muzik', 'Müzik / DJ', 'adet', 20, 0, '', 'diger'),
    P('pasta', 'Düğün pastası', 'adet', 10, 0, '', 'yi'), P('konaklama', 'Konaklama (oda × gece)', 'oda_gece', 10, 1, '', 'oda'), P('ozel', '', 'adet', 20, 0, '', 'diger')],
};
export const presetsOf = (col) => ((S.settings.presets && S.settings.presets[col]) || DEFAULT_PRESETS[col]).map((p) => ({ ...p, kv: kvFix(p.kv) }));
export const presetLabel = (p) => p.name || 'Özel kalem';
const dayDiff = (a, b) => (a && b ? Math.max(0, Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5)) : 0);
export function ruleQty(rule, get) {
  const pax = num(get('pax') || get('guests')), rooms = num(get('rooms')), n = dayDiff(get('start') || get('date'), get('end') || get('date'));
  const days = n + 1, nights = Math.max(1, n);
  return ({ kisi_gun: pax * days, kisi_gece: pax * nights, kisi: pax, oda_gece: rooms * nights, gun: days, gece: nights, adet: 1 })[rule] || '';
}
export const itemsForForm = (col, r) => itemsOf(col, r).map((it) => ({ ...it, dept: deptOf(it) }));
export function itemsOf(col, r) {
  if (Array.isArray(r.items) && r.items.length) return r.items;
  const c = r.currency || 'TRY';
  if (col === 'weddings') {
    const it = [];
    if (num(r.perPerson)) it.push({ name: r.menu || 'Menü (kişi başı)', qty: num(r.guests), price: num(r.perPerson), cur: c, kdv: 0, kv: 0, mode: 'dahil' });
    (r.extras || []).forEach((x) => it.push({ name: x.name, qty: 1, price: num(x.amount), cur: c, kdv: 0, kv: 0, mode: 'dahil' }));
    if (num(r.discount)) it.push({ name: 'İndirim', qty: 1, price: -num(r.discount), cur: c, kdv: 0, kv: 0, mode: 'dahil' });
    return it;
  }
  if (col === 'opps' && num(r.value)) return [{ name: OPP_KINDS[r.kind] || 'Konaklama', qty: 1, price: num(r.value), cur: c, kdv: 0, kv: 0, mode: 'dahil' }];
  return [];
}
export function lineCalc(it, fallbackQty) {
  const qty = it.qty === '' || it.qty == null ? (num(fallbackQty) || 1) : num(it.qty);
  const price = num(it.price), kdv = num(it.kdv) / 100, kv = num(it.kv) / 100;
  const base = qty * price;
  const net = it.mode === 'ekle' ? base : base / ((1 + kv) * (1 + kdv));
  const kvA = net * kv, kdvA = (net + kvA) * kdv;
  return { ...it, qty, price, net, kvA, kdvA, gross: net + kvA + kdvA, cur: it.cur || 'TRY', kdvR: num(it.kdv), kvR: num(it.kv) };
}
export function calcItems(items, fallbackQty) {
  const lines = (items || []).filter((x) => x && (x.name || num(x.price))).map((x) => lineCalc(x, fallbackQty));
  const by = {};
  lines.forEach((l) => {
    const t = by[l.cur] || (by[l.cur] = { net: 0, kv: 0, kvR: {}, kdv: {}, gross: 0 });
    t.net += l.net; t.gross += l.gross;
    if (l.kvA) { t.kv += l.kvA; t.kvR[l.kvR] = (t.kvR[l.kvR] || 0) + l.kvA; }
    if (l.kdvA) t.kdv[l.kdvR] = (t.kdv[l.kdvR] || 0) + l.kdvA;
  });
  const curs = Object.keys(by).sort((a, b) => by[b].gross - by[a].gross);
  return { lines, by, curs, main: curs[0] || 'TRY' };
}
export const recCalc = (col, r) => calcItems(itemsOf(col, r), col === 'weddings' ? r.guests : 1);
// Otelcilik ölçüleri: oda-gece, departman gelirleri (vergiler hariç), ADR
const nightsOf = (a, b) => (a && b ? Math.max(0, Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5)) : 0);
export function recMetrics(col, r) {
  const c = recCalc(col, r); const dep = {}; let rn = 0;
  c.lines.forEach((l) => { const d = deptOf(l); const m = dep[d] || (dep[d] = {}); m[l.cur] = (m[l.cur] || 0) + l.net; if (d === 'oda') rn += l.qty; });
  const legacy = !(Array.isArray(r.items) && r.items.length);
  if (col === 'opps' && (legacy || !rn)) rn = num(r.rooms) * Math.max(1, nightsOf(r.start, r.end));
  else if (legacy) rn = 0;
  const adr = {}; if (rn && dep.oda) Object.keys(dep.oda).forEach((k) => { adr[k] = dep.oda[k] / rn; });
  const net = {}; c.curs.forEach((k) => { net[k] = c.by[k].net; });
  return { roomNights: rn, dept: dep, adr, net, gross: Object.fromEntries(c.curs.map((k) => [k, c.by[k].gross])), main: c.main };
}
export const recTotals = (col, r) => { const c = recCalc(col, r); return Object.fromEntries(c.curs.map((k) => [k, c.by[k].gross])); };
// Teklif tablosu için satırlar (tüm çıktılar bunu kullanır)
// Revizyonlar: r.revisions = [{ no, at, by, note, items, deposit, guests, pax, rooms, start, end, date, validUntil, totals }]
export const revNo = (r) => ((r && r.revisions) || []).length + 1;
export const prevRev = (r) => { const l = (r && r.revisions) || []; return l.length ? l[l.length - 1] : null; };
export const revRec = (r, rv) => ({ ...r, items: rv.items, deposit: rv.deposit, guests: rv.guests ?? r.guests, pax: rv.pax ?? r.pax, rooms: rv.rooms ?? r.rooms, currency: rv.currency || r.currency });
export function priceRows(col, r) {
  const c = recCalc(col, r);
  const taxNote = (l) => { const t = []; if (l.kdvR) t.push(`KDV %${l.kdvR}`); if (l.kvR) t.push(`Konaklama V. %${l.kvR}`); return t.length ? `${t.join(' + ')} ${l.mode === 'ekle' ? 'hariç' : 'dahil'}` : ''; };
  const rows = c.lines.map((l) => [[l.name, l.qty !== 1 ? `${fmtNum(l.qty)} × ${money(l.price, l.cur)}` : '', taxNote(l)].filter(Boolean).join(' — '), money(l.mode === 'ekle' ? l.qty * l.price : l.gross, l.cur)]);
  const sums = [], totals = [], foot = [];
  const anyTax = c.lines.some((l) => l.kdvA || l.kvA), anyAdd = c.lines.some((l) => l.mode === 'ekle' && (l.kdvA || l.kvA));
  c.curs.forEach((k) => {
    const t = c.by[k]; const suf = c.curs.length > 1 ? ` (${k})` : '';
    if (anyTax) {
      const s0 = [[`Ara toplam (vergiler hariç)${suf}`, money(t.net, k)]];
      Object.keys(t.kvR).forEach((rt) => s0.push([`Konaklama vergisi %${rt}${anyAdd ? '' : ' (dahil)'}${suf}`, money(t.kvR[rt], k)]));
      Object.keys(t.kdv).sort().forEach((rt) => s0.push([`KDV %${rt}${anyAdd ? '' : ' (dahil)'}${suf}`, money(t.kdv[rt], k)]));
      sums.push(...s0); s0.forEach((x, i) => foot.push([...x, i === 0 ? 's0' : 's']));
    }
    const tt = [`Genel toplam${anyTax ? ' (vergiler dahil)' : ''}${suf}`, money(t.gross, k)]; totals.push(tt); foot.push([...tt, 't']);
  });
  const after = [];
  if (num(r.deposit)) after.push([col === 'weddings' ? 'Rezervasyon için kapora' : 'Opsiyon için ön ödeme', money(num(r.deposit), r.currency || c.main)]);
  const pv = r._showPrev ? prevRev(r) : null;
  if (pv) { const t = recTotals(col, revRec(r, pv)); after.unshift([`Önceki teklif (Rev. ${pv.no} · ${fmtDate(iso(new Date(pv.at)))})`, moneyMap(t), 'old']); }
  return { rows, sums, totals, foot, after, total: totals[0] || ['Toplam', money(0)] };
}
export const taxNoteText = (col, r) => {
  const c = recCalc(col, r); const ls = c.lines.filter((l) => l.kdvA || l.kvA); if (!ls.length) return '';
  const hasKv = ls.some((l) => l.kvA), allIn = ls.every((l) => l.mode !== 'ekle'), allAdd = ls.every((l) => l.mode === 'ekle');
  const what = hasKv ? 'KDV ve konaklama vergisi' : 'KDV';
  return allIn ? `Fiyatlara ${what} dahildir.` : allAdd ? `Fiyatlara ${what} ayrıca eklenmiştir.` : `Vergilerin dahil / hariç durumu kalemlerde belirtilmiştir.`;
};
export const wedTotal = (w) => { const c = recCalc('weddings', w); return c.by[w.currency || c.main] ? c.by[w.currency || c.main].gross : 0; };
export const recTitle = (col, r) => (!r ? '' : col === 'weddings' ? r.couple : col === 'opps' ? r.title : r.name);
export const related = (col, id) => sortBy(S.data.activities.filter((a) => a.ref && a.ref.col === col && a.ref.id === id), (a) => a.date + String(a.createdAt || ''), -1);
export const relTasks = (col, id) => sortBy(S.data.tasks.filter((t) => t.ref && t.ref.col === col && t.ref.id === id), (t) => (t.done ? '9' : '0') + (t.due || '9999'));
export const lastContact = (accId) => { const a = related('accounts', accId)[0]; return a ? a.date : ''; };

/* ---------- yetki ---------- */
export const can = {
  admin: () => S.user && S.user.role === 'yonetici',
  edit: (col) => {
    const r = S.user && S.user.role;
    if (r === 'yonetici' || r === 'satis') return true;
    if (r === 'onburo') return ['guests', 'tasks', 'activities', 'blacklist'].includes(col);
    return false;
  },
  del: (col, rec) => {
    const r = S.user && S.user.role;
    if (r === 'yonetici') return true;
    if (r === 'izleyici' || !rec) return false;
    if (col === 'activities') return rec.userId === S.user.uid;
    if (col === 'tasks') return rec.createdBy === S.user.uid;
    return false;
  },
};
export const stamp = (obj) => ({ ...obj, createdAt: obj.createdAt || Date.now(), createdBy: obj.createdBy || S.user.uid, updatedAt: Date.now(), updatedBy: S.user.uid, updatedByName: S.user.name });

/* ---------- bildirim / onay ---------- */
let toastT;
export function toast(msg) {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200);
}
window.onNativeToast = toast;

export function confirmBox(msg, yesLabel, onYes, danger = true) {
  const r = $('#modal2');
  r.innerHTML = `<div class="ov center"><div class="modal sm"><div class="mb" style="padding-top:22px">${esc(msg)}</div>
    <div class="mf"><button class="btn" id="cNo">Vazgeç</button><button class="btn ${danger ? 'danger' : 'pri'}" id="cYes">${esc(yesLabel)}</button></div></div></div>`;
  $('#cNo', r).onclick = () => { r.innerHTML = ''; };
  $('#cYes', r).onclick = async () => { r.innerHTML = ''; try { await onYes(); } catch (e) { toast(errText(e)); } };
}
export const errText = (e) => (e && e.code === 'permission-denied' ? 'Bu işlem için yetkiniz yok.' : 'İşlem tamamlanamadı: ' + ((e && e.message) || e));

/* ---------- form oluşturucu ---------- */
function inputHtml(f, v, attr) {
  const val = v ?? f.def ?? '';
  const common = `${attr} ${f.req ? 'required' : ''} ${f.ph ? `placeholder="${esc(f.ph)}"` : ''}`;
  if (f.type === 'select') {
    const list = (f.opts || []).slice();
    if (val && !list.some((o) => o[0] === val)) list.push([val, val]);
    return `<select ${common}>${f.req ? '' : '<option value="">—</option>'}${list.map((o) => `<option value="${esc(o[0])}" ${String(o[0]) === String(val) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  }
  if (f.type === 'textarea') return `<textarea ${common}>${esc(val)}</textarea>`;
  const t = f.type || 'text';
  const extra = (t === 'number' ? `inputmode="decimal" step="any" ${f.neg ? '' : 'min="0"'}` : t === 'tel' ? 'inputmode="tel"' : '') + (f.list ? ` list="${f.list}"` : '') + (f.max != null ? ` max="${f.max}"` : '');
  return `<input type="${t === 'number' ? 'number' : t}" value="${esc(val)}" ${extra} ${common}>`;
}
function subRowHtml(f, row = {}) {
  return `<div class="subrow ${f.cls || ''}" style="--n:${f.sub.length}">${f.sub.map((s, i) => { const ctl = inputHtml(s, row[s.k], `data-sub="${s.k}" class="inp" aria-label="${esc((f.heads && f.heads[i]) || s.ph || s.k)}"`); return f.heads ? `<label class="sc"><span>${esc(f.heads[i])}</span>${ctl}</label>` : ctl; }).join('')}<button type="button" class="x" data-act="rowDel" title="Satırı sil">${ic('x')}</button></div>`;
}
function fieldHtml(f, data) {
  if (f.type === 'section') return `<div class="fld fsec"><h4>${esc(f.label)}</h4>${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`;
  if (f.type === 'rows') {
    const rows = data[f.k] || [];
    return `<div class="fld"><label>${esc(f.label)}</label>${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}${f.heads ? `<div class="subhead ${f.cls || ''}" style="--n:${f.sub.length}">${f.heads.map((h) => `<span>${esc(h)}</span>`).join('')}<span></span></div>` : ''}<div class="rows" data-rows="${f.k}">${rows.map((r) => subRowHtml(f, r)).join('')}</div>
      <div class="acts">${(f.presets || []).map((p, i) => `<button type="button" class="chip" data-act="itemPreset" data-k="${f.k}" data-i="${i}">${ic('plus')} ${esc(presetLabel(p))}</button>`).join('')}${f.presets ? '' : `<button type="button" class="btn sm" data-act="rowAdd" data-k="${f.k}">${ic('plus')} ${esc(f.addLabel || 'Satır ekle')}</button>`}</div>${f.summary ? `<div class="rowsum" data-sum="${f.k}"></div>` : ''}</div>`;
  }
  return `<div class="fld ${f.half ? 'half' : ''}"><label for="f_${f.k}">${esc(f.label)}${f.req ? ' *' : ''}</label>${inputHtml(f, data[f.k], `id="f_${f.k}" name="${f.k}"`)}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`;
}
function readRows(frm, f) {
  return $$(`[data-rows="${f.k}"] .subrow`, frm).map((row) => {
    const o = {}; f.sub.forEach((s) => { const el = $(`[data-sub="${s.k}"]`, row); o[s.k] = s.type === 'number' ? (el.value === '' ? '' : num(el.value)) : el.value.trim(); }); return o;
  }).filter((o) => f.keepEmpty || f.sub.some((s) => s.type !== 'select' && o[s.k] !== '' && o[s.k] != null));
}
let formCtx = null;
export function openForm({ title, fields, data = {}, onSave, onDelete, saveLabel = 'Kaydet', intro = '', wide = false }) {
  formCtx = { fields };
  const r = $('#modal');
  r.innerHTML = `<div class="ov center"><form class="modal" id="frm" novalidate ${wide ? 'style="width:min(980px,100%)"' : ''}>
    <div class="mh"><h2>${esc(title)}</h2><button type="button" class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb">${intro}<div class="form">${fields.map((f) => fieldHtml(f, data)).join('')}<div class="err" id="frmErr" hidden></div></div>
    <datalist id="dlKdv"><option value="0"></option><option value="1"></option><option value="10"></option><option value="20"></option></datalist><datalist id="dlKv"><option value="0"></option><option value="1"></option><option value="2"></option></datalist></div>
    <div class="mf">${onDelete ? '<button type="button" class="btn danger sp" id="frmDel">Sil</button>' : ''}<button type="button" class="btn" data-act="closeModal">Vazgeç</button><button class="btn pri" type="submit">${esc(saveLabel)}</button></div>
  </form></div>`;
  const frm = $('#frm', r);
  const showErr = (m) => { const e = $('#frmErr', r); e.textContent = m; e.hidden = false; e.scrollIntoView({ block: 'nearest' }); };
  frm.onsubmit = async (ev) => {
    ev.preventDefault();
    const out = {};
    for (const f of fields) {
      if (f.type === 'section') continue;
      if (f.type === 'rows') { out[f.k] = readRows(frm, f); continue; }
      const el = frm.elements[f.k];
      let v = el.value.trim();
      if (f.req && !v) { showErr(`"${f.label}" alanı boş bırakılamaz.`); el.focus(); return; }
      if (f.type === 'number') v = v === '' ? '' : num(el.value);
      out[f.k] = v;
    }
    const btn = $('button[type=submit]', frm); btn.disabled = true;
    try { const res = await onSave(out); if (res !== false) closeModal(); } catch (e) { showErr(e && e.userMsg ? e.userMsg : errText(e)); } finally { btn.disabled = false; }
  };
  const del = $('#frmDel', r);
  if (del) del.onclick = () => confirmBox('Bu kayıt kalıcı olarak silinecek. Emin misiniz?', 'Sil', async () => { await onDelete(); closeModal(); });
  const sums = fields.filter((f) => f.type === 'rows' && f.summary);
  const upd = () => sums.forEach((f) => { const box = $(`[data-sum="${f.k}"]`, frm); if (box) box.innerHTML = f.summary(readRows(frm, f), (k) => (frm.elements[k] ? frm.elements[k].value : '')); });
  if (sums.length) { frm.addEventListener('input', upd); frm.addEventListener('change', upd); frm.addEventListener('click', (e) => { if (e.target.closest('[data-act=rowDel],[data-act=rowAdd]')) setTimeout(upd, 0); }); upd(); }
  const first = $('input:not([type=date]),textarea', frm); if (first && window.innerWidth > 900) first.focus();
}
export function closeModal() { $('#modal').innerHTML = ''; formCtx = null; }
A.closeModal = closeModal;
export function addRowWith(k, row) {
  const f = formCtx && formCtx.fields.find((x) => x.k === k); if (!f) return;
  $(`[data-rows="${k}"]`).insertAdjacentHTML('beforeend', subRowHtml(f, row));
  const rows = $$(`[data-rows="${k}"] .subrow`); const last = rows[rows.length - 1];
  const target = row.name ? $('[data-sub=price]', last) : $('[data-sub=name]', last); if (target) target.focus();
  $('#frm').dispatchEvent(new Event('input'));
}
A.rowAdd = (el) => { const f = formCtx.fields.find((x) => x.k === el.dataset.k); $(`[data-rows="${f.k}"]`).insertAdjacentHTML('beforeend', subRowHtml(f)); const rows = $$(`[data-rows="${f.k}"] .subrow`); $('input,select', rows[rows.length - 1]).focus(); };
A.rowDel = (el) => el.closest('.subrow').remove();
A.itemPreset = (el) => {
  const f = formCtx.fields.find((x) => x.k === el.dataset.k); const p = f.presets[Number(el.dataset.i)]; const frm = $('#frm');
  const get = (k) => (frm.elements[k] ? frm.elements[k].value : '');
  const t = taxCfg(); const q = ruleQty(p.rule, get);
  addRowWith(f.k, { name: p.name, qty: q === '' || q === 0 ? '' : q, price: p.price === '' || p.price == null ? '' : p.price, cur: p.cur || 'TRY', kdv: String(p.kdv ?? t.kdv), kv: String(p.kv ?? 0), mode: p.mode || t.mode, dept: p.dept || deptOf(p) });
};

export function infoModal(title, html, footer = '') {
  $('#modal').innerHTML = `<div class="ov center"><div class="modal"><div class="mh"><h2>${esc(title)}</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div><div class="mb">${html}</div>${footer ? `<div class="mf">${footer}</div>` : ''}</div></div>`;
}

export async function copyText(t) {
  try {
    if (window.Android && window.Android.copy) window.Android.copy(t); else await navigator.clipboard.writeText(t);
    toast('Kopyalandı');
  } catch (e) { toast('Kopyalanamadı; metni elle seçip kopyalayın.'); }
}
