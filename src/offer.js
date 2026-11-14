// Teklif şablonları: ana metin Ayarlar'da, {alan} etiketleri kayıttan dolar.
// Çıktılar: önizleme, yazdır/PDF, Word (.docx), düz metin (kopyala / WhatsApp / e-posta).
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from 'docx';
import {
  S, A, $, esc, ic, OPP_KINDS, today, fmtDate, fmtDateLong, money, num, fmtNum, byId, userName, wedTotal, toast, errText, stamp,
  copyText, digits, can, confirmBox, closeModal, recTitle, MONTHS, priceRows, recCalc, recTotals, moneyMap, taxNoteText,
} from './core.js';
import { saveFile, printHtml } from './print.js';

const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const dayName = (s) => (s ? DAYS[new Date(s + 'T12:00:00').getDay()] : '');
const nights = (a, b) => (a && b ? Math.max(0, Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5)) : 0);
const GAP = '……';
export const TABLE_TAG = '{fiyat_tablosu}';

/* ---------- etiketler ---------- */
const common = () => [
  ['otel', 'Otel adı', () => S.settings.hotelName],
  ['otel_telefon', 'Otel telefonu', () => S.settings.phone],
  ['otel_eposta', 'Otel e-postası', () => S.settings.email],
  ['otel_adres', 'Otel adresi', () => S.settings.address],
  ['bugün', 'Bugünün tarihi', () => fmtDateLong(today())],
];
export const TAGS = {
  weddings: [
    ['çift', 'Çiftin adı', (w) => w.couple],
    ['tarih', 'Düğün tarihi (12 Haziran 2027)', (w) => (w.date ? fmtDateLong(w.date) : '')],
    ['gün', 'Haftanın günü (Cumartesi)', (w) => dayName(w.date)],
    ['mekan', 'Mekân', (w) => w.venue],
    ['organizasyon', 'Organizasyon türü (Düğün, nişan…)', (w) => w.eventType || 'Düğün'],
    ['davetli', 'Davetli sayısı', (w) => (num(w.guests) ? fmtNum(w.guests) : '')],
    ['menü', 'Menü / paket', (w) => w.menu],
    ['kişi_başı', 'İlk kalemin birim fiyatı', (w) => { const l = recCalc('weddings', w).lines[0]; return l && l.price ? money(l.price, l.cur) : ''; }],
    ['ara_toplam', 'İlk kalemin tutarı', (w) => { const l = recCalc('weddings', w).lines[0]; return l && l.price ? money(l.qty * l.price, l.cur) : ''; }],
    ['ek_hizmetler', 'Diğer kalemlerin listesi', (w) => recCalc('weddings', w).lines.slice(1).filter((l) => l.price > 0).map((l) => `- ${l.name}: ${money(l.qty * l.price, l.cur)}`).join('\n')],
    ['indirim', 'İndirim toplamı', (w) => { const ls = recCalc('weddings', w).lines.filter((l) => l.price < 0); return ls.length ? ls.map((l) => money(-l.qty * l.price, l.cur)).join(' + ') : ''; }],
    ['toplam', 'Genel toplam (vergiler dahil)', (w) => { const t = recTotals('weddings', w); return Object.keys(t).length ? moneyMap(t) : ''; }],
    ['vergi_notu', 'Vergi notu (KDV dahil / eklenir)', (w) => taxNoteText('weddings', w)],
    ['kapora', 'İstenen kapora', (w) => (num(w.deposit) ? money(num(w.deposit), w.currency) : '')],
    ['geçerlilik', 'Teklif geçerlilik tarihi', (w) => fmtDate(w.validUntil)],
    ['telefon', 'Çiftin telefonu', (w) => w.phone],
    ['sorumlu', 'Sorumlu kişi', (w) => userName(w.ownerId) || (S.user && S.user.name)],
    ...common(),
  ],
  opps: [
    ['firma', 'Acente / firma', (o) => (byId('accounts', o.accountId) || {}).name || ''],
    ['ilgili_kişi', 'İlgili kişi', (o) => o.contactName],
    ['başlık', 'Talep başlığı', (o) => o.title],
    ['tür', 'Talep türü', (o) => OPP_KINDS[o.kind] || ''],
    ['tesis', 'Tesis', (o) => o.property],
    ['giriş', 'Başlangıç / giriş tarihi', (o) => (o.start ? fmtDateLong(o.start) : '')],
    ['çıkış', 'Bitiş / çıkış tarihi', (o) => (o.end ? fmtDateLong(o.end) : '')],
    ['gece', 'Gece sayısı', (o) => (nights(o.start, o.end) ? String(nights(o.start, o.end)) : '')],
    ['kişi', 'Kişi sayısı', (o) => (num(o.pax) ? fmtNum(o.pax) : '')],
    ['oda', 'Oda sayısı', (o) => (num(o.rooms) ? fmtNum(o.rooms) : '')],
    ['tutar', 'Genel toplam (vergiler dahil)', (o) => { const t = recTotals('opps', o); return Object.keys(t).length ? moneyMap(t) : ''; }],
    ['vergi_notu', 'Vergi notu (KDV dahil / eklenir)', (o) => taxNoteText('opps', o)],
    ['geçerlilik', 'Teklif geçerlilik tarihi', (o) => fmtDate(o.validUntil)],
    ['sorumlu', 'Sorumlu kişi', (o) => userName(o.ownerId) || (S.user && S.user.name)],
    ...common(),
  ],
};
export const DEFAULT_TPL = {
  weddings: `Sayın {çift},

En özel gününüz için bizi düşündüğünüz için teşekkür ederiz. {tarih} {gün} günü {mekan}'da gerçekleştirmeyi planladığınız {organizasyon} organizasyonunuz için hazırladığımız teklifi bilgilerinize sunarız.

Davetli sayısı: {davetli} kişi
Menü / paket: {menü}

{fiyat_tablosu}

{vergi_notu} Tarihinizin kesinleşmesi için {kapora} kapora alınmaktadır. Bu teklif {geçerlilik} tarihine kadar geçerlidir.

Her türlü sorunuz için bize ulaşabilirsiniz.

Saygılarımızla,
**{sorumlu}**
{otel} · {otel_telefon}`,
  opps: `Sayın {ilgili_kişi},

{firma} adına iletmiş olduğunuz talep için teşekkür ederiz. {giriş} – {çıkış} tarihleri arasında ({gece} gece) {kişi} kişi ve {oda} oda için {tesis} teklifimiz aşağıdadır.

{fiyat_tablosu}

{vergi_notu} Bu teklif {geçerlilik} tarihine kadar geçerlidir. Opsiyon ve ödeme koşulları için bizimle iletişime geçebilirsiniz.

Saygılarımızla,
**{sorumlu}**
{otel} · {otel_telefon}`,
};
export const TITLE = { weddings: (w) => `${w.eventType || 'Düğün'} Teklifi`, opps: () => 'Teklif' };
export const template = (col) => (S.settings.templates && S.settings.templates[col]) || DEFAULT_TPL[col];

