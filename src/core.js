import {
  House, Building2, Users, Handshake, Heart, ListChecks, CalendarDays, ChartColumn, Settings, Plus, Search, X, Phone, Mail,
  MessageCircle, Check, ChevronLeft, ChevronRight, Printer, Download, Upload, Pencil, Menu, MapPin, StickyNote,
  Presentation, Share2, LogOut, Briefcase, Flag, Cake, TriangleAlert, Copy, BedDouble,
} from 'lucide';

const ICONS = {
  house: House, building: Building2, users: Users, handshake: Handshake, heart: Heart, list: ListChecks, calendar: CalendarDays,
  chart: ChartColumn, settings: Settings, plus: Plus, search: Search, x: X, phone: Phone, mail: Mail, wa: MessageCircle,
  check: Check, left: ChevronLeft, right: ChevronRight, printer: Printer, download: Download, upload: Upload, pencil: Pencil,
  menu: Menu, pin: MapPin, note: StickyNote, meeting: Presentation, share: Share2, logout: LogOut, briefcase: Briefcase,
  flag: Flag, cake: Cake, warn: TriangleAlert, copy: Copy, bed: BedDouble,
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
export const COL_LABEL = { accounts: 'Acente / Firma', guests: 'Misafir', opps: 'Grup & Etkinlik', weddings: 'Düğün' };
export const EINV = { efatura: 'e-Fatura mükellefi', earsiv: 'e-Arşiv (mükellef değil)', yurtdisi: 'Yurt dışı firma' };
export const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
export const STAGE_BADGE = { talep: '', teklif: 'gold', gorusme: 'gold', gezi: 'gold', opsiyon: 'terra', kazanildi: 'olive', sozlesme: 'olive', kaybedildi: 'red' };
export const DEFAULT_SETTINGS = {
  hotelName: 'Ortunç Otel',
  properties: ['Ortunç Otel', 'Elia Otel', 'Elia Antique', 'Elia Antique House', 'Ortunç Restoran'],
  sources: ['Telefon', 'E-posta', 'Web sitesi', 'Instagram', 'Tavsiye', 'Acente', 'Fuar', 'Otele gelen'],
  phone: '', email: '', address: '',
  offerNote: 'Teklifimiz belirtilen geçerlilik tarihine kadar geçerlidir. Tarih, kapora ödemesi ile kesinleşir. Fiyatlara KDV dahildir.',
};

/* ---------- durum ---------- */
export const S = {
  store: null, gate: 'loading', gateInfo: {}, user: null, view: 'pano', q: '', f: {},
  data: { accounts: [], guests: [], opps: [], weddings: [], activities: [], tasks: [], files: [], users: [] },
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
export const money = (n, cur = 'TRY') => `${CUR_SYM[cur] || ''}${fmtNum(n)}`;
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
export const wedTotal = (w) => Math.max(0, num(w.guests) * num(w.perPerson) + (w.extras || []).reduce((s, x) => s + num(x.amount), 0) - num(w.discount));
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
    if (r === 'onburo') return ['guests', 'tasks', 'activities'].includes(col);
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
  const extra = t === 'number' ? 'inputmode="decimal" step="any" min="0"' : t === 'tel' ? 'inputmode="tel"' : '';
  return `<input type="${t === 'number' ? 'number' : t}" value="${esc(val)}" ${extra} ${common}>`;
}
function subRowHtml(f, row = {}) {
  return `<div class="subrow" style="--n:${f.sub.length}">${f.sub.map((s) => inputHtml(s, row[s.k], `data-sub="${s.k}" class="inp" aria-label="${esc(s.ph || s.k)}"`)).join('')}<button type="button" class="x" data-act="rowDel" title="Satırı sil">${ic('x')}</button></div>`;
}
function fieldHtml(f, data) {
  if (f.type === 'section') return `<div class="fld fsec"><h4>${esc(f.label)}</h4>${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`;
  if (f.type === 'rows') {
    const rows = data[f.k] || [];
    return `<div class="fld"><label>${esc(f.label)}</label><div class="rows" data-rows="${f.k}">${rows.map((r) => subRowHtml(f, r)).join('')}</div>
      <div><button type="button" class="btn sm" data-act="rowAdd" data-k="${f.k}">${ic('plus')} ${esc(f.addLabel || 'Satır ekle')}</button></div></div>`;
  }
  return `<div class="fld ${f.half ? 'half' : ''}"><label for="f_${f.k}">${esc(f.label)}${f.req ? ' *' : ''}</label>${inputHtml(f, data[f.k], `id="f_${f.k}" name="${f.k}"`)}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`;
}
let formCtx = null;
export function openForm({ title, fields, data = {}, onSave, onDelete, saveLabel = 'Kaydet', intro = '' }) {
  formCtx = { fields };
  const r = $('#modal');
  r.innerHTML = `<div class="ov center"><form class="modal" id="frm" novalidate>
    <div class="mh"><h2>${esc(title)}</h2><button type="button" class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb">${intro}<div class="form">${fields.map((f) => fieldHtml(f, data)).join('')}<div class="err" id="frmErr" hidden></div></div></div>
    <div class="mf">${onDelete ? '<button type="button" class="btn danger sp" id="frmDel">Sil</button>' : ''}<button type="button" class="btn" data-act="closeModal">Vazgeç</button><button class="btn pri" type="submit">${esc(saveLabel)}</button></div>
  </form></div>`;
  const frm = $('#frm', r);
  const showErr = (m) => { const e = $('#frmErr', r); e.textContent = m; e.hidden = false; e.scrollIntoView({ block: 'nearest' }); };
  frm.onsubmit = async (ev) => {
    ev.preventDefault();
    const out = {};
    for (const f of fields) {
      if (f.type === 'section') continue;
      if (f.type === 'rows') {
        out[f.k] = $$(`[data-rows="${f.k}"] .subrow`, frm).map((row) => {
          const o = {}; f.sub.forEach((s) => { const el = $(`[data-sub="${s.k}"]`, row); o[s.k] = s.type === 'number' ? num(el.value) : el.value.trim(); }); return o;
        }).filter((o) => f.sub.some((s) => o[s.k]));
        continue;
      }
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
  const first = $('input:not([type=date]),textarea', frm); if (first && window.innerWidth > 900) first.focus();
}
export function closeModal() { $('#modal').innerHTML = ''; formCtx = null; }
A.closeModal = closeModal;
A.rowAdd = (el) => { const f = formCtx.fields.find((x) => x.k === el.dataset.k); $(`[data-rows="${f.k}"]`).insertAdjacentHTML('beforeend', subRowHtml(f)); const rows = $$(`[data-rows="${f.k}"] .subrow`); $('input,select', rows[rows.length - 1]).focus(); };
A.rowDel = (el) => el.closest('.subrow').remove();

export function infoModal(title, html, footer = '') {
  $('#modal').innerHTML = `<div class="ov center"><div class="modal"><div class="mh"><h2>${esc(title)}</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div><div class="mb">${html}</div>${footer ? `<div class="mf">${footer}</div>` : ''}</div></div>`;
}

export async function copyText(t) {
  try {
    if (window.Android && window.Android.copy) window.Android.copy(t); else await navigator.clipboard.writeText(t);
    toast('Kopyalandı');
  } catch (e) { toast('Kopyalanamadı; metni elle seçip kopyalayın.'); }
}
