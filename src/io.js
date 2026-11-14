// Excel içe/dışa aktarma, teklif yazdırma, örnek veri
import * as XLSX from 'xlsx';
import {
  S, A, $, esc, ic, ACC_TYPES, ACC_STATUS, OPP_KINDS, OPP_STAGES, WED_STAGES, ACT_TYPES, today, addDays, fmtDate, fmtDateLong, money, num, fmtNum,
  byId, userName, stageLabel, wedTotal, recCalc, calcItems, toast, stamp, errText, infoModal, closeModal, iso, trLower, digits, can, copyText, confirmBox, recTitle,
} from './core.js';
import { newId } from './store.js';

import { saveFile } from './print.js';
const XMIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function writeBook(name, sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(([title, rows, heads]) => {
    const ws = XLSX.utils.json_to_sheet(rows, { header: heads });
    ws['!cols'] = heads.map((h) => ({ wch: Math.min(40, Math.max(h.length + 2, ...rows.slice(0, 200).map((r) => String(r[h] ?? '').length + 2))) }));
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
  });
  saveFile(name, XMIME, new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
}

/* ---------- sütun tanımları ---------- */
const rev = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [trLower(v), k]));
const C = {
  accounts: [['name', 'Firma / Acente'], ['type', 'Tür'], ['status', 'Durum'], ['city', 'Şehir'], ['country', 'Ülke'], ['market', 'Pazar'], ['phone', 'Telefon'], ['email', 'E-posta'], ['web', 'Web'],
    ['c1name', 'Yetkili'], ['c1title', 'Yetkili Görevi'], ['c1phone', 'Yetkili Telefon'], ['c1email', 'Yetkili E-posta'], ['commission', 'Komisyon %'], ['contractStart', 'Kontrat Başlangıç'], ['contractEnd', 'Kontrat Bitiş'], ['contractNote', 'Kontrat Notu'],
    ['invTitle', 'Ticari Ünvan'], ['taxOffice', 'Vergi Dairesi'], ['taxNo', 'Vergi No'], ['invAddress', 'Fatura Adresi'], ['invEmail', 'Fatura E-postası'], ['paymentTerms', 'Ödeme Koşulu'], ['mersis', 'MERSİS No'], ['iban', 'IBAN'], ['notes', 'Notlar']],
  guests: [['name', 'Ad Soyad'], ['phone', 'Telefon'], ['email', 'E-posta'], ['city', 'Şehir'], ['country', 'Ülke'], ['birthday', 'Doğum Günü'], ['anniversary', 'Yıl Dönümü'], ['tags', 'Etiketler'], ['prefs', 'Tercihler'], ['notes', 'Notlar'],
    ['checkIn', 'Giriş'], ['checkOut', 'Çıkış'], ['property', 'Tesis'], ['room', 'Oda'], ['amount', 'Tutar']],
};
const accRow = (a) => { const c = (a.contacts || [])[0] || {}; return { ...a, type: ACC_TYPES[a.type] || a.type, status: ACC_STATUS[a.status] || a.status, c1name: c.name, c1title: c.title, c1phone: c.phone, c1email: c.email, contractStart: fmtDate(a.contractStart), contractEnd: fmtDate(a.contractEnd) }; };
const toRows = (defs, list) => list.map((r) => Object.fromEntries(defs.map(([k, h]) => [h, r[k] ?? ''])));
const heads = (defs) => defs.map((d) => d[1]);

