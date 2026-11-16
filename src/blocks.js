// Allotman, kontrat ve grup blok takibi (pick-up): oda tipine göre gece gece blok, alınan oda, kalan,
// release / cutoff takvimi, attrition (ceza) riski, pick-up geçmişi, Excel ve PDF
import * as XLSX from 'xlsx';
import { S, A, V, $, $$, esc, ic, today, addDays, fmtDate, fmtRange, fmtNum, money, num, MONTHS, MON3, toast, can, byId, sortBy, openForm, closeModal, stamp, confirmBox, errText } from './core.js';
import { printHtml, saveFile } from './print.js';
import { rdoc, dateMap, priceOf, HOTEL_L, typesFor } from './rates.js';
import { DS, QUICK } from './builder.js';

export const BK_KIND = { allot: 'Kontrat / allotman', grup: 'Grup blok' };
export const BK_STATUS = { allot: { aktif: 'Aktif', taslak: 'Görüşmede', pasif: 'Durduruldu' }, grup: { opsiyon: 'Opsiyonlu', kesin: 'Kesin', iptal: 'İptal' } };
const ST_ALL = { ...BK_STATUS.allot, ...BK_STATUS.grup };
const ST_B = { aktif: 'olive', taslak: 'gold', pasif: '', opsiyon: 'gold', kesin: 'olive', iptal: 'red' };
const MEAL = { BB: 'Oda + kahvaltı', HB: 'Yarım pansiyon', FB: 'Tam pansiyon', RO: 'Sadece oda' };
const RATE_MODE = { liste: 'Oda fiyat listesinden', indirim: 'Fiyat listesinden indirimli', sabit: 'Sabit fiyat (oda tipine göre)' };
const WD = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const D = () => S.data;
const BL = () => D().blocks || [];
export const live = (b) => !['iptal', 'pasif'].includes(b.status);
const km = (v) => (v == null || Number.isNaN(v) ? '—' : Math.abs(v) >= 1e6 ? `₺${(v / 1e6).toFixed(2).replace('.', ',')} mn` : money(Math.round(v)));
const pc = (v) => (v == null || !Number.isFinite(v) ? '—' : `%${Math.round(v)}`);
const accOpts = () => [['', '—'], ...sortBy(D().accounts || [], (a) => (a.name || '').toLocaleLowerCase('tr-TR')).map((a) => [a.id, a.name])];
S.blocks = S.blocks || { hotel: 'all', kind: 'all', when: 'now', tab: 'list', month: today().slice(0, 7) };

/* ---------- hesap ---------- */
// geceler: kontratta ilk ve son gece dahil; grupta giriş ile çıkış arası (çıkış gecesi yok)
export function nights(b) {
  const out = []; if (!b.from) return out;
  const last = b.kind === 'grup' ? addDays(b.to || b.from, -1) : b.to || b.from;
  for (let d = b.from; d <= last && out.length < 800; d = addDays(d, 1)) out.push(d);
  return out;
}
const typesB = (b) => typesFor(b.hotel || 'ortunc', Number((b.from || today()).slice(0, 4)));
export const allocOn = (b, d, k) => { const o = b.dayAlloc && b.dayAlloc[d]; return o && o[k] != null && o[k] !== '' ? num(o[k]) : num((b.alloc || {})[k]); };
export const pickOn = (b, d, k) => num(((b.pick || {})[d] || {})[k]);
// bloktaki oda tipleri: blok verilen ya da oda alınan tipler
export const bTypes = (b) => typesB(b).filter((t) => num((b.alloc || {})[t.k]) > 0 || Object.values(b.dayAlloc || {}).some((x) => num(x[t.k]) > 0) || Object.values(b.pick || {}).some((x) => num(x[t.k]) > 0));
// release günü: kontratta her gece için (gece − release günü); grupta tek cutoff tarihi
export const relDate = (b, d) => (b.kind === 'grup' ? b.cutoff || addDays(b.from, -num(b.release || 0)) : addDays(d, -num(b.release || 0)));
const MAPS = {};
function listPrice(h, d, k) {
  const doc = rdoc(Number(d.slice(0, 4)), h); if (!doc) return 0;
  const key = `${doc.id}:${doc.updatedAt || ''}`; const m = MAPS[key] || (MAPS[key] = dateMap(doc));
  const e = m[d]; if (!e) return 0; const p = (doc.periods || []).find((x) => x.id === e.id);
  return p ? priceOf(doc, p, k) : 0;
}
export function priceB(b, d, k) {
  if (b.rateMode === 'sabit') return num((b.rate || {})[k]);
  const lp = listPrice(b.hotel || 'ortunc', d, k);
  return b.rateMode === 'indirim' ? Math.round(lp * (1 - num(b.disc) / 100)) : lp;
}
export function bStats(b, from, to) {
  const t = today(); const ts = bTypes(b);
  const r = { alloc: 0, pick: 0, open: 0, released: 0, unusedPast: 0, rev: 0, pot: 0, noPrice: false, byType: {}, nightsN: 0, nextRel: '', maxNight: 0 };
  nights(b).forEach((d) => {
    if ((from && d < from) || (to && d > to)) return; r.nightsN++;
    const rd = relDate(b, d); let nightA = 0;
    ts.forEach((ty) => {
      const a = allocOn(b, d, ty.k), p = pickOn(b, d, ty.k); if (!a && !p) return;
      const pr = priceB(b, d, ty.k); if (a && !pr) r.noPrice = true;
      const rem = Math.max(0, a - p); nightA += a;
      r.alloc += a; r.pick += p; r.rev += p * pr; r.pot += Math.max(a, p) * pr;
      const bt = r.byType[ty.k] || (r.byType[ty.k] = { t: ty, a: 0, p: 0, rev: 0, pot: 0 }); bt.a += a; bt.p += p; bt.rev += p * pr; bt.pot += Math.max(a, p) * pr;
      if (d < t) r.unusedPast += rem;
      else if (rd < t) r.released += rem;
      else { r.open += rem; if (rem && (!r.nextRel || rd < r.nextRel)) r.nextRel = rd; }
    });
    r.maxNight = Math.max(r.maxNight, nightA);
  });
  r.rem = Math.max(0, r.alloc - r.pick); r.pct = r.alloc ? (r.pick / r.alloc) * 100 : null;
  r.avg = r.alloc ? r.pot / r.alloc : 0;
  if (b.kind === 'grup') { r.min = Math.ceil(r.alloc * (1 - num(b.attrition) / 100)); r.short = Math.max(0, r.min - r.pick); r.penalty = r.short * r.avg; }
  return r;
}
// önümüzdeki günlerde release olacak (alınmamış) odalar: blok ve release günü başına
export function releases(days = 7, list = BL()) {
  const t = today(), end = addDays(t, days); const out = [];
  list.filter(live).forEach((b) => {
    const g = {}; const ts = bTypes(b);
    nights(b).forEach((d) => {
      if (d < t) return; const rd = relDate(b, d); if (rd < t || rd > end) return;
      const rem = ts.reduce((s, ty) => s + Math.max(0, allocOn(b, d, ty.k) - pickOn(b, d, ty.k)), 0); if (!rem) return;
      const x = g[rd] || (g[rd] = { b, rd, rooms: 0, nights: [] }); x.rooms += rem; x.nights.push(d);
    });
    out.push(...Object.values(g));
  });
  return sortBy(out, (x) => x.rd);
}
// attrition uyarısı: cutoff 14 gün içinde ya da geçmiş, konaklama henüz bitmemiş gruplar
export const attnRisk = (b, s) => b.kind === 'grup' && live(b) && s.short > 0 && nights(b).length && relDate(b, b.from) <= addDays(today(), 14) && nights(b).slice(-1)[0] >= today();
const inR = (b, d) => { const n = nights(b); return n.length && d >= n[0] && d <= n[n.length - 1]; };
const isPast = (b) => { const n = nights(b); return n.length && n[n.length - 1] < today(); };
function filtered() {
  const F = S.blocks;
  return sortBy(BL().filter((b) => (F.hotel === 'all' || (b.hotel || 'ortunc') === F.hotel) && (F.kind === 'all' || b.kind === F.kind) && (F.when === 'all' || (F.when === 'past' ? isPast(b) : !isPast(b)))), (b) => b.from || '');
}
const snap = (b) => { const s = bStats(b); const log = (b.log || []).filter((x) => x.d !== today()); log.push({ d: today(), p: s.pick, a: s.alloc, by: S.user.name }); return log.slice(-400); };
const relLabel = (b, d) => { const rd = relDate(b, d), t = today(); if (d < t) return ['geçti', '']; if (rd < t) return ['release oldu', 'muted']; const n = Math.round((new Date(rd) - new Date(t)) / 864e5); return [n === 0 ? 'bugün release' : `${n} gün`, n <= 3 ? 'warn' : '']; };
const pbar = (p) => `<div class="pbar" style="min-width:70px"><i style="width:${Math.min(100, p || 0)}%;background:${p >= 90 ? 'var(--olive,#4F6B2E)' : p >= 50 ? 'var(--primary)' : '#C98A1B'}"></i></div>`;
const rpn = (b) => Object.values(b.alloc || {}).reduce((s, v) => s + num(v), 0);