/* ---------- doldurma ---------- */
// Şablondaki etiketleri kayıttan doldurur; {fiyat_tablosu} yerinde kalır (canlı fiyatla çizilir).
export function fill(col, rec, text = template(col)) {
  const map = Object.fromEntries(TAGS[col].map(([k, , f]) => [k, f]));
  const missing = new Set();
  const out = text.replace(/\{([^{}\n]{1,40})\}/g, (m, k) => {
    const key = k.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, '_');
    if (key === 'fiyat_tablosu') return TABLE_TAG;
    if (!map[key]) return m;
    const v = String(map[key](rec) ?? '').trim();
    if (!v) { if (['vergi_notu', 'indirim', 'ek_hizmetler'].includes(key)) return ''; missing.add(key); return GAP; }
    return v;
  });
  return { text: out, missing: Array.from(missing) };
}
// Metni bloklara böl: boş satır = yeni paragraf; tek başına {fiyat_tablosu} satırı = tablo
export function blocks(text) {
  const out = []; let cur = [];
  const flush = () => { if (cur.length) { out.push({ t: 'p', lines: cur }); cur = []; } };
  String(text).replace(/\r/g, '').split('\n').forEach((ln) => {
    if (ln.trim() === TABLE_TAG) { flush(); out.push({ t: 'table' }); return; }
    if (!ln.trim()) { flush(); return; }
    if (ln.includes(TABLE_TAG)) { const [a, b] = ln.split(TABLE_TAG); if (a.trim()) cur.push(a); flush(); out.push({ t: 'table' }); if (b.trim()) cur.push(b); return; }
    cur.push(ln);
  });
  flush();
  return out;
}
const runsHtml = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/……/g, '<span class="gap">……</span>');