function sheetsFor(col) {
  const D = S.data;
  if (col === 'accounts') {
    const kd = [['acc', 'Firma / Acente'], ['name', 'Yetkili'], ['title', 'Görevi'], ['phone', 'Telefon'], ['email', 'E-posta']];
    return [['Acenteler', toRows(C.accounts, D.accounts.map(accRow)), heads(C.accounts)],
      ['Yetkililer', toRows(kd, D.accounts.flatMap((a) => (a.contacts || []).map((c) => ({ ...c, acc: a.name })))), heads(kd)]];
  }
  if (col === 'guests') {
    const gd = C.guests.slice(0, 7).concat([['sp', 'Diğer Özel Günler']], C.guests.slice(7, 10), [['n', 'Konaklama Sayısı']]);
    const sd = [['g', 'Misafir'], ['checkIn', 'Giriş'], ['checkOut', 'Çıkış'], ['property', 'Tesis'], ['room', 'Oda'], ['amount', 'Tutar'], ['note', 'Not']];
    return [['Misafirler', toRows(gd, D.guests.map((g) => ({ ...g, tags: (g.tags || []).join(', '), birthday: fmtDate(g.birthday), anniversary: fmtDate(g.anniversary), sp: (g.specials || []).filter((x) => x.date).map((x) => `${x.label}: ${fmtDate(x.date)}`).join('; '), n: (g.stays || []).length }))), heads(gd)],
      ['Konaklamalar', toRows(sd, D.guests.flatMap((g) => (g.stays || []).map((s) => ({ ...s, g: g.name, checkIn: fmtDate(s.checkIn), checkOut: fmtDate(s.checkOut) })))), heads(sd)]];
  }
  if (col === 'opps') {
    const d = [['title', 'Başlık'], ['kind', 'Tür'], ['stage', 'Aşama'], ['acc', 'Acente / Firma'], ['contactName', 'İlgili Kişi'], ['phone', 'Telefon'], ['property', 'Tesis'], ['start', 'Başlangıç'], ['end', 'Bitiş'], ['pax', 'Kişi'], ['rooms', 'Oda'], ['value', 'Tutar'], ['currency', 'Para Birimi'], ['source', 'Kaynak'], ['owner', 'Sorumlu'], ['lossReason', 'Kayıp Nedeni'], ['notes', 'Notlar']];
    return [['Grup ve Etkinlik', toRows(d, D.opps.map((o) => ({ ...o, kind: OPP_KINDS[o.kind], stage: stageLabel(OPP_STAGES, o.stage), acc: (byId('accounts', o.accountId) || {}).name, start: fmtDate(o.start), end: fmtDate(o.end), owner: userName(o.ownerId) }))), heads(d)]];
  }
  if (col === 'weddings') {
    const d = [['couple', 'Çift'], ['date', 'Tarih'], ['venue', 'Mekân'], ['eventType', 'Organizasyon'], ['stage', 'Aşama'], ['guests', 'Davetli'], ['menu', 'Menü'], ['lines', 'Kalemler'], ['net', 'Vergiler Hariç'], ['tax', 'Vergiler'], ['total', 'Genel Toplam'], ['currency', 'Para Birimi'], ['deposit', 'İstenen Kapora'], ['depositPaid', 'Alınan Kapora'], ['phone', 'Telefon'], ['email', 'E-posta'], ['source', 'Kaynak'], ['owner', 'Sorumlu'], ['lossReason', 'Kayıp Nedeni'], ['notes', 'Notlar']];
    const il = [['w', 'Düğün'], ['name', 'Kalem'], ['qty', 'Miktar'], ['price', 'Birim Fiyat'], ['cur', 'Para Birimi'], ['kdvR', 'KDV %'], ['kvR', 'Konaklama V. %'], ['mode', 'Vergiler'], ['net', 'Vergiler Hariç'], ['kvA', 'Konaklama Vergisi'], ['kdvA', 'KDV'], ['gross', 'Toplam']];
    const r2 = (n) => Math.round(n * 100) / 100;
    return [['Düğün Teklifleri', toRows(d, D.weddings.map((w) => { const c = recCalc('weddings', w); const m = c.by[c.main] || { net: 0, gross: 0 }; return { ...w, date: fmtDate(w.date), stage: stageLabel(WED_STAGES, w.stage), lines: c.lines.map((l) => l.name).join(', '), net: r2(m.net), tax: r2(m.gross - m.net), total: r2(m.gross), currency: c.main, owner: userName(w.ownerId) }; })), heads(d)],
      ['Düğün Kalemleri', toRows(il, D.weddings.flatMap((w) => recCalc('weddings', w).lines.map((l) => ({ ...l, w: w.couple, mode: l.mode === 'ekle' ? 'Eklenecek' : 'Dahil', net: r2(l.net), kvA: r2(l.kvA), kdvA: r2(l.kdvA), gross: r2(l.gross) })))), heads(il)]];
  }
  if (col === 'activities') {
    const d = [['date', 'Tarih'], ['type', 'Tür'], ['ref', 'İlgili Kayıt'], ['subject', 'Konu'], ['note', 'Not'], ['userName', 'Giren']];
    return [['Aktiviteler', toRows(d, S.data.activities.map((a) => ({ ...a, date: fmtDate(a.date), type: ACT_TYPES[a.type], ref: a.ref ? (recTitle(a.ref.col, byId(a.ref.col, a.ref.id)) || a.refName) : '' }))), heads(d)]];
  }
  if (col === 'blacklist') {
    const d = [['name', 'Ad Soyad'], ['phone', 'Telefon'], ['email', 'E-posta'], ['reason', 'Sebep'], ['detail', 'Ne Oldu'], ['date', 'Olay Tarihi'], ['room', 'Oda / Rez. No'], ['amount', 'Alacak'], ['addedByName', 'Ekleyen']];
    return [['Kara Liste', toRows(d, S.data.blacklist.map((b) => ({ ...b, reason: (A._BL || {})[b.reason] || '', date: fmtDate(b.date) }))), heads(d)]];
  }
  const d = [['title', 'Görev'], ['due', 'Tarih'], ['done', 'Durum'], ['who', 'Atanan'], ['ref', 'İlgili Kayıt'], ['note', 'Not']];
  return [['Görevler', toRows(d, S.data.tasks.map((t) => ({ ...t, due: fmtDate(t.due), done: t.done ? 'Tamamlandı' : 'Açık', who: userName(t.assigneeId), ref: t.ref ? (recTitle(t.ref.col, byId(t.ref.col, t.ref.id)) || t.refName) : '' }))), heads(d)]];
}
A.exportCol = (el) => { const col = el.dataset.col; writeBook(`Ortunc-CRM-${{ accounts: 'Acenteler', guests: 'Misafirler', opps: 'Grup-Etkinlik', weddings: 'Dugun-Teklifleri', blacklist: 'Kara-Liste' }[col]}-${today()}.xlsx`, sheetsFor(col)); };
A.exportAll = () => writeBook(`Ortunc-CRM-Tum-Veriler-${today()}.xlsx`, ['accounts', 'guests', 'opps', 'weddings', 'activities', 'tasks', 'blacklist'].flatMap(sheetsFor));
A.template = (el) => { const col = el.dataset.col; writeBook(col === 'accounts' ? 'Acente-Aktarim-Sablonu.xlsx' : 'Misafir-Aktarim-Sablonu.xlsx', [[col === 'accounts' ? 'Acenteler' : 'Misafirler', [], heads(C[col])]]); };