/* ---------- form ---------- */
export function blockForm(rec, preset = {}) {
  const base = rec ? JSON.parse(JSON.stringify(rec)) : { kind: 'allot', hotel: 'ortunc', rateMode: 'liste', meal: 'BB', release: 7, attrition: 10, alloc: {}, rate: {}, ...preset };
  if (!base.status) base.status = base.kind === 'grup' ? 'opsiyon' : 'aktif';
  show(base);
  function show(data) {
    const g = data.kind === 'grup'; const ts = typesFor(data.hotel || 'ortunc', Number((data.from || today()).slice(0, 4)));
    const flat = { ...data };
    ts.forEach((t) => { flat['a_' + t.k] = (data.alloc || {})[t.k] ?? ''; flat['r_' + t.k] = (data.rate || {})[t.k] ?? ''; });
    openForm({
      title: rec ? `${BK_KIND[data.kind]} · düzenle` : `Yeni ${BK_KIND[data.kind].toLocaleLowerCase('tr-TR')}`,
      wide: true, data: flat,
      intro: `<p class="muted" style="margin:0 0 8px">${g ? 'Grup için ayrılan odaları gece başına girin; rooming list geldikçe alınan odaları blok ekranından işaretlersiniz. Cutoff geçince alınmayan odalar bloktan düşer.' : 'Acenteye verilen allotmanı gece başına oda tipine göre girin. Release günü geçen gecelerde satılmayan odalar otele döner; ekranda gün gün görünür.'}</p>`,
      fields: [
        { k: 'kind', label: 'Tür', type: 'select', opts: Object.entries(BK_KIND), req: true, half: true },
        { k: 'hotel', label: 'Otel', type: 'select', opts: Object.entries(HOTEL_L), req: true, half: true },
        { k: 'name', label: 'Başlık', req: true, ph: g ? 'ör. X Firması bayi toplantısı bloğu' : 'ör. Mavi Yelken 2027 yaz kontratı' },
        { k: 'accountId', label: 'Acente / firma', type: 'select', opts: accOpts(), req: !g, half: true },
        { k: 'status', label: 'Durum', type: 'select', opts: Object.entries(BK_STATUS[data.kind]), req: true, half: true },
        { k: 'from', label: g ? 'Giriş tarihi' : 'Geçerlilik başlangıcı (ilk gece)', type: 'date', req: true, half: true },
        { k: 'to', label: g ? 'Çıkış tarihi' : 'Geçerlilik bitişi (son gece)', type: 'date', req: true, half: true },
        ...(g ? [{ k: 'cutoff', label: 'Cutoff (rooming list son günü)', type: 'date', half: true, hint: 'Bu tarihten sonra alınmayan odalar bloktan düşer.' },
          { k: 'attrition', label: 'Attrition payı %', type: 'number', half: true, hint: 'Cezasız bırakılabilecek oda oranı; altına düşülürse eksik oda için ceza hesaplanır.' }]
          : [{ k: 'release', label: 'Release (gün)', type: 'number', half: true, hint: 'Konaklamadan kaç gün önce satılmayan odalar otele döner.' },
            { k: 'commission', label: 'Komisyon %', type: 'number', half: true }]),
        { type: 'section', label: 'Blok · gece başına oda', hint: 'Belirli gecelerde farklı sayı varsa (ör. bayram, giriş günü) blok ekranında "Bloğu düzenle" ile gün gün değiştirebilirsiniz.' },
        ...ts.map((t) => ({ k: 'a_' + t.k, label: t.label, type: 'number', half: true })),
        { type: 'section', label: 'Fiyat ve koşullar' },
        { k: 'rateMode', label: 'Fiyat', type: 'select', opts: Object.entries(RATE_MODE), half: true, hint: 'Oda fiyat listesindeki fiyatlar oda + kahvaltı, vergiler dahil.' },
        { k: 'meal', label: 'Pansiyon', type: 'select', opts: Object.entries(MEAL), half: true },
        ...(data.rateMode === 'indirim' ? [{ k: 'disc', label: 'İndirim %', type: 'number', half: true }] : []),
        ...(data.rateMode === 'sabit' ? ts.map((t) => ({ k: 'r_' + t.k, label: `${t.label} · gecelik fiyat`, type: 'number', half: true })) : []),
        ...(g ? [{ k: 'oppId', label: 'Bağlı grup talebi', type: 'select', opts: [['', '—'], ...sortBy(D().opps || [], (o) => o.start || '', -1).map((o) => [o.id, `${o.title}${o.start ? ' · ' + fmtDate(o.start) : ''}`])], half: true }]
          : [{ k: 'contractNo', label: 'Kontrat no', half: true }, { k: 'signed', label: 'İmza tarihi', type: 'date', half: true }]),
        { k: 'payTerms', label: 'Ödeme koşulu', half: true, ph: 'ör. Girişten 7 gün önce %100' },
        { k: 'cancel', label: 'İptal koşulu', half: true, ph: 'ör. 14 gün öncesine kadar ücretsiz' },
        { k: 'notes', label: 'Notlar', type: 'textarea' },
      ],
      saveLabel: rec ? 'Kaydet' : 'Oluştur',
      onSave: async (v) => {
        if (v.to < v.from || (v.kind === 'grup' && v.to <= v.from)) throw { userMsg: v.kind === 'grup' ? 'Çıkış tarihi girişten sonra olmalı.' : 'Bitiş tarihi başlangıçtan önce olamaz.' };
        const alloc = {}, rate = {};
        ts.forEach((t) => { if (num(v['a_' + t.k]) > 0) alloc[t.k] = num(v['a_' + t.k]); if (num(v['r_' + t.k]) > 0) rate[t.k] = num(v['r_' + t.k]); delete v['a_' + t.k]; delete v['r_' + t.k]; });
        if (!Object.keys(alloc).length && !Object.keys(base.dayAlloc || {}).length) throw { userMsg: 'En az bir oda tipi için gece başına oda sayısı girin.' };
        const a = byId('accounts', v.accountId);
        const out = { ...(rec || {}), ...v, alloc, rate: v.rateMode === 'sabit' ? rate : (rec && rec.rate) || {}, accountName: a ? a.name : '', pick: (rec && rec.pick) || {}, dayAlloc: (rec && rec.dayAlloc) || {} };
        if (v.kind !== 'grup') delete out.oppId;
        out.log = snap(out);
        const id = await S.store.save('blocks', stamp(out));
        toast(rec ? 'Kaydedildi' : 'Oluşturuldu');
        setTimeout(() => openBlock(id), 0);
      },
      onDelete: rec && (can.admin() || rec.createdBy === S.user.uid) ? async () => { await S.store.remove('blocks', rec.id); toast('Silindi'); } : null,
    });
    // tür, otel ya da fiyat şekli değişince form yeniden kurulur (oda tipleri ve alanlar değişir)
    const f = $('#frm');
    const read = () => { const o = { ...data }; $$('[name]', f).forEach((el) => { o[el.name] = el.value; }); o.alloc = {}; o.rate = {};
      Object.keys(o).forEach((k) => { if (k.startsWith('a_')) { if (o[k] !== '') o.alloc[k.slice(2)] = num(o[k]); delete o[k]; } else if (k.startsWith('r_')) { if (o[k] !== '') o.rate[k.slice(2)] = num(o[k]); delete o[k]; } });
      return o; };
    ['kind', 'hotel', 'rateMode'].forEach((k) => { const el = f && f.elements[k]; if (el) el.addEventListener('change', () => { const o = read(); if (k === 'kind') o.status = o.kind === 'grup' ? 'opsiyon' : 'aktif'; show(o); }); });
  }
}
A.blockNew = (el) => { if (!can.edit('opps')) return; blockForm(null, { kind: el.dataset.k || 'allot', hotel: S.blocks.hotel !== 'all' ? S.blocks.hotel : 'ortunc', ...(el.dataset.acc ? { accountId: el.dataset.acc } : {}) }); };
A.blockFromOpp = (el) => {
  const o = byId('opps', el.dataset.id); if (!o) return;
  blockForm(null, { kind: 'grup', hotel: /elia/i.test(o.property || '') ? 'elia' : 'ortunc', name: o.title, accountId: o.accountId || '', oppId: o.id, from: o.start || '', to: o.end || '', cutoff: o.start ? addDays(o.start, -14) : '', alloc: o.rooms ? { [typesFor(/elia/i.test(o.property || '') ? 'elia' : 'ortunc', Number((o.start || today()).slice(0, 4)))[0].k]: num(o.rooms) } : {}, status: o.stage === 'kazanildi' ? 'kesin' : 'opsiyon' });
};
A.blockEdit = (el) => { const b = byId('blocks', el.dataset.id); if (b) blockForm(b); };

