// Salon & banket (MICE): salonlar ve kapasiteleri, haftalık salon takvimi, çakışma kontrolü,
// etkinlik detayı ve BEO (Banquet Event Order) — departman notları, program, menü, teknik ihtiyaç, ücretler, revizyon
import * as XLSX from 'xlsx';
import { S, A, V, $, $$, esc, ic, today, addDays, fmtDate, fmtDateLong, fmtNum, money, num, MONTHS, toast, can, byId, sortBy, userName, openForm, closeModal, stamp, confirmBox, itemsOf, lineCalc, deptOf } from './core.js';
import { printHtml, saveFile } from './print.js';
import { DS, QUICK } from './builder.js';

export const SETUPS = { tiyatro: 'Tiyatro', sinif: 'Sınıf', u: 'U düzeni', boardroom: 'Toplantı masası', banket: 'Banket (yuvarlak masa)', kokteyl: 'Kokteyl (ayakta)', kabare: 'Kabare', ozel: 'Özel düzen' };
const CAP_K = ['tiyatro', 'sinif', 'u', 'boardroom', 'banket', 'kokteyl'];
export const EV_KIND = { toplanti: 'Toplantı / seminer', kahve: 'Coffee break', yemek: 'Yemek', kokteyl: 'Kokteyl / resepsiyon', gala: 'Gala / özel gece', dugun: 'Düğün / nişan', diger: 'Diğer' };
export const EV_STATUS = { opsiyon: 'Opsiyon', kesin: 'Kesin', iptal: 'İptal' };
const ST_B = { opsiyon: 'gold', kesin: 'olive', iptal: 'red' };
const HOTEL_L = { ortunc: 'Ortunç Otel', elia: 'Elia Otel' };
const DEPTN = [['mutfak', 'Mutfak'], ['servis', 'Servis / banket'], ['teknik', 'Teknik'], ['onburo', 'Ön büro'], ['hk', 'Kat hizmetleri'], ['muhasebe', 'Muhasebe']];
const AV = ['Projeksiyon + perde', 'LED ekran / TV', 'Ses sistemi', 'Telsiz mikrofon', 'Yaka mikrofonu', 'Kürsü', 'Flipchart', 'Sahne', 'Kayıt masası', 'Yönlendirme tabelası', 'Wi-Fi şifresi', 'Tercüme kabini'];
// salon adları örnektir; kapasiteleri ve adları "Salonlar" sekmesinden yönetici düzenler
const DEF_VENUES = [{ id: 'v1', hotel: 'ortunc', name: 'Toplantı salonu', cap: {} }, { id: 'v2', hotel: 'ortunc', name: 'Restoran', cap: {} }, { id: 'v3', hotel: 'ortunc', name: 'Bahçe / teras', cap: {} }, { id: 'v4', hotel: 'elia', name: 'Elia bahçe', cap: {} }];
export const venues = () => (S.settings.venues && S.settings.venues.length ? S.settings.venues : DEF_VENUES);
const vById = (id) => venues().find((v) => v.id === id);
const vName = (id) => { const v = vById(id); return v ? v.name : '—'; };
const D = () => S.data;
const EVS = () => D().events || [];
const live = (e) => e.status !== 'iptal';
const WD = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const weekStart = (d) => { const x = new Date(d + 'T12:00:00'); return addDays(d, -((x.getDay() + 6) % 7)); };
S.mice = S.mice || { hotel: 'all', tab: 'week', week: weekStart(today()), when: 'next' };
const km = (v) => (Math.abs(v || 0) >= 1e6 ? `₺${(v / 1e6).toFixed(2).replace('.', ',')} mn` : money(Math.round(v || 0)));
const tmin = (t) => { const [h, m] = String(t || '').split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };
export const evTotal = (e) => (e.charges || []).reduce((s, c) => s + num(c.qty === '' || c.qty == null ? 1 : c.qty) * num(c.price), 0);
const pax = (e) => num(e.gpax) || num(e.pax);
// aynı salon, aynı gün, saatleri çakışan (kurulum saati dahil) etkinlikler
export function conflicts(e, list = EVS()) {
  if (!live(e) || !e.venueId || !e.date) return [];
  const s1 = tmin(e.setupAt) ?? tmin(e.start) ?? 0, e1 = tmin(e.end) ?? 24 * 60;
  return list.filter((x) => x.id !== e.id && live(x) && x.venueId === e.venueId && x.date === e.date).filter((x) => { const s2 = tmin(x.setupAt) ?? tmin(x.start) ?? 0, e2 = tmin(x.end) ?? 24 * 60; return s1 < e2 && s2 < e1; });
}
const capOf = (e) => { const v = vById(e.venueId); return v && e.setup ? num((v.cap || {})[e.setup]) : 0; };
const nextBeo = (d) => { const y = (d || today()).slice(0, 4); const n = EVS().filter((x) => (x.beoNo || '').startsWith(`BEO-${y}-`)).map((x) => Number(x.beoNo.split('-')[2]) || 0); return `BEO-${y}-${String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0')}`; };
const refLabel = (e) => { if (!e.ref) return ''; const r = byId(e.ref.col, e.ref.id); return r ? (e.ref.col === 'weddings' ? r.couple : r.title) : ''; };