/* ---------- içe aktarma ---------- */
function toIso(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v)) return iso(new Date(v.getTime() + 12 * 3600e3)); // gün kaymasına karşı öğlene çek
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}
const str = (v) => (v == null ? '' : String(v).trim());
let pending = null;
A.importPick = (el) => { const i = $('#importFile'); i.dataset.col = el.dataset.col; i.value = ''; i.click(); };
export async function handleImportFile(input) {
  const col = input.dataset.col; const file = input.files && input.files[0]; if (!file) return;
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const hmap = Object.fromEntries(C[col].map(([k, h]) => [trLower(h), k]));
    const alias = { 'firma': 'name', 'acente': 'name', 'acente adı': 'name', 'firma adı': 'name', 'ad': 'name', 'isim': 'name', 'misafir': 'name', 'adı soyadı': 'name', 'mail': 'email', 'e-mail': 'email', 'eposta': 'email', 'tel': 'phone', 'gsm': 'phone', 'cep': 'phone', 'il': 'city', 'kontak': 'c1name', 'ilgili kişi': 'c1name', 'not': 'notes', 'ünvan': 'invTitle', 'unvan': 'invTitle', 'vergi dairesi': 'taxOffice', 'vd': 'taxOffice', 'vergi no': 'taxNo', 'vkn': 'taxNo', 'vergi numarası': 'taxNo', 'adres': 'invAddress', 'giriş tarihi': 'checkIn', 'çıkış tarihi': 'checkOut', 'oda no': 'room', 'doğum tarihi': 'birthday' };
    const rows = raw.map((r) => { const o = {}; Object.entries(r).forEach(([h, v]) => { const k = hmap[trLower(h).trim()] || alias[trLower(h).trim()]; if (k) o[k] = v; }); return o; }).filter((o) => str(o.name));
    if (!rows.length) { infoModal('Aktarılacak kayıt bulunamadı', `<p>Dosyanın ilk sayfasında "<b>${esc(C[col][0][1])}</b>" başlıklı bir sütun olmalı. Şablonu indirip aynı başlıkları kullanabilirsiniz.</p>`, `<button class="btn" data-act="template" data-col="${col}">${ic('download')} Şablonu indir</button><button class="btn pri" data-act="closeModal">Tamam</button>`); return; }
    let add = [], upd = [], skip = 0;
    if (col === 'accounts') {
      const tRev = rev(ACC_TYPES), sRev = rev(ACC_STATUS);
      const have = new Set(S.data.accounts.map((a) => trLower(a.name).trim())); const seen = new Set();
      rows.forEach((r) => {
        const key = trLower(str(r.name)); if (have.has(key) || seen.has(key)) { skip++; return; } seen.add(key);
        const c = { name: str(r.c1name), title: str(r.c1title), phone: str(r.c1phone), email: str(r.c1email) };
        add.push(stamp({ id: newId(), name: str(r.name), type: tRev[trLower(str(r.type))] || 'acente', status: sRev[trLower(str(r.status))] || 'aktif', city: str(r.city), country: str(r.country), market: str(r.market), phone: str(r.phone), email: str(r.email), web: str(r.web),
          contacts: c.name || c.phone || c.email ? [c] : [], commission: r.commission === '' || r.commission == null ? '' : num(r.commission), contractStart: toIso(r.contractStart), contractEnd: toIso(r.contractEnd), contractNote: str(r.contractNote), invTitle: str(r.invTitle), taxOffice: str(r.taxOffice), taxNo: str(r.taxNo).replace(/\s/g, ''), invAddress: str(r.invAddress), invEmail: str(r.invEmail), paymentTerms: str(r.paymentTerms), mersis: str(r.mersis), iban: str(r.iban).replace(/\s/g, '').toUpperCase(), notes: str(r.notes) }));
      });
    } else {
      const keyOf = (n, p) => trLower(str(n)) + '|' + digits(p).slice(-10);
      const map = new Map(S.data.guests.map((g) => [keyOf(g.name, g.phone), { g: { ...g, stays: (g.stays || []).slice() }, isNew: false, touched: false }]));
      rows.forEach((r) => {
        const k = keyOf(r.name, r.phone); let e = map.get(k);
        if (!e) { e = { isNew: true, touched: true, g: stamp({ id: newId(), name: str(r.name), phone: str(r.phone), email: str(r.email), city: str(r.city), country: str(r.country), birthday: toIso(r.birthday), anniversary: toIso(r.anniversary), tags: str(r.tags).split(',').map((t) => t.trim()).filter(Boolean), prefs: str(r.prefs), notes: str(r.notes), stays: [] }) }; map.set(k, e); }
        const ci = toIso(r.checkIn);
        if (ci && !e.g.stays.some((s) => s.checkIn === ci)) { e.g.stays.push({ checkIn: ci, checkOut: toIso(r.checkOut), property: str(r.property), room: str(r.room), amount: num(r.amount), note: '' }); e.touched = true; } else if (!e.isNew) skip++;
      });
      map.forEach((e) => { if (e.isNew) add.push(e.g); else if (e.touched) upd.push(stamp(e.g)); });
    }
    pending = { col, list: add.concat(upd) };
    infoModal('İçe aktarma özeti', `<p><b>${esc(file.name)}</b></p><dl class="dl"><dt>Yeni kayıt</dt><dd>${add.length}</dd>${col === 'guests' ? `<dt>Güncellenecek</dt><dd>${upd.length} (yeni konaklama eklenecek)</dd>` : ''}<dt>Atlanan</dt><dd>${skip} (zaten kayıtlı)</dd></dl>`,
      `<button class="btn" data-act="closeModal">Vazgeç</button><button class="btn pri" data-act="importGo" ${pending.list.length ? '' : 'disabled'}>Aktar</button>`);
  } catch (e) { toast('Dosya okunamadı: ' + ((e && e.message) || e)); }
}
A.importGo = async (el) => {
  if (!pending) return; el.disabled = true;
  try { await S.store.saveMany(pending.col, pending.list); toast(pending.list.length + ' kayıt aktarıldı'); pending = null; closeModal(); } catch (e) { toast(errText(e)); el.disabled = false; }
};