/* ---------- blok ekranı (pick-up girişi) ---------- */
let BX = null;
export function openBlock(id) {
  const b = byId('blocks', id); if (!b) return;
  const ns = nights(b); const t = today();
  const months = [...new Set(ns.map((d) => d.slice(0, 7)))];
  const m0 = months.find((m) => m >= t.slice(0, 7)) || months[0];
  BX = { id, mode: 'pick', month: months.length > 1 ? m0 : 'all', pick: JSON.parse(JSON.stringify(b.pick || {})), dayAlloc: JSON.parse(JSON.stringify(b.dayAlloc || {})), dirty: false };
  bxRender();
}
A.blockOpen = (el) => openBlock(el.dataset.id);
function bxCur() { const b = byId('blocks', BX.id); return b ? { ...b, pick: BX.pick, dayAlloc: BX.dayAlloc } : null; }
function bxRender() {
  const b = bxCur(); if (!b) { closeModal(); return; }
  const ts = bTypes(b).length ? bTypes(b) : typesB(b).slice(0, 1); const allT = typesB(b); const s = bStats(b); const g = b.kind === 'grup'; const ed = can.edit('opps');
  const ns = nights(b); const months = [...new Set(ns.map((d) => d.slice(0, 7)))];
  const shown = BX.month === 'all' ? ns : ns.filter((d) => d.startsWith(BX.month));
  const acc = byId('accounts', b.accountId); const opp = b.oppId && byId('opps', b.oppId);
  const info = [
    ['Acente / firma', acc ? acc.name : b.accountName || ''], ['Otel', HOTEL_L[b.hotel || 'ortunc']], [g ? 'Giriş – çıkış' : 'Geçerlilik', fmtRange(b.from, b.to)],
    [g ? 'Cutoff' : 'Release', g ? (b.cutoff ? fmtDate(b.cutoff) : `${num(b.release)} gün önce`) : `${num(b.release)} gün önce`], ...(g ? [['Attrition', `%${num(b.attrition)}`]] : [['Komisyon', b.commission !== '' && b.commission != null ? '%' + b.commission : '']]),
    ['Fiyat', `${RATE_MODE[b.rateMode || 'liste']}${b.rateMode === 'indirim' ? ` · %${num(b.disc)} indirim` : ''}`], ['Pansiyon', MEAL[b.meal] || ''], ['Kontrat no', b.contractNo], ['İmza', fmtDate(b.signed)], ['Ödeme', b.payTerms], ['İptal', b.cancel], ['Talep', opp ? opp.title : ''], ['Not', b.notes],
  ].filter((x) => x[1]);
  const kp = [
    `<div class="kb"><small>Blok oda-gece</small><b>${fmtNum(s.alloc)}</b><em>${s.nightsN} gece · en çok ${fmtNum(s.maxNight)} oda/gece</em></div>`,
    `<div class="kb"><small>Alınan (pick-up)</small><b>${fmtNum(s.pick)}</b><em>${pc(s.pct)}</em>${pbar(s.pct)}</div>`,
    `<div class="kb ${s.open ? '' : ''}"><small>Garantili açık oda</small><b>${fmtNum(s.open)}</b><em>${s.nextRel ? 'ilk release ' + fmtDate(s.nextRel) : 'release bekleyen yok'}</em></div>`,
    `<div class="kb"><small>Release olmuş / kullanılmamış</small><b>${fmtNum(s.released + s.unusedPast)}</b><em>${fmtNum(s.released)} ileri tarih · ${fmtNum(s.unusedPast)} geçmiş</em></div>`,
    `<div class="kb"><small>Alınan oda geliri</small><b>${km(s.rev)}</b><em>blok dolarsa ${km(s.pot)}${s.noPrice ? ' · bazı gecelerde fiyat yok' : ''}</em></div>`,
    ...(g ? [`<div class="kb ${s.short ? 'warn' : ''}"><small>Attrition</small><b>${s.short ? fmtNum(s.short) + ' oda eksik' : 'Sorun yok'}</b><em>en az ${fmtNum(s.min)} oda-gece · ceza riski ${km(s.penalty)}</em></div>`] : []),
  ].join('');
  const typeT = `<table class="tb"><tr><th>Oda tipi</th><th class="n">Blok</th><th class="n">Alınan</th><th class="n">Kalan</th><th class="n">Pick-up</th><th class="n">Gelir</th></tr>${Object.values(s.byType).map((x) => `<tr><td>${esc(x.t.label)}</td><td class="n">${fmtNum(x.a)}</td><td class="n">${fmtNum(x.p)}</td><td class="n">${fmtNum(Math.max(0, x.a - x.p))}</td><td class="n">${pc(x.a ? (x.p / x.a) * 100 : null)}</td><td class="n">${km(x.rev)}</td></tr>`).join('')}</table>`;
  const gridT = (BX.mode === 'alloc' ? allT : ts);
  const grid = `<div class="scroll-x" style="max-height:52vh;overflow:auto"><table class="tb bgrid day"><tr><th>Gece</th><th>Gün</th><th>Release</th>${gridT.map((ty) => `<th class="n">${esc(ty.label)}${BX.mode === 'pick' ? '<div class="sub">alınan / blok</div>' : '<div class="sub">blok</div>'}</th>`).join('')}<th class="n">Toplam</th><th class="n">Kalan</th></tr>
    ${shown.map((d) => { const w = new Date(d + 'T12:00:00').getDay(); const [rl, rc] = relLabel(b, d); const A_ = gridT.reduce((x, ty) => x + allocOn(b, d, ty.k), 0), P_ = gridT.reduce((x, ty) => x + pickOn(b, d, ty.k), 0);
      return `<tr class="${w === 5 || w === 6 ? 'we' : ''}"><td>${esc(fmtDate(d))}</td><td>${WD[w]}</td><td class="${rc === 'warn' ? 'neg' : rc}" style="white-space:nowrap;font-size:12.5px">${esc(fmtDate(relDate(b, d)))} · ${rl}</td>
      ${gridT.map((ty) => { const a = allocOn(b, d, ty.k), p = pickOn(b, d, ty.k); return BX.mode === 'pick'
        ? `<td class="n" style="white-space:nowrap">${ed ? `<input class="inp" style="min-width:52px;width:58px" inputmode="numeric" data-bx="${d}|${ty.k}" value="${p || ''}" placeholder="0">` : fmtNum(p)} <span class="muted">/ ${a}</span></td>`
        : `<td class="n">${ed ? `<input class="inp ${b.dayAlloc && b.dayAlloc[d] && b.dayAlloc[d][ty.k] != null ? 'ovr' : ''}" style="min-width:52px;width:62px" inputmode="numeric" data-bx="${d}|${ty.k}" value="${a || ''}" placeholder="0">` : a}</td>`; }).join('')}
      <td class="n"><b>${P_}</b> / ${A_}</td><td class="n">${Math.max(0, A_ - P_) || ''}</td></tr>`; }).join('')}
    </table></div>`;
  const log = (b.log || []).slice(-12).reverse();
  const logT = log.length ? `<table class="tb"><tr><th>Tarih</th><th class="n">Alınan</th><th class="n">Blok</th><th class="n">Pick-up</th><th>Giren</th></tr>${log.map((x) => `<tr><td>${esc(fmtDate(x.d))}</td><td class="n">${fmtNum(x.p)}</td><td class="n">${fmtNum(x.a)}</td><td class="n">${pc(x.a ? (x.p / x.a) * 100 : null)}</td><td>${esc(x.by || '')}</td></tr>`).join('')}</table>` : '<span class="muted">Henüz kayıt yok.</span>';
  $('#modal').innerHTML = `<div class="ov center"><div class="modal bmodal"><div class="mh"><h2>${esc(b.name)}</h2><button class="x" data-act="blockClose" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb">
      <div class="acts" style="margin-bottom:8px"><span class="badge teal">${esc(BK_KIND[b.kind])}</span><span class="badge ${ST_B[b.status] || ''}">${esc(ST_ALL[b.status] || '')}</span>
        <span class="sp" style="flex:1"></span>${ed ? `<button class="btn sm" data-act="blockEdit" data-id="${b.id}">${ic('pencil')} Bilgileri düzenle</button>` : ''}<button class="btn sm" data-act="blockXls" data-id="${b.id}">${ic('table')} Excel</button><button class="btn sm" data-act="blockPdf" data-id="${b.id}">${ic('printer')} PDF</button></div>
      <div class="kband">${kp}</div>
      <div class="grid g2" style="margin-bottom:12px"><div class="card pad"><h3>Bilgiler</h3><dl class="dl">${info.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div><div class="card pad"><h3>Oda tipine göre</h3>${typeT}</div></div>
      <div class="card pad">
        <div class="dayhead"><div class="seg" role="group" aria-label="Giriş"><button class="${BX.mode === 'pick' ? 'on' : ''}" data-act="bxMode" data-m="pick">Alınan odalar (pick-up)</button><button class="${BX.mode === 'alloc' ? 'on' : ''}" data-act="bxMode" data-m="alloc">Bloğu gün gün düzenle</button></div>
        ${months.length > 1 ? `<div class="seg" role="group" aria-label="Ay"><button class="${BX.month === 'all' ? 'on' : ''}" data-act="bxMonth" data-m="all">Tümü</button>${months.map((m) => `<button class="${BX.month === m ? 'on' : ''}" data-act="bxMonth" data-m="${m}">${MON3[Number(m.slice(5)) - 1]}${m.slice(0, 4) !== months[0].slice(0, 4) ? ' ' + m.slice(2, 4) : ''}</button>`).join('')}</div>` : ''}<span class="sp"></span></div>
        ${ed ? `<div class="dayhead" style="font-size:13px"><b>Toplu giriş</b><input type="date" class="inp" id="bxF" style="width:auto" value="${shown[0] || ''}"><span>–</span><input type="date" class="inp" id="bxT" style="width:auto" value="${shown[shown.length - 1] || ''}">
          <select class="inp" id="bxK" style="width:auto">${gridT.map((ty) => `<option value="${ty.k}">${esc(ty.label)}</option>`).join('')}</select>
          <select class="inp" id="bxOp" style="width:auto"><option value="set">şu sayı olsun</option><option value="add">ekle</option><option value="sub">çıkar</option>${BX.mode === 'pick' ? '<option value="full">bloğu doldur</option>' : ''}</select>
          <input class="inp" id="bxN" inputmode="numeric" style="width:70px" placeholder="oda"><button class="btn sm" data-act="bxBulk">Uygula</button></div>` : ''}
        <p class="muted" style="font-size:12.5px;margin:0 0 6px">${BX.mode === 'pick' ? 'Her gece için oda tipine göre alınan (rooming list / rezervasyon) oda sayısını girin. Blok dışına çıkan fazla oda da girilebilir.' : 'Bu ekranda gece başına blok sayısını değiştirirsiniz; altı çizili hücreler genel bloktan farklıdır. Diğer oda tiplerine de buradan blok verebilirsiniz.'}</p>
        ${grid}
        <div class="err" id="bxErr" hidden></div>
      </div>
      <div class="card pad" style="margin-top:12px"><h3>Pick-up geçmişi</h3><p class="muted" style="font-size:12.5px;margin:0 0 6px">Her kayıtta o günün toplamı saklanır; grubun ne hızla dolduğunu buradan izlersiniz.</p>${logT}</div>
    </div>
    <div class="mf">${BX.dirty ? '<span class="muted" style="margin-right:auto">Kaydedilmemiş değişiklik var</span>' : ''}<button class="btn" data-act="blockClose">Kapat</button>${ed ? '<button class="btn pri" data-act="bxSave">Kaydet</button>' : ''}</div></div></div>`;
  $$('[data-bx]').forEach((el) => el.addEventListener('input', () => {
    const [d, k] = el.dataset.bx.split('|'); const v = el.value.trim() === '' ? '' : num(el.value);
    if (BX.mode === 'pick') { const o = BX.pick[d] || (BX.pick[d] = {}); if (v === '' || v === 0) delete o[k]; else o[k] = v; if (!Object.keys(o).length) delete BX.pick[d]; }
    else { const o = BX.dayAlloc[d] || (BX.dayAlloc[d] = {}); const base = num((b.alloc || {})[k]); if (v === '' ? base === 0 : v === base) delete o[k]; else o[k] = v === '' ? 0 : v; if (!Object.keys(o).length) delete BX.dayAlloc[d]; }
    BX.dirty = true;
  }));
  $$('[data-bx]').forEach((el) => el.addEventListener('change', () => setTimeout(() => { if (!BX || !$('.bgrid')) return; const sc = $('.bgrid') && $('.bgrid').closest('.scroll-x'); const top = sc ? sc.scrollTop : 0; const mb = $('.modal .mb'); const mt = mb ? mb.scrollTop : 0; bxRender(); const sc2 = $('.bgrid') && $('.bgrid').closest('.scroll-x'); if (sc2) sc2.scrollTop = top; const mb2 = $('.modal .mb'); if (mb2) mb2.scrollTop = mt; }, 0)));
}
A.bxMode = (el) => { BX.mode = el.dataset.m; bxRender(); };
A.bxMonth = (el) => { BX.month = el.dataset.m; bxRender(); };
A.bxBulk = () => {
  const b = bxCur(); const f = $('#bxF').value, t = $('#bxT').value, k = $('#bxK').value, op = $('#bxOp').value, n = num($('#bxN').value);
  const err = $('#bxErr'); if (!f || !t || t < f) { err.textContent = 'Tarih aralığını kontrol edin.'; err.hidden = false; return; }
  if (op !== 'full' && $('#bxN').value.trim() === '') { err.textContent = 'Oda sayısını yazın.'; err.hidden = false; return; }
  let c = 0;
  nights(b).filter((d) => d >= f && d <= t).forEach((d) => {
    if (BX.mode === 'pick') { const cur = pickOn(b, d, k); const nv = op === 'full' ? allocOn(b, d, k) : op === 'add' ? cur + n : op === 'sub' ? Math.max(0, cur - n) : n; const o = BX.pick[d] || (BX.pick[d] = {}); if (nv) o[k] = nv; else delete o[k]; if (!Object.keys(o).length) delete BX.pick[d]; }
    else { const cur = allocOn(b, d, k); const nv = op === 'add' ? cur + n : op === 'sub' ? Math.max(0, cur - n) : n; const base = num((b.alloc || {})[k]); const o = BX.dayAlloc[d] || (BX.dayAlloc[d] = {}); if (nv === base) delete o[k]; else o[k] = nv; if (!Object.keys(o).length) delete BX.dayAlloc[d]; }
    c++;
  });
  BX.dirty = true; bxRender(); toast(`${c} gece güncellendi; kaydetmeyi unutmayın`);
};
A.bxSave = async () => {
  const b = byId('blocks', BX.id); if (!b) return;
  const out = { ...b, pick: BX.pick, dayAlloc: BX.dayAlloc }; out.log = snap(out);
  try { await S.store.save('blocks', stamp(out)); BX.dirty = false; toast('Kaydedildi'); setTimeout(bxRender, 0); }
  catch (e) { const er = $('#bxErr'); if (er) { er.textContent = errText(e); er.hidden = false; } }
};
A.blockClose = () => { if (BX && BX.dirty) return confirmBox('Kaydedilmemiş değişiklikler kaybolacak. Kapatılsın mı?', 'Kapat', () => { BX = null; closeModal(); }); BX = null; closeModal(); };