/* ---------- form ---------- */
export function eventForm(rec, preset = {}) {
  const data = rec ? JSON.parse(JSON.stringify(rec)) : { status: 'opsiyon', kind: 'toplanti', setup: 'tiyatro', date: today(), start: '09:00', end: '17:00', av: [], program: [], charges: [], ...preset };
  const vOpts = venues().map((v) => [v.id, `${HOTEL_L[v.hotel] ? HOTEL_L[v.hotel].split(' ')[0] + ' · ' : ''}${v.name}`]);
  if (!data.venueId) data.venueId = vOpts[0] && vOpts[0][0];
  const accs = [['', '—'], ...sortBy(D().accounts || [], (a) => (a.name || '').toLocaleLowerCase('tr-TR')).map((a) => [a.id, a.name])];
  openForm({
    title: rec ? `Etkinliği düzenle · ${rec.beoNo || ''}` : 'Yeni etkinlik (BEO)', wide: true, data,
    intro: data.ref ? `<p class="muted" style="margin:0 0 8px">Bağlı kayıt: <b>${esc(refLabel(data))}</b></p>` : '',
    fields: [
      { k: 'title', label: 'Etkinlik adı', req: true, ph: 'ör. X Firması bayi toplantısı · 1. gün' },
      { k: 'kind', label: 'Tür', type: 'select', opts: Object.entries(EV_KIND), req: true, half: true },
      { k: 'status', label: 'Durum', type: 'select', opts: Object.entries(EV_STATUS), req: true, half: true },
      { k: 'venueId', label: 'Salon', type: 'select', opts: vOpts, req: true, half: true },
      { k: 'setup', label: 'Oturma düzeni', type: 'select', opts: Object.entries(SETUPS), half: true },
      { k: 'date', label: 'Tarih', type: 'date', req: true, half: true },
      { k: 'setupAt', label: 'Salon hazır saati', type: 'time', half: true, hint: 'Kurulum bitmiş olmalı; çakışma kontrolünde bu saatten itibaren salon dolu sayılır.' },
      { k: 'start', label: 'Başlangıç', type: 'time', req: true, half: true },
      { k: 'end', label: 'Bitiş', type: 'time', req: true, half: true },
      { k: 'pax', label: 'Beklenen kişi', type: 'number', half: true },
      { k: 'gpax', label: 'Garanti kişi', type: 'number', half: true, hint: 'Faturalanacak en az kişi sayısı.' },
      { k: 'gDue', label: 'Garanti son günü', type: 'date', half: true },
      { k: 'accountId', label: 'Acente / firma', type: 'select', opts: accs, half: true },
      { k: 'contact', label: 'Etkinlik sorumlusu (müşteri)', half: true, ph: 'Ad soyad' },
      { k: 'contactPhone', label: 'Telefon', type: 'tel', half: true },
      { k: 'program', label: 'Program', type: 'rows', addLabel: 'Satır ekle', heads: ['Saat', 'Ne yapılacak', 'Yer / not'], sub: [{ k: 't', ph: '10:30', type: 'time' }, { k: 'what', ph: 'ör. Coffee break' }, { k: 'where', ph: 'ör. Fuaye' }] },
      { k: 'menu', label: 'Menü', type: 'textarea', ph: 'ör. Öğle: Ege mezeleri, levrek, mevsim salata, tatlı…\nCoffee break: kurabiye, poğaça, meyve' },
      { k: 'drinks', label: 'İçecek', type: 'textarea', ph: 'ör. Limitsiz meşrubat ve su; şarap 2 kadeh' },
      { type: 'section', label: 'Teknik ekipman', hint: 'İşaretleyin; ayrıntıyı alttaki nota yazın.' },
      { k: 'avNote', label: 'Teknik not', half: true, ph: 'ör. 2 telsiz mikrofon, HDMI kablo, sunum bilgisayarı müşteriden' },
      { k: 'decor', label: 'Dekor / çiçek / tabela', half: true },
      { type: 'section', label: 'Departman notları', hint: 'BEO çıktısında her departmana ayrı kutu olarak basılır.' },
      ...DEPTN.map(([k, l]) => ({ k: 'n_' + k, label: l, type: 'textarea', half: true })),
      { k: 'charges', label: 'Ücretler (vergiler dahil)', type: 'rows', addLabel: 'Kalem ekle', heads: ['Kalem', 'Miktar', 'Birim fiyat ₺'], sub: [{ k: 'name', ph: 'ör. Öğle yemeği' }, { k: 'qty', ph: 'kişi / adet', type: 'number' }, { k: 'price', ph: '0', type: 'number' }] },
      { k: 'billing', label: 'Fatura / ödeme talimatı', half: true, ph: 'ör. Tümü firmaya; ekstralar katılımcıya' },
      { k: 'notes', label: 'Genel not', type: 'textarea' },
    ],
    saveLabel: rec ? 'Kaydet' : 'Oluştur',
    onSave: async (v) => {
      if (tmin(v.end) != null && tmin(v.start) != null && tmin(v.end) <= tmin(v.start)) throw { userMsg: 'Bitiş saati başlangıçtan sonra olmalı (gece yarısını geçen etkinliklerde bitişi 23:59 girin).' };
      const notes = {}; DEPTN.forEach(([k]) => { if (v['n_' + k]) notes[k] = v['n_' + k]; delete v['n_' + k]; });
      const av = $$('[data-av]:checked').map((x) => x.value);
      const v0 = vById(v.venueId); const a = byId('accounts', v.accountId);
      const out = { ...(rec || {}), ...(rec ? {} : { ref: preset.ref || null }), ...v, deptNotes: notes, av, hotel: v0 ? v0.hotel : 'ortunc', accountName: a ? a.name : '' };
      if (!out.beoNo) out.beoNo = nextBeo(v.date);
      out.rev = rec ? num(rec.rev) + 1 : 0;
      out.revLog = [...(rec && rec.revLog || []), { at: Date.now(), by: S.user.name, n: out.rev }].slice(-40);
      const cf = conflicts(out);
      const id = await S.store.save('events', stamp(out));
      toast(cf.length ? `Kaydedildi · dikkat: aynı salonda çakışan etkinlik var (${cf.map((x) => x.title).join(', ')})` : rec ? `Kaydedildi · revizyon ${out.rev}` : `${out.beoNo} oluşturuldu`);
      setTimeout(() => openEvent(id), 0);
    },
    onDelete: rec && (can.admin() || rec.createdBy === S.user.uid) ? async () => { await S.store.remove('events', rec.id); toast('Silindi'); } : null,
  });
  // departman notları (düz alanlardan) ve teknik ekipman onay kutuları
  const f = $('#frm'); DEPTN.forEach(([k]) => { const el = f.elements['n_' + k]; if (el) el.value = (data.deptNotes || {})[k] || ''; });
  const sec = $$('.fsec', f).find((x) => x.textContent.startsWith('Teknik ekipman'));
  if (sec) sec.insertAdjacentHTML('afterend', `<div class="fld" style="grid-column:1/-1"><div class="acts" style="gap:6px 14px">${AV.map((x) => `<label style="display:flex;gap:6px;align-items:center;font-size:13.5px"><input type="checkbox" data-av value="${esc(x)}" ${(data.av || []).includes(x) ? 'checked' : ''}> ${esc(x)}</label>`).join('')}</div></div>`);
}
A.miceNew = (el) => { if (!can.edit('opps')) return; eventForm(null, { ...(el.dataset.v ? { venueId: el.dataset.v } : {}), ...(el.dataset.d ? { date: el.dataset.d } : {}) }); };
A.miceEdit = (el) => { const e = byId('events', el.dataset.id); if (e) eventForm(e); };
// grup talebinden ya da düğünden BEO: tarih, kişi, firma ve yiyecek-içecek / salon kalemleri gelir
A.miceFrom = (el) => {
  const col = el.dataset.col, r = byId(col, el.dataset.id); if (!r) return;
  const w = col === 'weddings';
  const charges = itemsOf(col, r).filter((it) => deptOf(it) !== 'oda' && (it.name || num(it.price))).map((it) => { const l = lineCalc(it, w ? r.guests : r.pax); const q = num(it.qty) || num(w ? r.guests : r.pax) || 1; return { name: it.name, qty: q, price: Math.round((l.gross / q) * 100) / 100 }; });
  const vHotel = /elia/i.test((w ? r.venue : r.property) || '') ? 'elia' : 'ortunc';
  const v0 = venues().find((v) => v.hotel === vHotel);
  eventForm(null, {
    ref: { col, id: r.id }, title: w ? `${r.couple} · ${r.eventType || 'Düğün'}` : r.title, kind: w ? 'dugun' : ({ toplanti: 'toplanti', yemek: 'yemek', etkinlik: 'gala' })[r.kind] || 'toplanti',
    setup: w ? 'banket' : r.kind === 'toplanti' ? 'tiyatro' : 'banket', date: (w ? r.date : r.start) || today(), start: w ? '19:00' : '09:00', end: w ? '23:59' : '17:00',
    pax: w ? r.guests : r.pax, accountId: w ? '' : r.accountId || '', contact: w ? r.couple : r.contactName || '', contactPhone: r.phone || '', menu: w ? r.menu || '' : r.program || '',
    status: (w ? r.stage === 'sozlesme' : r.stage === 'kazanildi') ? 'kesin' : 'opsiyon', venueId: v0 ? v0.id : undefined, charges,
  });
};
A.miceCopy = (el) => {
  const e = byId('events', el.dataset.id); if (!e) return;
  openForm({ title: 'Etkinliği başka güne kopyala', data: { date: addDays(e.date, 1) }, fields: [{ k: 'date', label: 'Yeni tarih', type: 'date', req: true }, { k: 'title', label: 'Yeni ad', def: e.title.replace(/\b(\d+)\. gün\b/, (m, n) => `${Number(n) + 1}. gün`) }],
    saveLabel: 'Kopyala', onSave: async (v) => { const { id, beoNo, rev, revLog, createdAt, createdBy, ...rest } = e; const out = { ...rest, date: v.date, title: v.title || e.title, beoNo: nextBeo(v.date), rev: 0, revLog: [] }; const nid = await S.store.save('events', stamp(out)); toast(`${out.beoNo} oluşturuldu`); setTimeout(() => openEvent(nid), 0); } });
};
A.miceStatus = async (el) => { const e = byId('events', el.dataset.id); if (!e) return; await S.store.save('events', stamp({ ...e, status: el.dataset.s, rev: num(e.rev) + 1, revLog: [...(e.revLog || []), { at: Date.now(), by: S.user.name, n: num(e.rev) + 1, note: 'Durum: ' + EV_STATUS[el.dataset.s] }].slice(-40) })); toast('Durum: ' + EV_STATUS[el.dataset.s]); setTimeout(() => openEvent(e.id), 0); };