/* ---------- HTML (önizleme / yazdırma) ---------- */
export const OFFER_CSS = `.offer{font-family:Georgia,"Times New Roman",serif;color:#1d2a2a;max-width:720px;margin:0 auto;padding:28px 30px;background:#fff;font-size:14.5px;line-height:1.6}
.offer .top{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;border-bottom:2px solid #1e5e5a;padding-bottom:12px;margin-bottom:22px}
.offer h1{font-size:27px;margin:0;font-weight:600}.offer .tag{font:600 10.5px/1 Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#1e5e5a;margin-top:7px}
.offer .top .ct{text-align:right;font:12px/1.5 Arial,sans-serif;color:#555}
.offer p{margin:0 0 13px}.offer .gap{background:#f8e3df;color:#b23b2b;border-radius:3px;padding:0 3px}
.offer table{width:100%;border-collapse:collapse;margin:6px 0 18px;font:13.5px/1.4 Arial,sans-serif}
.offer th{background:#e3efec;text-align:left;padding:8px 10px;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:#1e5e5a}
.offer td{padding:8px 10px;border-bottom:1px solid #e3dcd0}.offer td:last-child,.offer th:last-child{text-align:right;white-space:nowrap}
.offer tr.t td{border-top:2px solid #1d2a2a;border-bottom:0;font-weight:700;font-size:15px}.offer tr.s td{color:#555;border-bottom:0;padding-top:4px;padding-bottom:4px;font-size:13px}.offer tr.s0 td{border-top:1px solid #c9c0b0;padding-top:9px}.offer tr.t+tr.s0 td{padding-top:14px}.offer tr.a td{color:#555;border-bottom:0}
@media screen and (max-width:560px){.offer{padding:18px 16px;font-size:14px}.offer h1{font-size:21px}}
@media print{.offer .gap{background:none;color:inherit}}`;
function tableHtml(col, r) {
  const p = priceRows(col, r);
  return `<table><tr><th>Hizmet</th><th>Tutar</th></tr>${p.rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}${p.foot.map(([a, b, k]) => `<tr class="${k === 't' ? 't' : k === 's0' ? 's s0' : 's'}"><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}${p.after.map(([a, b]) => `<tr class="a"><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>`;
}
export function offerHtml(col, r, text) {
  const st = S.settings;
  return `<div class="offer"><div class="top"><div><h1>${esc(st.hotelName)}</h1><div class="tag">${esc(TITLE[col](r))}</div></div>
    <div class="ct">${[st.address, st.phone, st.email].filter(Boolean).map(esc).join('<br>')}${st.address || st.phone || st.email ? '<br>' : ''}${fmtDate(today())}</div></div>
    ${blocks(text).map((b) => (b.t === 'table' ? tableHtml(col, r) : `<p>${b.lines.map(runsHtml).join('<br>')}</p>`)).join('')}</div>`;
}

/* ---------- düz metin ---------- */
export function offerPlain(col, r, text, wa = false) {
  const p = priceRows(col, r);
  const tbl = [...p.rows.map(([a, b]) => `${a}: ${b}`), ...p.foot.map(([a, b, k]) => (k === 't' ? `${wa ? '*' : ''}${a.toLocaleUpperCase('tr-TR')}: ${b}${wa ? '*' : ''}` : `${k === 's0' ? '\n' : ''}${a}: ${b}`)), ...p.after.map(([a, b]) => `${a}: ${b}`)].join('\n');
  return blocks(text).map((b) => (b.t === 'table' ? tbl : b.lines.join('\n'))).join('\n\n').replace(/\*\*(.+?)\*\*/g, wa ? '*$1*' : '$1');
}

/* ---------- Word (.docx) ---------- */
const runs = (line, opt = {}) => line.split(/(\*\*.+?\*\*)/g).filter(Boolean).map((seg) => {
  const b = /^\*\*.+\*\*$/.test(seg);
  return new TextRun({ text: b ? seg.slice(2, -2) : seg, bold: b || opt.bold, font: 'Calibri', size: opt.size || 23, color: opt.color });
});
const noB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const line = { style: BorderStyle.SINGLE, size: 4, color: 'E3DCD0' };
function cell(text, { bold, right, fill, top, muted } = {}) {
  return new TableCell({
    children: [new Paragraph({ alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text, bold, font: 'Calibri', size: bold ? 24 : muted ? 20 : 22, color: fill ? '1E5E5A' : muted ? '666666' : undefined })] })],
    shading: fill ? { fill: 'E3EFEC' } : undefined, margins: { top: 90, bottom: 90, left: 140, right: 140 },
    borders: { top: top ? { style: BorderStyle.SINGLE, size: 12, color: '1D2A2A' } : noB, bottom: line, left: noB, right: noB },
  });
}
function docxTable(col, r) {
  const p = priceRows(col, r);
  const row = (a, b, o) => new TableRow({ children: [cell(a, o), cell(b, { ...o, right: true })] });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [7000, 2300],
    rows: [row('HİZMET', 'TUTAR', { fill: true, bold: true }), ...p.rows.map(([a, b]) => row(a, b)), ...p.foot.map(([a, b, k]) => (k === 't' ? row(a, b, { bold: true, top: true }) : row(a, b, { muted: true }))), ...p.after.map(([a, b]) => row(a, b))],
  });
}
export async function offerDocx(col, r, text) {
  const st = S.settings;
  const kids = [
    new Paragraph({ children: [new TextRun({ text: st.hotelName, font: 'Georgia', size: 44, bold: true, color: '1D2A2A' })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: TITLE[col](r).toLocaleUpperCase('tr-TR'), font: 'Calibri', size: 18, color: '1E5E5A', bold: true, characterSpacing: 40 })] }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '1E5E5A', space: 6 } }, spacing: { after: 320 },
      children: [new TextRun({ text: [st.address, st.phone, st.email, fmtDate(today())].filter(Boolean).join('  ·  '), font: 'Calibri', size: 18, color: '666666' })],
    }),
  ];
  blocks(text).forEach((b) => {
    if (b.t === 'table') { kids.push(docxTable(col, r)); kids.push(new Paragraph({ spacing: { after: 120 }, children: [] })); return; }
    const ch = [];
    b.lines.forEach((ln, i) => { if (i) ch.push(new TextRun({ break: 1 })); ch.push(...runs(ln)); });
    kids.push(new Paragraph({ spacing: { after: 200, line: 300 }, children: ch }));
  });
  const doc = new Document({
    creator: st.hotelName, title: `${TITLE[col](r)} — ${recTitle(col, r)}`,
    styles: { default: { document: { run: { font: 'Calibri', size: 23 } } } },
    sections: [{ properties: { page: { margin: { top: 1100, bottom: 1100, left: 1250, right: 1250 } } }, children: kids }],
  });
  return new Uint8Array(await (await Packer.toBlob(doc)).arrayBuffer());
}