/* ---------- örnek veri (demo) ---------- */
A.loadSample = async () => {
  const t = today(), y = Number(t.slice(0, 4)), u = S.user;
  const mk = (o) => stamp({ id: newId(), sample: true, ...o });
  const acc = [
    mk({ name: 'Mavi Yelken Turizm', type: 'acente', status: 'aktif', city: 'İzmir', country: 'Türkiye', market: 'Yurt içi', phone: '0232 555 01 10', email: 'rezervasyon@maviyelken.example', commission: 12, contractStart: `${y}-01-01`, contractEnd: addDays(t, 40), ownerId: u.uid, contacts: [{ name: 'Selin Aksoy', title: 'Operasyon Müdürü', phone: '0532 555 01 11', email: 'selin@maviyelken.example' }, { name: 'Kaan Demir', title: 'Rezervasyon', phone: '0533 555 01 12', email: '' }] }),
    mk({ name: 'Ege Rota Seyahat', type: 'operator', status: 'aktif', city: 'İstanbul', country: 'Türkiye', market: 'Kültür turları', phone: '0212 555 02 20', email: 'info@egerota.example', commission: 15, ownerId: u.uid, contacts: [{ name: 'Burak Şahin', title: 'Satın Alma', phone: '0535 555 02 21', email: 'burak@egerota.example' }] }),
    mk({ name: 'Zeytin Dalı Bilişim A.Ş.', type: 'kurumsal', status: 'potansiyel', city: 'Bursa', country: 'Türkiye', market: 'MICE', email: 'ik@zeytindali.example', ownerId: u.uid, contacts: [{ name: 'Derya Yıldız', title: 'İK Müdürü', phone: '0541 555 03 31', email: 'derya@zeytindali.example' }] }),
    mk({ name: 'Balkan Holidays Sofia', type: 'operator', status: 'aktif', city: 'Sofya', country: 'Bulgaristan', market: 'Balkanlar', email: 'contracts@balkanholidays.example', commission: 18, ownerId: u.uid, contacts: [{ name: 'Ivana Petrova', title: 'Contracting', phone: '+359 88 555 0441', email: 'ivana@balkanholidays.example' }] }),
  ];
  const guests = [
    mk({ name: 'Ayşe Karaca', phone: '0532 555 10 01', email: 'ayse@example.com', city: 'Ankara', country: 'Türkiye', birthday: `1984-${addDays(t, 6).slice(5)}`, tags: ['VIP'], prefs: 'Deniz manzaralı oda, geç kahvaltı.', stays: [{ checkIn: `${y - 1}-07-10`, checkOut: `${y - 1}-07-15`, property: 'Ortunç Otel', room: '204', amount: 42000, note: 'Web sitesi' }, { checkIn: `${y}-06-20`, checkOut: `${y}-06-24`, property: 'Ortunç Otel', room: '204', amount: 46000, note: 'Telefon' }] }),
    mk({ name: 'Thomas Becker', phone: '+49 151 555 2002', email: 'thomas@example.com', city: 'Münih', country: 'Almanya', anniversary: `2015-${addDays(t, 15).slice(5)}`, tags: ['Balayı'], prefs: 'Sessiz oda.', stays: [{ checkIn: `${y}-09-02`, checkOut: `${y}-09-09`, property: 'Elia Otel', room: '12', amount: 1450, note: 'OTA' }] }),
    mk({ name: 'Mehmet Öztürk', phone: '0544 555 30 03', city: 'İstanbul', country: 'Türkiye', tags: [], stays: [] }),
  ];
  const opps = [
    mk({ title: 'Zeytin Dalı bayi toplantısı', kind: 'toplanti', stage: 'teklif', accountId: acc[2].id, contactName: 'Derya Yıldız', phone: '0541 555 03 31', property: 'Ortunç Otel', start: addDays(t, 30), end: addDays(t, 32), pax: 45, rooms: 24, items: [{ name: 'Konaklama (24 oda × 2 gece)', qty: 48, price: 6500, cur: 'TRY', kdv: 10, kv: 2, mode: 'ekle' }, { name: 'Toplantı salonu (2 gün)', qty: 2, price: 25000, cur: 'TRY', kdv: 20, kv: 0, mode: 'ekle' }, { name: 'Yemekler (kişi başı)', qty: 45, price: 2600, cur: 'TRY', kdv: 10, kv: 0, mode: 'ekle' }], value: 520000, currency: 'TRY', source: 'E-posta', ownerId: u.uid }),
    mk({ title: 'Balkan kültür turu grubu', kind: 'grup', stage: 'opsiyon', accountId: acc[3].id, contactName: 'Ivana Petrova', property: 'Elia Otel', start: addDays(t, 55), end: addDays(t, 58), pax: 32, rooms: 16, value: 6800, currency: 'EUR', source: 'Fuar', ownerId: u.uid }),
    mk({ title: 'Mavi Yelken hafta sonu grubu', kind: 'grup', stage: 'kazanildi', accountId: acc[0].id, contactName: 'Selin Aksoy', property: 'Ortunç Otel', start: addDays(t, 12), end: addDays(t, 14), pax: 28, rooms: 14, value: 310000, currency: 'TRY', source: 'Acente', ownerId: u.uid }),
    mk({ title: 'Emeklilik yemeği (40 kişi)', kind: 'yemek', stage: 'talep', contactName: 'Hakan Bey', phone: '0530 555 40 04', property: 'Ortunç Restoran', start: addDays(t, 20), end: addDays(t, 20), pax: 40, value: 96000, currency: 'TRY', source: 'Telefon', ownerId: u.uid }),
    mk({ title: 'Yoga inziva haftası', kind: 'etkinlik', stage: 'kaybedildi', property: 'Elia Antique', start: addDays(t, -20), end: addDays(t, -14), pax: 18, value: 240000, currency: 'TRY', source: 'Instagram', lossReason: 'Tarih dolu', ownerId: u.uid }),
  ];
  opps.forEach((o) => { if (o.items) { const c = calcItems(o.items, 1); o.value = Math.round(c.by[c.main].gross); o.currency = c.main; } });
  const weds = [
    mk({ couple: 'Elif & Mert', phone: '0532 555 50 05', date: `${y + 1}-06-12`, venue: 'Ortunç Otel', eventType: 'Düğün', stage: 'opsiyon', guests: 180, menu: 'Ege menüsü, yerli içecek', items: [{ name: 'Ege menüsü (kişi başı)', qty: '', price: 3200, cur: 'TRY', kdv: 10, kv: 0, mode: 'dahil' }, { name: 'Süsleme ve çiçek', qty: 1, price: 85000, cur: 'TRY', kdv: 20, kv: 0, mode: 'dahil' }, { name: 'DJ ve ses sistemi', qty: 1, price: 45000, cur: 'TRY', kdv: 20, kv: 0, mode: 'dahil' }, { name: 'İndirim', qty: 1, price: -20000, cur: 'TRY', kdv: 10, kv: 0, mode: 'dahil' }], currency: 'TRY', deposit: 150000, depositPaid: 0, validUntil: addDays(t, 10), source: 'Instagram', ownerId: u.uid }),
    mk({ couple: 'Zeynep & Can', phone: '0533 555 60 06', date: `${y + 1}-09-05`, venue: 'Ortunç Otel', eventType: 'Düğün', stage: 'sozlesme', guests: 120, menu: 'Deniz ürünleri menüsü', items: [{ name: 'Deniz ürünleri menüsü (kişi başı)', qty: '', price: 3500, cur: 'TRY', kdv: 10, kv: 0, mode: 'dahil' }, { name: 'Konaklama (10 oda × 2 gece)', qty: 20, price: 160, cur: 'EUR', kdv: 10, kv: 2, mode: 'ekle' }], currency: 'TRY', deposit: 200000, depositPaid: 200000, source: 'Tavsiye', ownerId: u.uid }),
    mk({ couple: 'Deniz & Arda', phone: '0535 555 70 07', date: `${y + 1}-06-12`, venue: 'Ortunç Otel', eventType: 'Düğün', stage: 'teklif', guests: 150, items: [{ name: 'Menü (kişi başı)', qty: '', price: 3200, cur: 'TRY', kdv: 10, kv: 0, mode: 'dahil' }], currency: 'TRY', validUntil: addDays(t, 7), source: 'Web sitesi', ownerId: u.uid }),
  ];
  const act = (col, r, o) => mk({ ref: { col, id: r.id }, refName: recTitle(col, r), userId: u.uid, userName: u.name, ...o });
  const acts = [
    act('accounts', acc[0], { type: 'ziyaret', date: addDays(t, -5), subject: 'Sezon değerlendirme ziyareti', note: 'Gelecek yıl kontenjan artışı istiyorlar. Erken rezervasyon indirimi soruldu.' }),
    act('accounts', acc[3], { type: 'fuar', date: addDays(t, -25), subject: 'Fuar görüşmesi', note: 'Mayıs–Ekim arası seri grup planlıyorlar.' }),
    act('weddings', weds[0], { type: 'telefon', date: addDays(t, -2), subject: 'Mekân gezisi için arandı', note: 'Cumartesi 14:00 uygun.' }),
    act('opps', opps[0], { type: 'eposta', date: addDays(t, -1), subject: 'Teklif gönderildi', note: '' }),
  ];
  const task = (col, r, o) => mk({ ref: { col, id: r.id }, refName: recTitle(col, r), assigneeId: u.uid, done: false, priority: 'normal', ...o });
  const tasks = [
    task('weddings', weds[0], { title: 'Elif & Mert: mekân gezisi', due: addDays(t, 2), priority: 'yuksek' }),
    task('opps', opps[0], { title: 'Teklif dönüşü için ara', due: addDays(t, -1) }),
    task('accounts', acc[0], { title: 'Yeni yıl kontratını gönder', due: addDays(t, 5) }),
  ];
  try {
    await S.store.saveMany('accounts', acc); await S.store.saveMany('guests', guests); await S.store.saveMany('opps', opps);
    await S.store.saveMany('weddings', weds); await S.store.saveMany('activities', acts); await S.store.saveMany('tasks', tasks);
    toast('Örnek veriler yüklendi');
  } catch (e) { toast(errText(e)); }
};
A.wipeSample = () => confirmBox('Örnek olarak yüklenen kayıtlar silinecek. Kendi girdiğiniz kayıtlara dokunulmaz.', 'Örnekleri sil', async () => {
  for (const col of ['accounts', 'guests', 'opps', 'weddings', 'activities', 'tasks']) for (const r of S.data[col].filter((x) => x.sample)) await S.store.remove(col, r.id);
  toast('Örnek veriler silindi');
});
export { can };