/* ---------- BEO görünümü (ekran ve çıktı aynı içerik) ---------- */
function beoHtml(e) {
  const v = vById(e.venueId); const cap = capOf(e); const tot = evTotal(e); const cf = conflicts(e);
  const kv = [['Tarih', `${fmtDateLong(e.date)} · ${WD[new Date(e.date + 'T12:00:00').getDay()]}`], ['Saat', `${e.start || ''} – ${e.end || ''}${e.setupAt ? ` · salon hazır ${e.setupAt}` : ''}`], ['Salon', `${v ? v.name : '—'}${v && HOTEL_L[v.hotel] ? ' · ' + HOTEL_L[v.hotel] : ''}`], ['Düzen', `${SETUPS[e.setup] || ''}${cap ? ` · kapasite ${cap}` : ''}`], ['Kişi', `${e.pax ? fmtNum(e.pax) + ' beklenen' : ''}${e.gpax ? ` · ${fmtNum(e.gpax)} garanti` : ''}${e.gDue ? ` (garanti son gün ${fmtDate(e.gDue)})` : ''}`], ['Müşteri', [e.accountName, e.contact, e.contactPhone].filter(Boolean).join(' · ')], ['Tür', EV_KIND[e.kind] || ''], ['Fatura', e.billing]].filter((x) => x[1]);
  const box = (t, body) => (body ? `<div class="beo-b"><h4>${esc(t)}</h4><div style="white-space:pre-wrap">${body}</div></div>` : '');
  return `<div class="beo">
    <div class="beo-h"><div><b style="font-size:17px">${esc(e.title)}</b><div class="sub">${esc(S.settings.hotelName || 'Ortunç Otel')} · Banquet Event Order</div></div><div style="text-align:right"><b>${esc(e.beoNo || '')}</b><div class="sub">Rev. ${num(e.rev)} · ${esc(EV_STATUS[e.status] || '')} · ${esc(fmtDate(today()))}</div></div></div>
    ${cf.length ? `<div class="beo-w">Aynı salonda çakışan etkinlik: ${esc(cf.map((x) => `${x.title} (${x.start}–${x.end})`).join(', '))}</div>` : ''}
    ${cap && pax(e) > cap ? `<div class="beo-w">Kişi sayısı (${pax(e)}) salonun ${esc(SETUPS[e.setup])} kapasitesini (${cap}) aşıyor.</div>` : ''}
    <table class="beo-t">${kv.map(([k, x]) => `<tr><th>${esc(k)}</th><td>${esc(x)}</td></tr>`).join('')}</table>
    ${(e.program || []).length ? `<h4 class="beo-s">Program</h4><table class="beo-t">${e.program.map((p) => `<tr><th style="width:70px">${esc(p.t || '')}</th><td>${esc(p.what || '')}</td><td class="sub">${esc(p.where || '')}</td></tr>`).join('')}</table>` : ''}
    <div class="beo-g">${box('Menü', esc(e.menu || ''))}${box('İçecek', esc(e.drinks || ''))}${box('Teknik', esc([(e.av || []).join(', '), e.avNote].filter(Boolean).join('\n')))}${box('Dekor / tabela', esc(e.decor || ''))}
    ${DEPTN.map(([k, l]) => box(l, esc((e.deptNotes || {})[k] || ''))).join('')}</div>
    ${(e.charges || []).length ? `<h4 class="beo-s">Ücretler (vergiler dahil)</h4><table class="beo-t"><tr><th>Kalem</th><th class="n">Miktar</th><th class="n">Birim</th><th class="n">Tutar</th></tr>${e.charges.map((c) => { const q = c.qty === '' || c.qty == null ? 1 : num(c.qty); return `<tr><td>${esc(c.name || '')}</td><td class="n">${fmtNum(q)}</td><td class="n">${money(c.price)}</td><td class="n">${money(q * num(c.price))}</td></tr>`; }).join('')}<tr><th colspan="3">Toplam</th><th class="n">${money(tot)}</th></tr></table>` : ''}
    ${e.notes ? `<h4 class="beo-s">Not</h4><div style="white-space:pre-wrap">${esc(e.notes)}</div>` : ''}
    <div class="beo-sig"><div>Müşteri onayı</div><div>Satış</div><div>Yiyecek-içecek</div></div></div>`;
}
const BEO_CSS = `.beo{font-size:12.5px}.beo .sub{color:#69768D;font-size:11px}.beo-h{display:flex;justify-content:space-between;gap:10px;border-bottom:2px solid #1F5E8C;padding-bottom:6px;margin-bottom:8px}.beo-w{background:#FBEDEA;color:#B4432E;padding:5px 8px;border-radius:5px;margin:0 0 6px}.beo-t{width:100%;border-collapse:collapse;margin:0 0 8px}.beo-t th,.beo-t td{border-bottom:1px solid #E2E7EF;padding:4px 6px;text-align:left;vertical-align:top}.beo-t th{width:110px;color:#45526A;font-weight:600}.beo-t .n{text-align:right}.beo-s{margin:10px 0 4px;font-size:13px}.beo-g{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.beo-b{border:1px solid #D7DEE8;border-radius:6px;padding:6px 8px;break-inside:avoid}.beo-b h4{margin:0 0 3px;font-size:12px;color:#1F5E8C}.beo-sig{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:28px}.beo-sig div{border-top:1px solid #45526A;padding-top:4px;font-size:11px;color:#45526A}.beo-day{break-after:page}`;
export function openEvent(id) {
  const e = byId('events', id); if (!e) return; const ed = can.edit('opps');
  $('#modal').innerHTML = `<div class="ov center"><div class="modal" style="width:min(900px,100%)"><div class="mh"><h2>${esc(e.beoNo || 'BEO')}</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb"><div class="acts" style="margin-bottom:10px;align-items:center">${ed ? `<div class="seg" role="group" aria-label="Durum">${Object.entries(EV_STATUS).map(([k, l]) => `<button class="${e.status === k ? 'on' : ''}" data-act="miceStatus" data-id="${e.id}" data-s="${k}">${l}</button>`).join('')}</div>` : `<span class="badge ${ST_B[e.status]}">${EV_STATUS[e.status]}</span>`}<span style="flex:1"></span>
      ${ed ? `<button class="btn sm" data-act="miceEdit" data-id="${e.id}">${ic('pencil')} Düzenle</button><button class="btn sm" data-act="miceCopy" data-id="${e.id}">${ic('copy')} Başka güne kopyala</button>` : ''}<button class="btn sm" data-act="micePrint" data-id="${e.id}">${ic('printer')} BEO yazdır / PDF</button><button class="btn sm" data-act="miceWa" data-id="${e.id}">${ic('wa')} WhatsApp</button>
      ${e.ref && byId(e.ref.col, e.ref.id) ? `<button class="btn sm" data-act="open" data-col="${e.ref.col}" data-id="${e.ref.id}">${ic('handshake')} Talep</button>` : ''}</div>
      <style>${BEO_CSS}</style>${beoHtml(e)}
      ${(e.revLog || []).length > 1 ? `<p class="muted" style="font-size:12px;margin-top:12px">Revizyonlar: ${(e.revLog || []).slice(-8).map((r) => `Rev. ${r.n} ${new Date(r.at).toLocaleDateString('tr-TR')} ${esc(r.by || '')}${r.note ? ' (' + esc(r.note) + ')' : ''}`).join(' · ')}</p>` : ''}</div></div></div>`;
}
A.miceOpen = (el) => openEvent(el.dataset.id);
A.micePrint = (el) => { const e = byId('events', el.dataset.id); if (e) printHtml(`${e.beoNo} ${e.title}`, beoHtml(e), BEO_CSS); };
A.miceWa = (el) => {
  const e = byId('events', el.dataset.id); if (!e) return;
  const t = [`*${e.beoNo} · ${e.title}*`, `${fmtDateLong(e.date)} ${e.start}–${e.end} · ${vName(e.venueId)} · ${SETUPS[e.setup] || ''}`, `Kişi: ${e.pax || '-'}${e.gpax ? ' (garanti ' + e.gpax + ')' : ''} · ${EV_STATUS[e.status]}`, ...(e.program || []).map((p) => `${p.t} ${p.what}${p.where ? ' · ' + p.where : ''}`), e.menu ? 'Menü: ' + e.menu : '', (e.av || []).length ? 'Teknik: ' + e.av.join(', ') : ''].filter(Boolean).join('\n');
  window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
};
// günün BEO'ları: o güne ait tüm etkinlikler, her biri ayrı sayfa
A.miceDay = () => {
  openForm({ title: 'Günün BEO\'larını yazdır', data: { date: today() }, fields: [{ k: 'date', label: 'Tarih', type: 'date', req: true }], saveLabel: 'Yazdır',
    onSave: (v) => { const l = sortBy(EVS().filter((e) => e.date === v.date && live(e)), (e) => e.setupAt || e.start || ''); if (!l.length) throw { userMsg: 'Bu tarihte etkinlik yok.' };
      const sum = `<div class="beo beo-day"><div class="beo-h"><b style="font-size:17px">${esc(fmtDateLong(v.date))} · günlük etkinlik listesi</b></div><table class="beo-t"><tr><th>Saat</th><th>Etkinlik</th><th>Salon</th><th>Düzen</th><th>Kişi</th><th>BEO</th></tr>${l.map((e) => `<tr><td>${esc(e.start)}–${esc(e.end)}</td><td>${esc(e.title)}</td><td>${esc(vName(e.venueId))}</td><td>${esc(SETUPS[e.setup] || '')}</td><td>${pax(e) || ''}</td><td>${esc(e.beoNo)} · ${esc(EV_STATUS[e.status])}</td></tr>`).join('')}</table></div>`;
      closeModal(); printHtml(`BEO ${v.date}`, sum + l.map((e) => `<div class="beo-day">${beoHtml(e)}</div>`).join(''), BEO_CSS); return false; } });
};