/* ---------- teklif penceresi ---------- */
let cur = null; // { col, id, text, tab }
const fileBase = (col, r) => `Teklif-${recTitle(col, r).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}`;
const curRec = () => (cur ? byId(cur.col, cur.id) : null);
function currentText(col, r) { return r.offerText ? r.offerText : fill(col, r).text; }

export function openOffer(col, id) {
  const r = byId(col, id); if (!r) return;
  cur = { col, id, text: currentText(col, r), tab: 'view' };
  renderOffer();
}
export function renderOffer() {
  const r = curRec(); if (!r) return;
  const { col } = cur; const ed = can.edit(col);
  const miss = r.offerText ? [] : fill(col, r).missing;
  const lbl = (k) => TAGS[col].find((t) => t[0] === k)[1];
  const missing = miss.filter((k) => !k.startsWith('otel')).map(lbl), missHotel = miss.filter((k) => k.startsWith('otel')).map(lbl);
  const phone = r.phone;
  const email = col === 'weddings' ? r.email : ((byId('accounts', r.accountId) || {}).email || '');
  $('#modal').innerHTML = `<div class="ov center"><div class="modal" style="width:min(820px,100%)"><div class="mh"><h2>Teklif hazırla · ${esc(recTitle(col, r))}</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb">
      ${missing.length ? `<div class="banner" style="margin-bottom:12px">${ic('warn')}<span>Eksik bilgi: <b>${esc(missing.join(', '))}</b>. Metinde <span style="color:var(--danger)">……</span> olarak görünüyor.</span>${ed ? `<button class="btn sm" data-act="offerEditRec">Kaydı tamamla</button>` : ''}</div>` : ''}
      ${missHotel.length ? `<div class="banner" style="margin-bottom:12px">${ic('warn')}<span>Otel bilgisi eksik: <b>${esc(missHotel.join(', '))}</b>. Ayarlar › Otel bilgileri'nden bir kez girilir.</span></div>` : ''}
      ${r.offerText ? `<div class="banner" style="margin-bottom:12px;background:var(--primary-soft);border-color:#c6dcd7;color:var(--primary)"><span>Bu teklif için metin elle düzenlendi; şablondaki değişiklikler buna yansımaz. Fiyat tablosu her zaman güncel fiyatla çizilir.</span>${ed ? '<button class="btn sm" data-act="offerReset">Şablondan yeniden oluştur</button>' : ''}</div>` : ''}
      <div class="chips" style="margin-bottom:10px"><button class="chip ${cur.tab === 'view' ? 'on' : ''}" data-act="offerTab" data-v="view">Önizleme</button>${ed ? `<button class="chip ${cur.tab === 'edit' ? 'on' : ''}" data-act="offerTab" data-v="edit">Metni düzenle</button>` : ''}</div>
      ${cur.tab === 'edit' ? `<textarea id="offerTxt" class="inp" style="min-height:360px;font-family:var(--font);line-height:1.5">${esc(cur.text)}</textarea>
        <p class="muted" style="font-size:12.5px;margin:6px 0 0">Bu değişiklik yalnızca bu teklif için geçerli. <code>{fiyat_tablosu}</code> satırı fiyat tablosu olarak çizilir; <code>**kalın**</code> yazı kalın görünür.</p>`
      : `<style>${OFFER_CSS}</style><div style="border:1px solid var(--line);border-radius:10px;overflow:auto">${offerHtml(col, r, cur.text)}</div>`}
    </div>
    <div class="mf">
      ${cur.tab === 'edit' ? `<button class="btn sp" data-act="offerTab" data-v="view">Vazgeç</button><button class="btn pri" data-act="offerSaveText">Bu teklif için kaydet</button>` : `
      ${ed && !r.offerSentAt && ['talep', 'teklif'].includes(r.stage) ? '<button class="btn sp" data-act="offerSent">Gönderildi olarak işaretle</button>' : r.offerSentAt ? `<span class="badge olive sp" style="align-self:center">Gönderildi ${fmtDate(new Date(r.offerSentAt).toISOString().slice(0, 10))}</span>` : ''}
      <button class="btn" data-act="offerWord">${ic('download')} Word</button>
      <button class="btn" data-act="offerPrint">${ic('printer')} Yazdır / PDF</button>
      <button class="btn" data-act="offerCopy">${ic('copy')} Kopyala</button>
      ${email ? `<button class="btn" data-act="offerMail">${ic('mail')} E-posta</button>` : ''}
      ${phone ? `<button class="btn pri" data-act="offerWa">${ic('wa')} WhatsApp</button>` : ''}`}
    </div></div></div>`;
}
A.offer = (el) => openOffer(el.dataset.col || 'weddings', el.dataset.id);
A.offerTab = (el) => { if (cur.tab === 'edit' && el.dataset.v === 'view') { const r = curRec(); cur.text = currentText(cur.col, r); } cur.tab = el.dataset.v; renderOffer(); };
A.offerEditRec = () => { const { col, id } = cur; closeModal(); A.edit({ dataset: { col, id } }); };
A.offerSaveText = async (el) => {
  const r = curRec(); const t = $('#offerTxt').value; el.disabled = true;
  try { await S.store.save(cur.col, stamp({ ...r, offerText: t })); cur.text = t; cur.tab = 'view'; toast('Teklif metni kaydedildi'); setTimeout(renderOffer, 50); } catch (e) { toast(errText(e)); el.disabled = false; }
};
A.offerReset = () => confirmBox('Bu teklife özel düzenlemeler silinip metin şablondan yeniden oluşturulacak.', 'Yeniden oluştur', async () => {
  const r = curRec(); const { offerText, ...rest } = r; await S.store.save(cur.col, stamp({ ...rest, offerText: null }));
  cur.text = fill(cur.col, { ...rest }).text; setTimeout(renderOffer, 50);
});
A.offerCopy = () => { const r = curRec(); copyText(offerPlain(cur.col, r, cur.text)); };
A.offerWa = () => {
  const r = curRec(); let d = digits(r.phone); if (d.length === 11 && d[0] === '0') d = '9' + d; else if (d.length === 10) d = '90' + d;
  window.open(`https://wa.me/${d}?text=${encodeURIComponent(offerPlain(cur.col, r, cur.text, true))}`, '_blank', 'noopener');
};
A.offerMail = () => {
  const r = curRec(); const to = cur.col === 'weddings' ? r.email : (byId('accounts', r.accountId) || {}).email;
  const subj = `${S.settings.hotelName} — ${TITLE[cur.col](r)}`;
  const a = document.createElement('a'); a.href = `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(offerPlain(cur.col, r, cur.text))}`; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
};
A.offerPrint = () => { const r = curRec(); printHtml(fileBase(cur.col, r), offerHtml(cur.col, r, cur.text), OFFER_CSS); };
A.offerWord = async (el) => {
  const r = curRec(); el.disabled = true;
  try { saveFile(fileBase(cur.col, r) + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', await offerDocx(cur.col, r, cur.text)); }
  catch (e) { toast('Word dosyası oluşturulamadı: ' + ((e && e.message) || e)); } finally { el.disabled = false; }
};
A.offerSent = async () => {
  const r = curRec(); const { col } = cur;
  try {
    const stg = r.stage === 'talep' ? { stage: 'teklif', stageAt: Date.now() } : {};
    await S.store.save(col, stamp({ ...r, ...stg, offerSentAt: Date.now() }));
    await S.store.save('activities', stamp({ ref: { col, id: r.id }, refName: recTitle(col, r), type: 'eposta', date: today(), subject: 'Teklif gönderildi', note: '', userId: S.user.uid, userName: S.user.name }));
    toast('Teklif gönderildi olarak kaydedildi'); setTimeout(renderOffer, 50);
  } catch (e) { toast(errText(e)); }
};

/* ---------- şablon düzenleyici (Ayarlar) ---------- */
let tplCol = 'weddings';
const sampleRec = (col) => {
  const real = S.data[col].find((x) => x.stage !== 'kaybedildi');
  if (real) return real;
  const y = Number(today().slice(0, 4)) + 1;
  return col === 'weddings'
    ? { couple: 'Elif & Mert', date: `${y}-06-12`, venue: S.settings.properties[0], eventType: 'Düğün', guests: 180, perPerson: 3200, menu: 'Ege menüsü', extras: [{ name: 'Süsleme ve çiçek', amount: 85000 }], discount: 0, currency: 'TRY', deposit: 150000, validUntil: today(), ownerId: S.user.uid, phone: '' }
    : { title: 'Bayi toplantısı', contactName: 'Derya Yıldız', kind: 'toplanti', property: S.settings.properties[0], start: `${y}-03-10`, end: `${y}-03-12`, pax: 45, rooms: 24, value: 520000, currency: 'TRY', validUntil: today(), ownerId: S.user.uid };
};
export function openTemplate(col) {
  tplCol = col; const adm = can.admin();
  const t = template(col);
  $('#modal').innerHTML = `<div class="ov center"><div class="modal" style="width:min(980px,100%)"><div class="mh"><h2>${col === 'weddings' ? 'Düğün teklifi metni' : 'Grup & etkinlik teklifi metni'}</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb"><div class="grid g2" style="align-items:start">
      <div>
        <p class="muted" style="margin:0 0 8px;font-size:13.5px">Ana metni buraya yazın ya da Word'den yapıştırın. Değişen bilgilerin yerine aşağıdaki etiketlerden ekleyin; her teklifte kayıttaki bilgiyle dolar.</p>
        <textarea id="tplTxt" class="inp" style="min-height:420px;line-height:1.5" ${adm ? '' : 'readonly'}>${esc(t)}</textarea>
        ${adm ? '' : '<p class="muted" style="font-size:12.5px">Metni yalnızca yönetici değiştirebilir.</p>'}
      </div>
      <div>
        <div class="card pad" style="box-shadow:none;margin-bottom:12px"><h3>Etiketler ${adm ? '<span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">· dokununca imlecin yerine eklenir</span>' : ''}</h3>
          <div class="acts">${[...TAGS[col].map(([k, l]) => [k, l]), ['fiyat_tablosu', 'Fiyat tablosu (ayrı satırda)']].map(([k, l]) => `<button class="chip" ${adm ? `data-act="tplInsert" data-k="${k}"` : ''} title="${esc(l)}">{${k}}</button>`).join('')}</div>
          <p class="muted" style="font-size:12.5px;margin:10px 0 0"><code>**kalın**</code> yazı kalın görünür. Boş satır yeni paragraf başlatır.</p></div>
        <div class="card" style="box-shadow:none;overflow:hidden"><div class="pad" style="padding-bottom:0"><h3>Önizleme · ${esc(recTitle(col, sampleRec(col)))}</h3></div><style>${OFFER_CSS}</style><div id="tplPrev" style="max-height:420px;overflow:auto;zoom:.85"></div></div>
      </div></div></div>
    <div class="mf">${adm ? `<button class="btn sp" data-act="tplDefault">Örnek metne dön</button><button class="btn" data-act="closeModal">Vazgeç</button><button class="btn pri" data-act="tplSave">Kaydet</button>` : '<button class="btn" data-act="closeModal">Kapat</button>'}</div></div></div>`;
  const ta = $('#tplTxt');
  const prev = () => { const r = sampleRec(col); $('#tplPrev').innerHTML = offerHtml(col, r, fill(col, r, ta.value).text); };
  ta.addEventListener('input', prev); prev();
}
A.tplOpen = (el) => openTemplate(el.dataset.col);
A.tplInsert = (el) => {
  const ta = $('#tplTxt'); const tag = `{${el.dataset.k}}`; const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? s;
  const ins = el.dataset.k === 'fiyat_tablosu' ? `\n${tag}\n` : tag;
  ta.value = ta.value.slice(0, s) + ins + ta.value.slice(e); ta.focus(); ta.selectionStart = ta.selectionEnd = s + ins.length; ta.dispatchEvent(new Event('input'));
};
A.tplDefault = () => { $('#tplTxt').value = DEFAULT_TPL[tplCol]; $('#tplTxt').dispatchEvent(new Event('input')); };
A.tplSave = async (el) => {
  el.disabled = true;
  try {
    const templates = { ...(S.settings.templates || {}), [tplCol]: $('#tplTxt').value };
    const { id, ...rest } = S.settings;
    await S.store.save('settings', { ...rest, id: 'main', templates }); toast('Teklif metni kaydedildi'); closeModal();
  } catch (e) { toast(errText(e)); el.disabled = false; }
};
export { MONTHS };