/* ---------- Excel / PDF ---------- */
function dayRows(list) {
  const rows = [['Blok', 'Tür', 'Otel', 'Acente / firma', 'Gece', 'Gün', 'Oda tipi', 'Blok', 'Alınan', 'Kalan', 'Release tarihi', 'Durum', 'Gecelik fiyat', 'Alınan gelir']];
  const t = today();
  list.forEach((b) => { const ts = bTypes(b); nights(b).forEach((d) => ts.forEach((ty) => { const a = allocOn(b, d, ty.k), p = pickOn(b, d, ty.k); if (!a && !p) return; const rd = relDate(b, d); const pr = priceB(b, d, ty.k);
    rows.push([b.name, BK_KIND[b.kind], HOTEL_L[b.hotel || 'ortunc'], b.accountName || '', d, WD[new Date(d + 'T12:00:00').getDay()], ty.label, a, p, Math.max(0, a - p), rd, d < t ? 'Geçti' : rd < t ? 'Release oldu' : 'Açık', pr || '', p * pr]); })); });
  return rows;
}
function sumRow(b) { const s = bStats(b); return [b.name, BK_KIND[b.kind], ST_ALL[b.status] || '', HOTEL_L[b.hotel || 'ortunc'], b.accountName || '', b.from, b.to, b.kind === 'grup' ? (b.cutoff || '') : `${num(b.release)} gün`, s.alloc, s.pick, s.pct == null ? '' : Math.round(s.pct) / 100, s.open, s.released + s.unusedPast, Math.round(s.rev), Math.round(s.pot), b.kind === 'grup' ? s.short : '', b.kind === 'grup' ? Math.round(s.penalty) : '']; }
const SUM_H = ['Blok', 'Tür', 'Durum', 'Otel', 'Acente / firma', 'Başlangıç / giriş', 'Bitiş / çıkış', 'Release / cutoff', 'Blok oda-gece', 'Alınan', 'Pick-up %', 'Garantili açık', 'Release olmuş / kullanılmamış', 'Alınan gelir', 'Blok dolarsa gelir', 'Attrition eksik oda', 'Ceza riski'];
export function exportBlocks(list, name) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([SUM_H, ...list.map(sumRow)]); ws['!cols'] = SUM_H.map((h, i) => ({ wch: i === 0 ? 34 : i === 4 ? 24 : 13 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Bloklar');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dayRows(list)), 'Gece gece');
  const rel = releases(60, list); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Release tarihi', 'Blok', 'Acente / firma', 'Release olacak oda-gece', 'Geceler'], ...rel.map((x) => [x.rd, x.b.name, x.b.accountName || '', x.rooms, fmtRange(x.nights[0], x.nights[x.nights.length - 1])])]), 'Release takvimi 60 gün');
  if (list.length === 1 && (list[0].log || []).length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Tarih', 'Alınan', 'Blok', 'Giren'], ...list[0].log.map((x) => [x.d, x.p, x.a, x.by || ''])]), 'Pick-up geçmişi');
  saveFile(`${name.replace(/[^\p{L}\p{N}]+/gu, '-')}-${today()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
}
const PCSS = `.bp h1{font-size:17px;margin:0 0 2px}.bp .sub{color:#69768D;font-size:11px}.bp table{width:100%;border-collapse:collapse;font-size:10.5px;margin:8px 0 14px}.bp th,.bp td{border-bottom:1px solid #E2E7EF;padding:3px 5px;text-align:left}.bp th{background:#EEF2F7}.bp .n{text-align:right}.bp h2{font-size:13px;margin:12px 0 2px;border-bottom:2px solid #1F5E8C}.bp tr.we td{background:#FBF8EF}`;
export function printBlocks(list, title) {
  const t = today();
  let html = `<div class="bp"><h1>${esc(title)}</h1><div class="sub">${esc(fmtDate(t))} itibarıyla · fiyatlar oda + kahvaltı, vergiler dahil</div>
    <table><tr><th>Blok</th><th>Acente / firma</th><th>Tarih</th><th>Release / cutoff</th><th class="n">Blok</th><th class="n">Alınan</th><th class="n">Pick-up</th><th class="n">Garantili açık</th><th class="n">Alınan gelir</th></tr>
    ${list.map((b) => { const s = bStats(b); return `<tr><td>${esc(b.name)}<div class="sub">${esc(BK_KIND[b.kind])} · ${esc(ST_ALL[b.status] || '')}</div></td><td>${esc(b.accountName || '')}</td><td>${esc(fmtRange(b.from, b.to))}</td><td>${esc(b.kind === 'grup' ? (b.cutoff ? fmtDate(b.cutoff) : '') : `${num(b.release)} gün`)}</td><td class="n">${fmtNum(s.alloc)}</td><td class="n">${fmtNum(s.pick)}</td><td class="n">${pc(s.pct)}</td><td class="n">${fmtNum(s.open)}</td><td class="n">${km(s.rev)}</td></tr>`; }).join('')}</table>`;
  if (list.length === 1) {
    const b = list[0]; const ts = bTypes(b); const s = bStats(b);
    if (b.kind === 'grup') html += `<p style="font-size:11px">Attrition %${num(b.attrition)} · en az ${fmtNum(s.min)} oda-gece · ${s.short ? `${fmtNum(s.short)} oda eksik, ceza riski ${esc(km(s.penalty))}` : 'eksik yok'}</p>`;
    html += `<h2>Gece gece</h2><table><tr><th>Gece</th><th>Release</th>${ts.map((x) => `<th class="n">${esc(x.label)}</th>`).join('')}<th class="n">Toplam</th></tr>${nights(b).map((d) => { const w = new Date(d + 'T12:00:00').getDay(); const P = ts.reduce((x, y) => x + pickOn(b, d, y.k), 0), Al = ts.reduce((x, y) => x + allocOn(b, d, y.k), 0); return `<tr class="${w === 5 || w === 6 ? 'we' : ''}"><td>${esc(fmtDate(d))} ${WD[w]}</td><td>${esc(fmtDate(relDate(b, d)))}</td>${ts.map((x) => `<td class="n">${pickOn(b, d, x.k)} / ${allocOn(b, d, x.k)}</td>`).join('')}<td class="n"><b>${P}</b> / ${Al}</td></tr>`; }).join('')}</table>`;
  } else {
    const rel = releases(30, list);
    if (rel.length) html += `<h2>Önümüzdeki 30 gün release</h2><table><tr><th>Release</th><th>Blok</th><th>Acente / firma</th><th class="n">Oda-gece</th><th>Geceler</th></tr>${rel.map((x) => `<tr><td>${esc(fmtDate(x.rd))}</td><td>${esc(x.b.name)}</td><td>${esc(x.b.accountName || '')}</td><td class="n">${x.rooms}</td><td>${esc(fmtRange(x.nights[0], x.nights[x.nights.length - 1]))}</td></tr>`).join('')}</table>`;
  }
  printHtml(title, html + '</div>', PCSS);
}
A.blockXls = (el) => { const b = byId('blocks', el.dataset.id); if (b) exportBlocks([b], 'Blok-' + b.name); };
A.blockPdf = (el) => { const b = byId('blocks', el.dataset.id); if (b) printBlocks([b], b.name); };
A.blocksXls = () => { const l = filtered(); if (!l.length) return toast('Listede blok yok.'); exportBlocks(l, 'Allotman-ve-bloklar'); };
A.blocksPdf = () => { const l = filtered(); if (!l.length) return toast('Listede blok yok.'); printBlocks(l, 'Allotman ve grup blokları'); };

/* ---------- ana görünüm ---------- */
A.blkSet = (el) => { S.blocks[el.dataset.f] = el.dataset.v; A._renderView(); };
A.blkMon = (el) => { const [y, m] = S.blocks.month.split('-').map(Number); const d = new Date(y, m - 1 + Number(el.dataset.d), 1, 12); S.blocks.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; A._renderView(); };
const segB = (f, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${S.blocks[f] === v ? 'on' : ''}" data-act="blkSet" data-f="${f}" data-v="${v}">${l}</button>`).join('')}</div>`;
V.blocks = {
  title: () => 'Allotman & bloklar',
  head: () => `${can.edit('opps') ? `<button class="btn pri" data-act="blockNew" data-k="allot">${ic('plus')}<span class="hide-m"> Kontrat / allotman</span></button><button class="btn" data-act="blockNew" data-k="grup">${ic('plus')}<span class="hide-m"> Grup blok</span></button>` : ''}<button class="btn" data-act="blocksXls">${ic('table')}<span class="hide-m"> Excel</span></button><button class="btn" data-act="blocksPdf" title="PDF">${ic('printer')}</button>`,
  body: () => {
    const F = S.blocks; const t = today(); const list = filtered(); const lv = list.filter(live);
    const bar = `<div class="perfbar">${segB('hotel', [['all', 'İki otel'], ...Object.entries(HOTEL_L)])}${segB('kind', [['all', 'Tümü'], ['allot', 'Kontrat / allotman'], ['grup', 'Grup blok']])}${segB('when', [['now', 'Güncel ve gelecek'], ['past', 'Geçmiş'], ['all', 'Hepsi']])}${segB('tab', [['list', 'Liste'], ['cal', 'Takvim'], ['rel', 'Release takvimi']])}</div>`;
    if (!BL().length) return `${bar}<div class="card empty"><b>Henüz kontrat, allotman ya da grup bloğu yok</b>Acentelere verdiğiniz allotmanı ve grup bloklarını oda tipine göre gece gece girin; alınan odaları işaretledikçe pick-up oranı, kalan oda, release ve cutoff tarihleri burada izlenir. Grup taleplerinin içinden de "Grup bloğu aç" ile başlayabilirsiniz.${can.edit('opps') ? `<div class="acts" style="justify-content:center;margin-top:10px"><button class="btn pri" data-act="blockNew" data-k="allot">${ic('plus')} Kontrat / allotman</button><button class="btn" data-act="blockNew" data-k="grup">${ic('plus')} Grup blok</button></div>` : ''}</div>`;
    const t30 = addDays(t, 29);
    const S30 = lv.reduce((a, b) => { const s = bStats(b, t, t30); a.al += s.alloc; a.pk += s.pick; return a; }, { al: 0, pk: 0 });
    const ST = lv.map((b) => [b, bStats(b)]);
    const open = ST.reduce((s, [, x]) => s + x.open, 0); const rev = ST.reduce((s, [, x]) => s + x.rev, 0);
    const rel7 = releases(7, list); const rel7n = rel7.reduce((s, x) => s + x.rooms, 0);
    const risk = ST.filter(([b, x]) => attnRisk(b, x));
    const kband = `<div class="kband">
      <div class="kb"><small>Aktif kontrat / allotman</small><b>${lv.filter((b) => b.kind === 'allot').length}</b><em>${lv.filter((b) => b.kind === 'grup').length} grup blok (${lv.filter((b) => b.kind === 'grup' && b.status === 'kesin').length} kesin)</em></div>
      <div class="kb"><small>Önümüzdeki 30 gün · blok</small><b>${fmtNum(S30.al)}</b><em>alınan ${fmtNum(S30.pk)} · ${pc(S30.al ? (S30.pk / S30.al) * 100 : null)}</em>${pbar(S30.al ? (S30.pk / S30.al) * 100 : 0)}</div>
      <div class="kb"><small>Garantili açık oda-gece</small><b>${fmtNum(open)}</b><em>release olmamış, satılmamış</em></div>
      <button class="kb ${rel7n ? 'warn' : ''}" data-act="blkSet" data-f="tab" data-v="rel"><small>7 gün içinde release</small><b>${fmtNum(rel7n)}</b><em>${rel7.length} release · oda-gece otele döner</em></button>
      <div class="kb ${risk.length ? 'warn' : ''}"><small>Attrition riski</small><b>${km(risk.reduce((s, [, x]) => s + x.penalty, 0))}</b><em>${risk.length} grup alt sınırın altında · cutoff 14 gün içinde</em></div>
      <div class="kb"><small>Alınan blok geliri</small><b>${km(rev)}</b><em>oda + kahvaltı, vergiler dahil</em></div></div>`;
    let body = '';
    if (F.tab === 'list') {
      body = list.length ? `<div class="card"><div class="scroll-x"><table class="tb perf-t"><tr><th>Blok</th><th>Otel</th><th>Tarih</th><th class="n">Oda/gece</th><th class="n">Blok</th><th class="n">Alınan</th><th>Pick-up</th><th class="n">Açık</th><th>Sonraki release</th><th>Durum</th></tr>
        ${list.map((b) => { const s = bStats(b); return `<tr style="cursor:pointer" data-act="blockOpen" data-id="${b.id}"><td><b>${esc(b.name)}</b><div class="sub">${esc(BK_KIND[b.kind])}${b.accountName ? ' · ' + esc(b.accountName) : ''}</div></td><td>${esc(HOTEL_L[b.hotel || 'ortunc'].split(' ')[0])}</td><td style="white-space:nowrap">${esc(fmtRange(b.from, b.to))}</td><td class="n">${fmtNum(rpn(b))}</td><td class="n">${fmtNum(s.alloc)}</td><td class="n">${fmtNum(s.pick)}</td><td style="min-width:90px">${pc(s.pct)}${pbar(s.pct)}</td><td class="n">${fmtNum(s.open)}</td><td style="white-space:nowrap">${s.nextRel ? esc(fmtDate(s.nextRel)) : '—'}${b.kind === 'grup' && s.short ? `<div class="sub neg">${fmtNum(s.short)} oda eksik</div>` : ''}</td><td><span class="badge ${ST_B[b.status] || ''}">${esc(ST_ALL[b.status] || '')}</span></td></tr>`; }).join('')}
        </table></div></div>` : '<div class="card empty">Bu filtrede blok yok.</div>';
    } else if (F.tab === 'cal') {
      const [y, m] = F.month.split('-').map(Number); const dim = new Date(y, m, 0).getDate(); const days = Array.from({ length: dim }, (_, i) => `${F.month}-${String(i + 1).padStart(2, '0')}`);
      const rows = list.filter((b) => { const n = nights(b); return n.length && n[0] <= days[dim - 1] && n[n.length - 1] >= days[0]; });
      const cell = (b, d) => { if (!inR(b, d)) return '<td></td>'; const ts = bTypes(b); const a = ts.reduce((s, x) => s + allocOn(b, d, x.k), 0); if (!a && !ts.some((x) => pickOn(b, d, x.k))) return '<td></td>'; const p = ts.reduce((s, x) => s + pickOn(b, d, x.k), 0); const rel = relDate(b, d) < t && d >= t; const full = p >= a;
        return `<td class="n" title="${esc(b.name)} · ${fmtDate(d)}: ${p} / ${a}${rel ? ' · release oldu' : ''}" style="font-size:11.5px;padding:3px 2px;${full ? 'background:#E6EEDC' : rel ? 'background:#F0F1F4;color:#8A95A8' : p ? 'background:#E3EDF6' : 'background:#FBF3E4'}">${p}/${a}</td>`; };
      const totA = (d) => rows.filter((b) => live(b) && inR(b, d)).reduce((s, b) => s + bTypes(b).reduce((x, k) => x + allocOn(b, d, k.k), 0), 0), totP = (d) => rows.filter((b) => live(b) && inR(b, d)).reduce((s, b) => s + bTypes(b).reduce((x, k) => x + pickOn(b, d, k.k), 0), 0);
      body = `<div class="card pad"><div class="dayhead"><button class="btn sm" data-act="blkMon" data-d="-1" aria-label="Önceki ay">${ic('left')}</button><b>${MONTHS[m - 1]} ${y}</b><button class="btn sm" data-act="blkMon" data-d="1" aria-label="Sonraki ay">${ic('right')}</button><span class="sp"></span><span class="muted" style="font-size:12.5px">alınan / blok · <span style="background:#E6EEDC;padding:0 4px">dolu</span> <span style="background:#E3EDF6;padding:0 4px">kısmen</span> <span style="background:#FBF3E4;padding:0 4px">boş</span> <span style="background:#F0F1F4;padding:0 4px">release oldu</span></span></div>
        ${rows.length ? `<div class="scroll-x"><table class="tb" style="font-size:12px"><tr><th style="position:sticky;left:0;background:#fff">Blok</th>${days.map((d) => { const w = new Date(d + 'T12:00:00').getDay(); return `<th class="n" style="padding:3px 2px;${w === 5 || w === 6 ? 'background:#FBF8EF' : ''}">${Number(d.slice(8))}<div class="sub">${WD[w].slice(0, 2)}</div></th>`; }).join('')}</tr>
          ${rows.map((b) => `<tr><td style="position:sticky;left:0;background:#fff;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis"><a href="#" data-act="blockOpen" data-id="${b.id}">${esc(b.name)}</a></td>${days.map((d) => cell(b, d)).join('')}</tr>`).join('')}
          <tr class="tot"><td style="position:sticky;left:0;background:#fff">Toplam</td>${days.map((d) => { const a = totA(d), p = totP(d); return `<td class="n" style="font-size:11px;padding:3px 2px">${a || p ? `${p}/${a}` : ''}</td>`; }).join('')}</tr></table></div>` : '<p class="muted">Bu ayda blok yok.</p>'}</div>`;
    } else {
      const rel = releases(60, list);
      body = `<div class="card"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">Önümüzdeki 60 gün release ve cutoff</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">Bu tarihlerde satılmamış odalar otele döner. Acenteyi arayıp pick-up isteyin ya da odaları satışa açın.</p></div>
        ${rel.length ? `<div class="scroll-x"><table class="tb"><tr><th>Release</th><th>Blok</th><th>Acente / firma</th><th>Geceler</th><th class="n">Dönecek oda-gece</th><th></th></tr>${rel.map((x) => { const n = Math.round((new Date(x.rd) - new Date(t)) / 864e5); return `<tr><td style="white-space:nowrap"><b>${esc(fmtDate(x.rd))}</b><div class="sub ${n <= 3 ? 'neg' : ''}">${n === 0 ? 'bugün' : n + ' gün sonra'}</div></td><td>${esc(x.b.name)}<div class="sub">${esc(BK_KIND[x.b.kind])}</div></td><td>${esc(x.b.accountName || '')}</td><td style="white-space:nowrap">${esc(fmtRange(x.nights[0], x.nights[x.nights.length - 1]))}${x.nights.length > 1 ? ` · ${x.nights.length} gece` : ''}</td><td class="n"><b>${x.rooms}</b></td><td><button class="btn sm" data-act="blockOpen" data-id="${x.b.id}">Pick-up gir</button></td></tr>`; }).join('')}</table></div>` : '<div class="pad muted" style="padding-top:0">Önümüzdeki 60 günde release olacak satılmamış oda yok.</div>'}</div>`;
    }
    return `<div class="perf">${bar}${kband}${body}</div>`;
  },
};

/* ---------- diğer ekranlara bağlantılar ---------- */
const miniRow = (b) => { const s = bStats(b); return `<button class="row" data-act="blockOpen" data-id="${b.id}"><div class="t"><b>${esc(b.name)}</b><span>${esc(fmtRange(b.from, b.to))} · ${fmtNum(s.pick)} / ${fmtNum(s.alloc)} oda-gece${s.nextRel ? ' · release ' + esc(fmtDate(s.nextRel)) : ''}</span></div><div class="r"><b>${pc(s.pct)}</b><span class="badge ${ST_B[b.status] || ''}">${esc(ST_ALL[b.status] || '')}</span></div></button>`; };
A._blocksOfAcc = (id) => { const l = sortBy(BL().filter((b) => b.accountId === id), (b) => b.from || '', -1); return l.length || can.edit('opps') ? `<div class="card"><div class="pad" style="padding-bottom:4px;display:flex;align-items:center"><h3 style="margin:0;flex:1">Kontrat, allotman ve bloklar</h3>${can.edit('opps') ? `<button class="btn sm" data-act="blockNew" data-k="allot" data-acc="${id}">${ic('plus')} Allotman</button>` : ''}</div>${l.length ? `<div class="list">${l.slice(0, 8).map(miniRow).join('')}</div>` : '<div class="pad muted" style="padding-top:0">Bu acenteye tanımlı allotman yok.</div>'}</div>` : ''; };
A._blockCard = (o) => { const l = BL().filter((b) => b.oppId === o.id); if (l.length) return `<div class="card"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">Oda bloğu</h3></div><div class="list">${l.map(miniRow).join('')}</div></div>`; return o.kind === 'grup' && can.edit('opps') && o.stage !== 'kaybedildi' ? `<div class="card pad" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="flex:1">Bu grup için oda bloğu açılmamış. Blok açınca rooming list geldikçe pick-up ve cutoff takip edilir.</span><button class="btn sm" data-act="blockFromOpp" data-id="${o.id}">${ic('plus')} Grup bloğu aç</button></div>` : ''; };
let CAL = null;
A._blockCalEvents = (day) => {
  const key = BL(); if (!CAL || CAL.k !== key || CAL.t !== today()) { const m = {}; releases(400).forEach((x) => { (m[x.rd] = m[x.rd] || []).push(x); }); CAL = { k: key, t: today(), m }; }
  return (CAL.m[day] || []).map((x) => `<button class="ev t" data-act="blockOpen" data-id="${x.b.id}" title="Release: ${esc(x.b.name)} · ${x.rooms} oda-gece">⏱ ${esc(x.b.name)} (${x.rooms})</button>`);
};
A._blocksWidget = () => {
  const rel = releases(10); const t = today();
  const risk = BL().map((b) => [b, bStats(b)]).filter(([b, s]) => attnRisk(b, s));
  if (!BL().length) return '';
  return `<div class="card"><div class="pad" style="padding-bottom:4px;display:flex;align-items:center"><h3 style="margin:0;flex:1">Allotman & blok · 10 gün</h3><button class="btn sm" data-act="nav" data-v="blocks">${ic('list')} Tümü</button></div>
    ${rel.length || risk.length ? `<div class="list">${rel.slice(0, 6).map((x) => `<button class="row" data-act="blockOpen" data-id="${x.b.id}"><div class="av ${x.rd <= addDays(t, 2) ? 'terra' : ''}">${ic('calendar')}</div><div class="t"><b>${esc(x.b.name)}</b><span>${esc(fmtDate(x.rd))} release · ${x.rooms} oda-gece satılmadı</span></div></button>`).join('')}
    ${risk.slice(0, 4).map(([b, s]) => `<button class="row" data-act="blockOpen" data-id="${b.id}"><div class="av terra">${ic('warn')}</div><div class="t"><b>${esc(b.name)}</b><span>attrition: ${fmtNum(s.short)} oda eksik${s.penalty ? ' · ceza riski ' + km(s.penalty) : ''}</span></div></button>`).join('')}</div>` : '<div class="pad muted" style="padding-top:0">Yaklaşan release ya da attrition riski yok.</div>'}</div>`;
};
A._blockWarn = () => {
  const t = today(); const out = releases(3).map((x) => `${x.b.name}: ${fmtDate(x.rd)} tarihinde ${x.rooms} oda-gece release oluyor (satılmadı)`);
  BL().forEach((b) => { const s = bStats(b); if (attnRisk(b, s)) out.push(`${b.name}: attrition sınırının ${fmtNum(s.short)} oda altında${s.penalty ? ` (ceza riski ${km(s.penalty)})` : ''}`); });
  return out;
};

/* ---------- rapor oluşturucu ---------- */
DS.blocks = {
  label: 'Allotman & bloklar (gece gece)', dates: [['date', 'Gece']],
  dims: () => [['hotel', 'Otel'], ['kind', 'Tür'], ['block', 'Blok'], ['account', 'Acente / firma'], ['type', 'Oda tipi'], ['status', 'Durum']],
  metrics: () => ({ alloc: ['Blok oda-gece', 'n'], pick: ['Alınan oda-gece', 'n'], rem: ['Kalan oda-gece', 'n'], rev: ['Alınan gelir', 'm'] }),
  rows: () => { const out = []; BL().forEach((b) => { const ts = bTypes(b); nights(b).forEach((d) => ts.forEach((ty) => { const a = allocOn(b, d, ty.k), p = pickOn(b, d, ty.k); if (!a && !p) return;
    out.push({ dates: { date: d }, dims: { hotel: HOTEL_L[b.hotel || 'ortunc'], kind: BK_KIND[b.kind], block: b.name, account: b.accountName || '', type: ty.label, status: ST_ALL[b.status] || '' }, amt: { rev: { TRY: p * priceB(b, d, ty.k) } }, n: { alloc: a, pick: p, rem: Math.max(0, a - p), count: 1 }, ref: null }); })); }); return out; },
};
QUICK.push(['Allotman & blok · aylık pick-up', { ds: 'blocks', dateField: 'date', period: 'thisYear', filters: [], groupBy: 'month', groupBy2: '', metrics: ['alloc', 'pick', 'rem', 'rev'], compare: 'none', chart: 'bar' }]);
QUICK.push(['Allotman & blok · acente bazında', { ds: 'blocks', dateField: 'date', period: 'thisYear', filters: [], groupBy: 'account', groupBy2: '', metrics: ['alloc', 'pick', 'rem', 'rev'], compare: 'none', chart: 'bar' }]);