/* ---------- salonlar ---------- */
A.venueEdit = () => {
  if (!can.admin()) return;
  openForm({ title: 'Salonlar ve kapasiteler', wide: true, data: { list: venues().map((v) => ({ id: v.id, name: v.name, hotel: v.hotel, ...Object.fromEntries(CAP_K.map((k) => [k, (v.cap || {})[k] ?? ''])), m2: v.m2 ?? '', note: v.note || '' })) },
    intro: '<p class="muted" style="margin:0 0 8px">Her salon için oturma düzenine göre kapasite girin; BEO\'da kişi sayısı kapasiteyi aşarsa uyarı verilir. Boş bıraktığınız düzen kontrol edilmez.</p>',
    fields: [{ k: 'list', label: 'Salonlar', type: 'rows', addLabel: 'Salon ekle', heads: ['Salon adı', 'Otel', 'Tiyatro', 'Sınıf', 'U', 'Toplantı m.', 'Banket', 'Kokteyl', 'm²', 'Not'], cls: 'vrow',
      sub: [{ k: 'name', ph: 'ör. Zeytin salonu' }, { k: 'hotel', type: 'select', opts: Object.entries(HOTEL_L), req: true }, ...CAP_K.map((k) => ({ k, type: 'number', ph: '—' })), { k: 'm2', type: 'number', ph: '—' }, { k: 'note', ph: 'ör. gün ışığı alır' }] }],
    onSave: async (v) => {
      const old = venues(); const used = new Set();
      const list = v.list.map((x, i) => [x, i]).filter(([x]) => x.name).map(([x, i]) => {
        let p = old.find((o) => o.name === x.name && !used.has(o.id));
        if (!p) { const c = old[i]; if (c && !used.has(c.id) && !v.list.some((y) => y.name === c.name)) p = c; }
        const id = p ? p.id : 'v' + Date.now().toString(36) + i; used.add(id);
        return { id, name: x.name, hotel: x.hotel || 'ortunc', cap: Object.fromEntries(CAP_K.filter((k) => x[k] !== '' && x[k] != null).map((k) => [k, num(x[k])])), m2: x.m2, note: x.note };
      });
      if (!list.length) throw { userMsg: 'En az bir salon olmalı.' };
      const { id, ...rest } = S.settings; await S.store.save('settings', { ...rest, id: 'main', venues: list }); toast('Salonlar kaydedildi');
    } });
};

/* ---------- ana görünüm ---------- */
A.miceSet = (el) => { S.mice[el.dataset.f] = el.dataset.v; A._renderView(); };
A.miceWeek = (el) => { S.mice.week = el.dataset.d === '0' ? weekStart(today()) : addDays(S.mice.week, 7 * Number(el.dataset.d)); A._renderView(); };
const segM = (f, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${S.mice[f] === v ? 'on' : ''}" data-act="miceSet" data-f="${f}" data-v="${v}">${l}</button>`).join('')}</div>`;
const inHotel = (e) => S.mice.hotel === 'all' || (e.hotel || 'ortunc') === S.mice.hotel;
// BEO'su açılmamış kesin / opsiyonlu toplantı, yemek, etkinlik talepleri ve düğünler
function pending() {
  const t = today(); const has = new Set(EVS().filter((e) => e.ref).map((e) => e.ref.col + ':' + e.ref.id));
  return sortBy([...D().opps.filter((o) => o.kind !== 'grup' && ['opsiyon', 'kazanildi'].includes(o.stage) && (o.start || '') >= t && !has.has('opps:' + o.id)).map((o) => ({ col: 'opps', r: o, d: o.start, label: o.title, st: o.stage === 'kazanildi' ? 'Kesinleşti' : 'Opsiyon' })),
    ...D().weddings.filter((w) => ['opsiyon', 'sozlesme'].includes(w.stage) && (w.date || '') >= t && !has.has('weddings:' + w.id)).map((w) => ({ col: 'weddings', r: w, d: w.date, label: `${w.couple} · ${w.eventType || 'Düğün'}`, st: w.stage === 'sozlesme' ? 'Sözleşme' : 'Opsiyon' }))], (x) => x.d);
}
const evChip = (e) => { const cf = conflicts(e).length; return `<button class="ev ${e.status === 'kesin' ? '' : 'w'}" data-act="miceOpen" data-id="${e.id}" title="${esc(`${e.title} · ${e.start}–${e.end} · ${pax(e) || '?'} kişi`)}" style="${e.status === 'iptal' ? 'text-decoration:line-through;opacity:.55;' : ''}${cf ? 'outline:2px solid #B4432E;' : ''}display:block;width:100%;text-align:left;white-space:normal"><b>${esc(e.start || '')}</b> ${esc(e.title)}${pax(e) ? ` · ${pax(e)}` : ''}</button>`; };
V.mice = {
  title: () => 'Salon & banket',
  head: () => `${can.edit('opps') ? `<button class="btn pri" data-act="miceNew">${ic('plus')}<span class="hide-m"> Etkinlik (BEO)</span></button>` : ''}<button class="btn" data-act="miceDay">${ic('printer')}<span class="hide-m"> Günün BEO'ları</span></button><button class="btn" data-act="miceXls">${ic('table')}<span class="hide-m"> Excel</span></button>`,
  body: () => {
    const M = S.mice; const t = today(); const vs = venues().filter((v) => M.hotel === 'all' || v.hotel === M.hotel);
    const bar = `<div class="perfbar">${segM('hotel', [['all', 'İki otel'], ...Object.entries(HOTEL_L)])}${segM('tab', [['week', 'Haftalık salon takvimi'], ['list', 'Etkinlikler'], ['venues', 'Salonlar']])}</div>`;
    const wEnd = addDays(M.week, 6); const wk = EVS().filter((e) => inHotel(e) && e.date >= M.week && e.date <= wEnd);
    const up = EVS().filter((e) => inHotel(e) && live(e) && e.date >= t && e.date <= addDays(t, 30));
    const cfN = EVS().filter((e) => inHotel(e) && e.date >= t && conflicts(e).length).length;
    const noG = up.filter((e) => e.status === 'kesin' && !num(e.gpax) && e.date <= addDays(t, 7));
    const pend = pending();
    const kband = `<div class="kband">
      <div class="kb"><small>Bu hafta</small><b>${wk.filter(live).length}</b><em>${wk.filter((e) => e.status === 'kesin').length} kesin · ${wk.filter((e) => e.status === 'opsiyon').length} opsiyon</em></div>
      <div class="kb"><small>Önümüzdeki 30 gün</small><b>${up.length}</b><em>${fmtNum(up.reduce((s, e) => s + pax(e), 0))} kişi · ${km(up.filter((e) => e.status === 'kesin').reduce((s, e) => s + evTotal(e), 0))} kesin</em></div>
      <div class="kb ${cfN ? 'warn' : ''}"><small>Salon çakışması</small><b>${cfN}</b><em>aynı salon, aynı saat</em></div>
      <div class="kb ${noG.length ? 'warn' : ''}"><small>Garanti kişi bekleyen</small><b>${noG.length}</b><em>7 gün içindeki kesin etkinlik</em></div>
      <button class="kb ${pend.length ? 'warn' : ''}" data-act="miceSet" data-f="tab" data-v="list"><small>BEO açılmamış</small><b>${pend.length}</b><em>kesin / opsiyonlu talep ve düğün</em></button></div>`;
    let body = '';
    if (M.tab === 'week') {
      const days = Array.from({ length: 7 }, (_, i) => addDays(M.week, i));
      const wed = (d) => D().weddings.filter((w) => w.date === d && w.stage !== 'kaybedildi' && (M.hotel === 'all' || (/elia/i.test(w.venue || '') ? 'elia' : 'ortunc') === M.hotel) && !EVS().some((e) => e.ref && e.ref.col === 'weddings' && e.ref.id === w.id));
      body = `<div class="card pad"><div class="dayhead"><button class="btn sm" data-act="miceWeek" data-d="-1" aria-label="Önceki hafta">${ic('left')}</button><b>${esc(fmtDate(M.week))} – ${esc(fmtDate(wEnd))}</b><button class="btn sm" data-act="miceWeek" data-d="1" aria-label="Sonraki hafta">${ic('right')}</button><button class="btn sm" data-act="miceWeek" data-d="0">Bu hafta</button><span class="sp"></span><span class="muted" style="font-size:12.5px">Boş hücreye dokunarak o salona etkinlik açın · kırmızı çerçeve = çakışma</span></div>
        <div class="scroll-x"><table class="tb mweek"><tr><th>Salon</th>${days.map((d) => { const w = new Date(d + 'T12:00:00').getDay(); return `<th class="${d === t ? 'today' : ''}">${WD[w]} ${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)}</th>`; }).join('')}</tr>
        ${vs.map((v) => `<tr><td><b>${esc(v.name)}</b><div class="sub">${esc(HOTEL_L[v.hotel] ? HOTEL_L[v.hotel].split(' ')[0] : '')}</div></td>${days.map((d) => { const l = sortBy(EVS().filter((e) => e.venueId === v.id && e.date === d), (e) => e.start || ''); return `<td>${l.map(evChip).join('')}${can.edit('opps') ? `<button class="mcell" data-act="miceNew" data-v="${v.id}" data-d="${d}" aria-label="${esc(v.name)} ${fmtDate(d)} etkinlik ekle">+</button>` : ''}</td>`; }).join('')}</tr>`).join('')}
        ${days.some((d) => wed(d).length) ? `<tr><td><b>Düğünler</b><div class="sub">BEO açılmamış</div></td>${days.map((d) => `<td>${wed(d).map((w) => `<button class="ev w" data-act="open" data-col="weddings" data-id="${w.id}" style="display:block;width:100%;text-align:left">♥ ${esc(w.couple)}</button>`).join('')}</td>`).join('')}</tr>` : ''}
        </table></div></div>`;
    } else if (M.tab === 'list') {
      const l = sortBy(EVS().filter((e) => inHotel(e) && (M.when === 'all' || (M.when === 'past' ? e.date < t : e.date >= t))), (e) => e.date + (e.start || ''), M.when === 'past' ? -1 : 1);
      body = `${pend.length ? `<div class="card" style="margin-bottom:14px"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">BEO bekleyen talepler</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">Toplantı, yemek, etkinlik talepleri ve düğünler; BEO açınca tarih, kişi, menü ve yiyecek-içecek kalemleri kendiliğinden gelir.</p></div><div class="list">${pend.map((x) => `<div class="row"><div class="t"><b>${esc(x.label)}</b><span>${esc(fmtDate(x.d))} · ${esc(x.st)}</span></div>${can.edit('opps') ? `<button class="btn sm" data-act="miceFrom" data-col="${x.col}" data-id="${x.r.id}">${ic('plus')} BEO oluştur</button>` : ''}</div>`).join('')}</div></div>` : ''}
        <div class="perfbar">${segM('when', [['next', 'Gelecek'], ['past', 'Geçmiş'], ['all', 'Hepsi']])}</div>
        ${l.length ? `<div class="card"><div class="scroll-x"><table class="tb perf-t"><tr><th>Tarih</th><th>Etkinlik</th><th>Salon</th><th>Düzen</th><th class="n">Kişi</th><th>Durum</th><th>BEO</th><th class="n">Tutar</th></tr>${l.map((e) => { const cf = conflicts(e).length, cap = capOf(e); return `<tr style="cursor:pointer" data-act="miceOpen" data-id="${e.id}"><td style="white-space:nowrap">${esc(fmtDate(e.date))}<div class="sub">${esc(e.start || '')}–${esc(e.end || '')}</div></td><td><b>${esc(e.title)}</b><div class="sub">${esc(EV_KIND[e.kind] || '')}${e.accountName ? ' · ' + esc(e.accountName) : ''}</div></td><td>${esc(vName(e.venueId))}${cf ? '<div class="sub neg">çakışma var</div>' : ''}</td><td>${esc(SETUPS[e.setup] || '')}</td><td class="n">${pax(e) || '—'}${cap && pax(e) > cap ? `<div class="sub neg">kapasite ${cap}</div>` : ''}</td><td><span class="badge ${ST_B[e.status]}">${EV_STATUS[e.status]}</span></td><td style="white-space:nowrap">${esc(e.beoNo || '')}<div class="sub">rev. ${num(e.rev)}</div></td><td class="n">${evTotal(e) ? km(evTotal(e)) : '—'}</td></tr>`; }).join('')}</table></div></div>` : '<div class="card empty">Bu filtrede etkinlik yok.</div>'}`;
    } else {
      body = `<div class="card"><div class="pad" style="padding-bottom:4px;display:flex;align-items:center"><div style="flex:1"><h3 style="margin:0">Salonlar ve kapasiteler</h3>${S.settings.venues && S.settings.venues.length ? '' : '<p class="muted" style="margin:4px 0 0;font-size:12.5px">Şu an örnek salon adları görünüyor. Kendi salonlarınızı ve kapasitelerini girin.</p>'}</div>${can.admin() ? `<button class="btn sm pri" data-act="venueEdit">${ic('pencil')} Salonları düzenle</button>` : ''}</div>
        <div class="scroll-x"><table class="tb perf-t"><tr><th>Salon</th><th>Otel</th>${CAP_K.map((k) => `<th class="n">${esc(SETUPS[k].replace(' (yuvarlak masa)', '').replace(' (ayakta)', ''))}</th>`).join('')}<th class="n">m²</th><th class="n">30 gün etkinlik</th><th>Not</th></tr>
        ${vs.map((v) => `<tr><td><b>${esc(v.name)}</b></td><td>${esc(HOTEL_L[v.hotel] || '')}</td>${CAP_K.map((k) => `<td class="n">${(v.cap || {})[k] ? fmtNum(v.cap[k]) : '—'}</td>`).join('')}<td class="n">${v.m2 ? fmtNum(v.m2) : '—'}</td><td class="n">${up.filter((e) => e.venueId === v.id).length}</td><td class="sub">${esc(v.note || '')}</td></tr>`).join('')}</table></div></div>`;
    }
    return `<div class="perf">${bar}${kband}${body}</div>`;
  },
};
A.miceXls = () => {
  const l = sortBy(EVS().filter(inHotel), (e) => e.date + (e.start || ''));
  if (!l.length) return toast('Etkinlik yok.');
  const wb = XLSX.utils.book_new();
  const H = ['BEO', 'Rev.', 'Tarih', 'Başlangıç', 'Bitiş', 'Salon hazır', 'Etkinlik', 'Tür', 'Durum', 'Otel', 'Salon', 'Düzen', 'Beklenen kişi', 'Garanti kişi', 'Acente / firma', 'Sorumlu (müşteri)', 'Telefon', 'Teknik', 'Tutar (vergiler dahil)', 'Çakışma'];
  const ws = XLSX.utils.aoa_to_sheet([H, ...l.map((e) => [e.beoNo, num(e.rev), e.date, e.start, e.end, e.setupAt || '', e.title, EV_KIND[e.kind] || '', EV_STATUS[e.status] || '', HOTEL_L[e.hotel] || '', vName(e.venueId), SETUPS[e.setup] || '', num(e.pax) || '', num(e.gpax) || '', e.accountName || '', e.contact || '', e.contactPhone || '', (e.av || []).join(', '), evTotal(e), conflicts(e).map((x) => x.title).join(', ')])]);
  ws['!cols'] = H.map((h, i) => ({ wch: i === 6 ? 36 : 13 })); XLSX.utils.book_append_sheet(wb, ws, 'Etkinlikler');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['BEO', 'Tarih', 'Etkinlik', 'Kalem', 'Miktar', 'Birim fiyat', 'Tutar'], ...l.flatMap((e) => (e.charges || []).map((c) => { const q = c.qty === '' || c.qty == null ? 1 : num(c.qty); return [e.beoNo, e.date, e.title, c.name, q, num(c.price), q * num(c.price)]; }))]), 'Ücretler');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Salon', 'Otel', ...CAP_K.map((k) => SETUPS[k]), 'm²', 'Not'], ...venues().map((v) => [v.name, HOTEL_L[v.hotel] || '', ...CAP_K.map((k) => (v.cap || {})[k] ?? ''), v.m2 ?? '', v.note || ''])]), 'Salonlar');
  saveFile(`Salon-banket-${today()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
};

/* ---------- diğer ekranlara bağlantılar ---------- */
A._eventsCard = (col, r) => {
  const l = sortBy(EVS().filter((e) => e.ref && e.ref.col === col && e.ref.id === r.id), (e) => e.date + (e.start || ''));
  const can2 = can.edit('opps') && (col === 'weddings' || r.kind !== 'grup' || l.length);
  if (!l.length && !(can.edit('opps') && (col === 'weddings' || r.kind !== 'grup'))) return '';
  return `<div class="card"><div class="pad" style="padding-bottom:4px;display:flex;align-items:center"><h3 style="margin:0;flex:1">Etkinlikler (BEO)</h3>${can2 ? `<button class="btn sm" data-act="miceFrom" data-col="${col}" data-id="${r.id}">${ic('plus')} BEO oluştur</button>` : ''}</div>
    ${l.length ? `<div class="list">${l.map((e) => `<button class="row" data-act="miceOpen" data-id="${e.id}"><div class="t"><b>${esc(e.beoNo)} · ${esc(e.title)}</b><span>${esc(fmtDate(e.date))} ${esc(e.start || '')}–${esc(e.end || '')} · ${esc(vName(e.venueId))} · ${pax(e) || '?'} kişi</span></div><span class="badge ${ST_B[e.status]}">${EV_STATUS[e.status]}</span></button>`).join('')}</div>` : '<div class="pad muted" style="padding-top:0">Henüz BEO açılmadı; salon, saat, program ve menü BEO ile mutfağa ve servise iletilir.</div>'}</div>`;
};
A._miceCalEvents = (day) => EVS().filter((e) => e.date === day && live(e) && !e.ref).map((e) => `<button class="ev" data-act="miceOpen" data-id="${e.id}">◆ ${esc(e.start || '')} ${esc(e.title)}</button>`);
A._miceWidget = () => {
  const t = today(), t2 = addDays(t, 1); const l = sortBy(EVS().filter((e) => live(e) && (e.date === t || e.date === t2)), (e) => e.date + (e.start || ''));
  if (!EVS().length) return '';
  return `<div class="card"><div class="pad" style="padding-bottom:4px;display:flex;align-items:center"><h3 style="margin:0;flex:1">Salonlar · bugün ve yarın</h3><button class="btn sm" data-act="nav" data-v="mice">${ic('meeting')} Takvim</button></div>
    ${l.length ? `<div class="list">${l.map((e) => `<button class="row" data-act="miceOpen" data-id="${e.id}"><div class="av ${conflicts(e).length ? 'terra' : ''}">${ic('meeting')}</div><div class="t"><b>${e.date === t ? 'Bugün' : 'Yarın'} ${esc(e.start || '')} · ${esc(e.title)}</b><span>${esc(vName(e.venueId))} · ${esc(SETUPS[e.setup] || '')} · ${pax(e) || '?'} kişi${e.status !== 'kesin' ? ' · opsiyon' : ''}</span></div></button>`).join('')}</div>` : '<div class="pad muted" style="padding-top:0">Bugün ve yarın salon etkinliği yok.</div>'}</div>`;
};
A._miceWarn = () => {
  const t = today(); const out = [];
  EVS().filter((e) => live(e) && e.date >= t && e.date <= addDays(t, 7)).forEach((e) => {
    const cf = conflicts(e); if (cf.length && e.id < cf[0].id) out.push(`${fmtDate(e.date)} ${vName(e.venueId)}: "${e.title}" ile "${cf[0].title}" çakışıyor`);
    if (e.status === 'kesin' && !num(e.gpax)) out.push(`${e.beoNo} ${e.title} (${fmtDate(e.date)}): garanti kişi sayısı girilmedi`);
    if (e.status === 'opsiyon' && e.date <= addDays(t, 3)) out.push(`${e.beoNo} ${e.title} (${fmtDate(e.date)}) hâlâ opsiyonda`);
  });
  return out;
};

/* ---------- rapor oluşturucu ---------- */
DS.events = {
  label: 'Salon & banket etkinlikleri (BEO)', dates: [['date', 'Etkinlik tarihi']],
  dims: () => [['hotel', 'Otel'], ['venue', 'Salon'], ['kind', 'Etkinlik türü'], ['status', 'Durum'], ['setup', 'Oturma düzeni'], ['account', 'Acente / firma']],
  metrics: () => ({ count: ['Etkinlik sayısı', 'n'], pax: ['Kişi (garanti varsa garanti)', 'n'], rev: ['Tutar (vergiler dahil)', 'm'] }),
  rows: () => EVS().filter(live).map((e) => ({ dates: { date: e.date }, dims: { hotel: HOTEL_L[e.hotel] || '', venue: vName(e.venueId), kind: EV_KIND[e.kind] || '', status: EV_STATUS[e.status] || '', setup: SETUPS[e.setup] || '', account: e.accountName || '' }, amt: { rev: { TRY: evTotal(e) } }, n: { count: 1, pax: pax(e) }, ref: null })),
};
QUICK.push(['Salon & banket · salon bazında', { ds: 'events', dateField: 'date', period: 'thisYear', filters: [], groupBy: 'venue', groupBy2: '', metrics: ['count', 'pax', 'rev'], compare: 'none', chart: 'bar' }]);
QUICK.push(['Salon & banket · aylık', { ds: 'events', dateField: 'date', period: 'thisYear', filters: [], groupBy: 'month', groupBy2: '', metrics: ['count', 'pax', 'rev'], compare: 'prevYear', chart: 'bar' }]);
