// Kutlamalar: günün doğum günleri / özel günleri ve misafire özel kutlama kartları
import {
  S, A, V, $, esc, ic, OCC, today, addDays, iso, fmtDate, fmtDateLong, MONTHS, byId, sortBy, toast, errText, stamp, can, copyText, digits,
  openForm, closeModal, confirmBox, occasionsOn, guestOccasions, nextOccurrence, stayOn, yearsSince, initials, waNum,
} from './core.js';
import { printHtml } from './print.js';

const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const GAP = '……';
export const THEMES = { zarif: 'Zarif (yeşil–altın)', sicak: 'Sıcak (kiremit)', pastel: 'Pastel (pembe)', sade: 'Sade (siyah–beyaz)' };

/* ---------- şablonlar ---------- */
export const DEFAULT_CARDS = [
  { id: 'tr-dogum', name: 'Doğum günü (Türkçe)', occ: 'dogum', theme: 'zarif', subject: 'İyi ki doğdunuz {ad}!', text: `# İyi ki doğdunuz!

Sevgili {ad},

Yeni yaşınızı {otel}'de sizinle birlikte kutlamaktan büyük mutluluk duyuyoruz. Yeni yaşınızın size sağlık, huzur ve güzel sürprizlerle dolu günler getirmesini dileriz.

Sevgilerimizle,
**{otel} Ailesi**` },
  { id: 'en-dogum', name: 'Birthday (English)', occ: 'dogum', theme: 'zarif', subject: 'Happy Birthday, {ad}!', text: `# Happy Birthday!

Dear {ad},

We are delighted to celebrate your special day with you at {otel}. Wishing you a wonderful year filled with joy, health and beautiful surprises.

Warmest wishes,
**The {otel} Family**` },
  { id: 'tr-yildonumu', name: 'Evlilik yıl dönümü (Türkçe)', occ: 'yildonumu', theme: 'sicak', subject: 'Mutlu yıllar {ad_soyad}!', text: `# Mutlu yıllar!

Sevgili {ad_soyad},

Evlilik yıl dönümünüzü bizimle geçirmeyi seçtiğiniz için teşekkür ederiz. Nice mutlu, sağlıklı ve sevgi dolu yıllar dileriz.

Sevgilerimizle,
**{otel} Ailesi**` },
  { id: 'tr-ozel', name: 'Özel gün (Türkçe)', occ: 'ozel', theme: 'pastel', subject: '{özel_gün} için en iyi dileklerimizle', text: `# Nice güzel günlere!

Sevgili {ad},

{özel_gün} için en içten dileklerimizi sunarız. Bu özel günü sizinle paylaşmaktan mutluluk duyuyoruz.

Sevgilerimizle,
**{otel} Ailesi**` },
];
export const cardTemplates = () => (S.settings.cards && S.settings.cards.length ? S.settings.cards : DEFAULT_CARDS);
export const defaultFor = (occ) => {
  const list = cardTemplates(); const id = (S.settings.cardDefaults || {})[occ];
  return list.find((t) => t.id === id) || list.find((t) => t.occ === occ) || list[0];
};
export const TAGS = [
  ['ad', 'Misafirin adı'], ['soyad', 'Soyadı'], ['ad_soyad', 'Adı soyadı'], ['oda', 'Oda numarası'], ['özel_gün', 'Özel günün adı'],
  ['tarih', 'Günün tarihi'], ['gün', 'Haftanın günü'], ['yaş', 'Yeni yaşı (doğum yılı biliniyorsa)'], ['yıl', 'Kaçıncı yıl (yıl dönümü)'],
  ['otel', 'Otel adı'], ['gönderen', 'Kartı hazırlayan'],
];

/* ---------- doldurma ---------- */
export function fillCard(text, ev) {
  const g = ev.g; const parts = String(g.name || '').trim().split(/\s+/);
  const st = stayOn(g, ev.day); const n = yearsSince(ev.date, ev.day);
  const map = {
    ad: parts[0] || '', soyad: parts.length > 1 ? parts.slice(1).join(' ') : '', ad_soyad: g.name, oda: st ? st.room : '',
    özel_gün: ev.label, tarih: fmtDateLong(ev.day), gün: DAYS[new Date(ev.day + 'T12:00:00').getDay()], yaş: ev.type === 'dogum' && n ? String(n) : '',
    yıl: n ? String(n) : '', otel: S.settings.hotelName, gönderen: S.user ? S.user.name : '',
  };
  const missing = new Set();
  const out = String(text).replace(/\{([^{}\n]{1,30})\}/g, (m, k) => {
    const key = k.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, '_');
    if (!(key in map)) return m;
    const v = String(map[key] ?? '').trim(); if (!v) { missing.add(key); return GAP; } return v;
  });
  return { text: out, missing: Array.from(missing) };
}
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/……/g, '<span class="gap">……</span>');

/* ---------- kart tasarımı ---------- */
export const CARD_CSS = `.gcard{position:relative;width:210mm;height:148mm;box-sizing:border-box;overflow:hidden;background:var(--cb);color:var(--ci);font-family:Georgia,"Times New Roman",serif;break-after:page;page-break-after:always;margin:0 auto}
.gcard:last-child{break-after:auto;page-break-after:auto}
.gcard .fr{position:absolute;inset:7mm;border:1.4pt solid var(--ca)}.gcard .fr:after{content:"";position:absolute;inset:2.2mm;border:.6pt solid var(--ca);opacity:.6}
.gcard .orn{position:absolute;left:0;right:0;top:0;height:100%;pointer-events:none}
.gcard .in{position:absolute;inset:16mm 22mm 13mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.gcard h1{font-size:31pt;font-weight:400;font-style:italic;margin:0 0 5mm;color:var(--ch);line-height:1.1}
.gcard .msg{font-size:12.5pt;line-height:1.55;max-width:150mm}.gcard .msg p{margin:0 0 3.2mm}
.gcard .hn{position:absolute;bottom:9.5mm;left:0;right:0;text-align:center;font:600 7.5pt/1 Arial,sans-serif;letter-spacing:.32em;text-transform:uppercase;color:var(--ca)}
.gcard .gap{background:#f8e3df;color:#b23b2b;border-radius:3px;padding:0 3px}
.gcard.t-zarif{--cb:#fdfbf6;--ci:#26332f;--ch:#1e5e5a;--ca:#b08d3c;--o1:#1e5e5a;--o2:#b08d3c;--o3:#e3efec}
.gcard.t-sicak{--cb:#fbf3ec;--ci:#3a2a22;--ch:#a24a26;--ca:#c4633a;--o1:#c4633a;--o2:#e0a35c;--o3:#f3dccb}
.gcard.t-pastel{--cb:#fff7f6;--ci:#3c3036;--ch:#b0566d;--ca:#d39aa8;--o1:#e7a6b6;--o2:#9fb38a;--o3:#f6dde3}
.gcard.t-sade{--cb:#ffffff;--ci:#1b1b1b;--ch:#111;--ca:#1b1b1b;--o1:#1b1b1b;--o2:#888;--o3:#eee}
@media print{.gcard .gap{background:none;color:inherit}}`;
// özgün süsleme: konfeti, yıldızlar ve türe göre balon / halka çizimi
function ornament(occ) {
  const dots = [[24, 18, 2.2, 1], [40, 30, 1.4, 2], [170, 20, 2, 2], [186, 34, 1.3, 1], [16, 120, 1.8, 2], [194, 118, 2.2, 1], [30, 132, 1.2, 1], [178, 132, 1.5, 2], [60, 14, 1.1, 2], [150, 12, 1.2, 1]];
  const star = (x, y, s, c) => `<path d="M${x} ${y - s}L${x + s * 0.28} ${y - s * 0.28}L${x + s} ${y}L${x + s * 0.28} ${y + s * 0.28}L${x} ${y + s}L${x - s * 0.28} ${y + s * 0.28}L${x - s} ${y}L${x - s * 0.28} ${y - s * 0.28}Z" fill="var(--o${c})"/>`;
  let art = '';
  if (occ === 'dogum') {
    const b = (x, y, rx, c, rot) => `<g transform="rotate(${rot} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 1.22}" fill="var(--o${c})" opacity=".9"/><path d="M${x - 1.2} ${y + rx * 1.22}l1.2 1.6 1.2-1.6z" fill="var(--o${c})"/><path d="M${x} ${y + rx * 1.22 + 1.6}c-2 5 2 8 0 13s2 8 0 12" stroke="var(--o2)" stroke-width=".35" fill="none"/></g>`;
    art = b(22, 34, 6, 1, -12) + b(32, 28, 5, 3, 6) + b(188, 34, 6, 1, 12) + b(178, 29, 4.6, 3, -8);
  } else if (occ === 'yildonumu') {
    art = `<g fill="none" stroke="var(--o1)" stroke-width=".7"><circle cx="99" cy="21" r="5.2"/><circle cx="106.5" cy="21" r="5.2" stroke="var(--o2)"/></g>`;
  } else {
    art = `<g fill="none" stroke="var(--o2)" stroke-width=".5"><path d="M86 20c6-6 12-6 19 0s13 6 19 0"/></g>`;
  }
  return `<svg class="orn" viewBox="0 0 210 148" preserveAspectRatio="none" aria-hidden="true">${dots.map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--o${c})" opacity=".55"/>`).join('')}${star(48, 22, 2.6, 2)}${star(160, 128, 2.4, 2)}${star(196, 72, 1.8, 1)}${star(13, 74, 1.6, 2)}${art}</svg>`;
}
export function cardHtml(tpl, text) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  let title = ''; if (lines.length && /^#\s+/.test(lines[0].trim())) title = lines.shift().trim().replace(/^#\s+/, '');
  const paras = []; let cur = [];
  lines.forEach((l) => { if (!l.trim()) { if (cur.length) paras.push(cur); cur = []; } else cur.push(l); }); if (cur.length) paras.push(cur);
  return `<div class="gcard t-${esc(tpl.theme || 'zarif')}"><div class="fr"></div>${ornament(tpl.occ)}<div class="in">${title ? `<h1>${rich(title)}</h1>` : ''}<div class="msg">${paras.map((p) => `<p>${p.map(rich).join('<br>')}</p>`).join('')}</div></div><div class="hn">${esc(S.settings.hotelName)}</div></div>`;
}
const preview = (inner) => `<div class="cardwrap"><div class="cardscale">${inner}</div></div>`;
function fitPreviews() {
  document.querySelectorAll('.cardwrap').forEach((w) => { const s = w.querySelector('.cardscale'); const z = Math.min(1, w.clientWidth / 794); s.style.zoom = z; });
}

/* ---------- etkinlik anahtarları ---------- */
export const evKey = (ev) => `${ev.day}_${ev.key}`;
export const findEv = (gid, key, day) => { const g = byId('guests', gid); if (!g) return null; const o = guestOccasions(g).find((x) => x.key === key); return o ? { ...o, g, day } : null; };
export const resolved = (ev) => {
  const saved = (ev.g.cardTexts || {})[evKey(ev)];
  const tpl = (saved && cardTemplates().find((t) => t.id === saved.tplId)) || defaultFor(ev.type);
  return { tpl, custom: saved && saved.text, ...fillCard(saved && saved.text ? saved.text : tpl.text, ev) };
};
async function logPrinted(evs) {
  for (const ev of evs) {
    const g = byId('guests', ev.g.id); if (!g || !can.edit('guests')) continue;
    try { await S.store.save('guests', stamp({ ...g, cardLog: { ...(g.cardLog || {}), [evKey(ev)]: { at: Date.now(), by: S.user.name } } })); } catch (e) { /* önemli değil */ }
  }
}

/* ---------- KUTLAMALAR ekranı ---------- */
S.celDay = S.celDay || today();
A.celMove = (el) => { S.celDay = el.dataset.d === '0' ? today() : addDays(S.celDay, Number(el.dataset.d)); A._renderView(); };
A.celPick = (el) => { if (el.value) { S.celDay = el.value; A._renderView(); } };
const celChip = (v, l, n) => `<button class="chip ${(S.f.cel || '') === v ? 'on' : ''}" data-act="filter" data-k="cel" data-v="${v}">${l}<i>${n}</i></button>`;
V.cel = {
  headLive: true,
  chips: () => { const all = occasionsOn(S.celDay); return celChip('', 'Tümü', all.length) + celChip('otel', 'Otelde kalanlar', all.filter((e) => stayOn(e.g, e.day)).length) + celChip('mail', 'E-postası olanlar', all.filter((e) => e.g.email).length) + celChip('bekleyen', 'E-posta gönderilmedi', all.filter((e) => e.g.email && !(e.g.mailLog || {})[evKey(e)]).length); },
  title: () => (S.celDay === today() ? 'Bugünün kutlamaları' : 'Kutlamalar · ' + fmtDateLong(S.celDay)),
  head: () => `<button class="btn" data-act="celMove" data-d="-1" aria-label="Önceki gün">${ic('left')}</button><input type="date" class="inp" style="width:auto" value="${S.celDay}" data-change="celPick" aria-label="Tarih"><button class="btn" data-act="celMove" data-d="1" aria-label="Sonraki gün">${ic('right')}</button>${S.celDay !== today() ? '<button class="btn" data-act="celMove" data-d="0">Bugün</button>' : ''}
    ${occasionsOn(S.celDay).length ? `<button class="btn" data-act="cardsPrintAll">${ic('printer')}<span class="hide-m"> Tüm kartları yazdır</span></button>` : ''}${A._mailAllBtn ? A._mailAllBtn() : ''}${can.edit('guests') ? `<button class="btn" data-act="guestImport" title="Excel / CSV listesinden toplu aktar">${ic('upload')}<span class="hide-m"> Excel'den aktar</span></button>` : ''}${can.edit('guests') ? `<button class="btn pri" data-act="celQuick">${ic('plus')} Doğum günü / özel gün ekle</button>` : ''}`,
  body: () => {
    const f = S.f.cel || '';
    const evs = sortBy(occasionsOn(S.celDay).filter((e) => (f === 'otel' ? !!stayOn(e.g, e.day) : f === 'mail' ? !!e.g.email : f === 'bekleyen' ? (e.g.email && !(e.g.mailLog || {})[evKey(e)]) : true)), (e) => (stayOn(e.g, S.celDay) ? '0' : '1') + e.g.name);
    const row = (ev) => {
      const st = stayOn(ev.g, ev.day); const n = yearsSince(ev.date, ev.day); const log = (ev.g.cardLog || {})[evKey(ev)];
      return `<div class="row"><div class="av terra">${ic('cake')}</div>
        <button class="t" style="border:0;background:none;text-align:left;padding:0" data-act="open" data-col="guests" data-id="${ev.g.id}"><b>${esc(ev.g.name)}</b><span>${esc([ev.label, n ? (ev.type === 'dogum' ? n + '. yaş' : n + '. yıl') : '', ev.g.email || ev.g.phone].filter(Boolean).join(' · '))}</span></button>
        <div class="r">${st ? `<span class="badge teal">Otelde${st.room ? ' · Oda ' + esc(st.room) : ''}</span>` : ''}${log ? ` <span class="badge olive">Kart basıldı</span>` : ''}${A._mailState ? A._mailState(ev) : ''}</div>
        <button class="btn sm pri" data-act="cardOpen" data-g="${ev.g.id}" data-k="${ev.key}" data-d="${ev.day}">${ic('cake')} Kart</button></div>`;
    };
    const up = []; for (let i = 1; i <= 7; i++) { const d = addDays(S.celDay, i); occasionsOn(d).forEach((e) => up.push(e)); }
    return `${evs.length ? `<div class="card list">${evs.map(row).join('')}</div>` : `<div class="card empty"><b>${S.celDay === today() ? 'Bugün' : 'Bu tarihte'} doğum günü ya da özel gün yok</b>Ön bürodan gelen günlük listeyi "Doğum günü / özel gün ekle" ile girebilirsiniz.</div>`}
      <div class="card" style="margin-top:14px"><div class="pad" style="padding-bottom:4px"><h3>Sonraki 7 gün</h3></div>${up.length ? `<div class="list">${up.map((e) => `<div class="row"><div class="datebox"><b>${Number(e.day.slice(8))}</b><span>${esc(MONTHS[Number(e.day.slice(5, 7)) - 1].slice(0, 3))}</span></div><button class="t" style="border:0;background:none;text-align:left;padding:0" data-act="open" data-col="guests" data-id="${e.g.id}"><b>${esc(e.g.name)}</b><span>${esc(e.label)}</span></button><div class="r">${stayOn(e.g, e.day) ? '<span class="badge teal">Otelde</span>' : ''}</div><button class="btn sm" data-act="cardOpen" data-g="${e.g.id}" data-k="${e.key}" data-d="${e.day}">Kart</button></div>`).join('')}</div>` : '<div class="pad muted" style="padding-top:0">Önümüzdeki 7 günde kayıtlı özel gün yok.</div>'}</div>`;
  },
};

/* ---------- hızlı ekleme ---------- */
A.celQuick = () => {
  openForm({
    title: 'Doğum günü / özel gün ekle', saveLabel: 'Ekle',
    intro: '<p class="muted" style="margin-top:0">Misafir kayıtlıysa (aynı ad soyad) bilgisi onun kaydına eklenir; değilse yeni misafir açılır.</p>',
    data: { occ: 'dogum', date: S.celDay, checkIn: S.celDay, property: S.settings.properties[0] },
    fields: [
      { k: 'name', label: 'Ad Soyad', req: true },
      { k: 'occ', label: 'Ne kutlanıyor?', type: 'select', opts: Object.entries(OCC), req: true, half: true },
      { k: 'label', label: 'Özel günün adı (Diğer için)', half: true, ph: 'ör. Mezuniyet' },
      { k: 'date', label: 'Tarih', type: 'date', req: true, half: true, hint: 'Doğum yılı biliniyorsa yazın; kartta yaş kullanılabilir.' },
      { k: 'phone', label: 'Telefon', type: 'tel', half: true },
      { type: 'section', label: 'Otelde kalıyorsa' },
      { k: 'room', label: 'Oda', half: true },
      { k: 'property', label: 'Tesis', type: 'select', opts: S.settings.properties.map((p) => [p, p]), half: true },
      { k: 'checkIn', label: 'Giriş', type: 'date', half: true },
      { k: 'checkOut', label: 'Çıkış', type: 'date', half: true },
    ],
    onSave: async (v) => {
      const nm = v.name.trim().toLocaleLowerCase('tr-TR');
      const ex = S.data.guests.find((g) => String(g.name || '').trim().toLocaleLowerCase('tr-TR') === nm);
      const g = ex ? JSON.parse(JSON.stringify(ex)) : { name: v.name.trim(), tags: [], stays: [] };
      if (v.phone && !g.phone) g.phone = v.phone;
      if (v.occ === 'dogum') g.birthday = v.date; else if (v.occ === 'yildonumu') g.anniversary = v.date;
      else { g.specials = (g.specials || []).filter((s) => !(s.label === (v.label || 'Özel gün') && s.date === v.date)); g.specials.push({ label: v.label || 'Özel gün', date: v.date }); }
      if (v.room) {
        const st = stayOn(g, S.celDay);
        if (st) { if (!st.room) st.room = v.room; } else g.stays = [...(g.stays || []), { checkIn: v.checkIn || S.celDay, checkOut: v.checkOut || '', property: v.property, room: v.room, amount: 0, note: 'Kutlama kaydı' }];
      }
      await S.store.save('guests', stamp(g)); toast(ex ? 'Misafir kaydına eklendi' : 'Misafir eklendi');
    },
  });
};

/* ---------- kart penceresi ---------- */
let cc = null; // { gid, key, day, tplId, text, tab }
export function openCard(gid, key, day) {
  const ev = findEv(gid, key, day); if (!ev) return;
  const r = resolved(ev);
  cc = { gid, key, day, tplId: r.tpl.id, text: r.custom || r.tpl.text, custom: !!r.custom, tab: 'view' };
  renderCard();
}
function renderCard() {
  const ev = findEv(cc.gid, cc.key, cc.day); if (!ev) return closeModal();
  const tpl = cardTemplates().find((t) => t.id === cc.tplId) || defaultFor(ev.type);
  const f = fillCard(cc.text, ev); const ed = can.edit('guests');
  const lbl = (k) => (TAGS.find((t) => t[0] === k) || [k, k])[1];
  const sameOcc = cardTemplates().filter((t) => t.occ === ev.type), other = cardTemplates().filter((t) => t.occ !== ev.type);
  $('#modal').innerHTML = `<div class="ov center"><div class="modal" style="width:min(900px,100%)"><div class="mh"><h2>${esc(ev.label)} kartı · ${esc(ev.g.name)}</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb">
      <div class="acts" style="align-items:center;margin-bottom:10px"><label class="muted" for="cardTpl" style="font-size:13px">Şablon</label>
        <select id="cardTpl" class="inp" style="width:auto;max-width:100%" data-change="cardTpl" ${cc.custom ? 'disabled' : ''}>${sameOcc.map((t) => `<option value="${t.id}" ${t.id === tpl.id ? 'selected' : ''}>${esc(t.name)}${t.id === defaultFor(ev.type).id ? ' · otomatik' : ''}</option>`).join('')}${other.length ? `<optgroup label="Diğer şablonlar">${other.map((t) => `<option value="${t.id}" ${t.id === tpl.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>` : ''}</select>
        <span class="muted" style="font-size:12.5px">${fmtDateLong(ev.day)}${stayOn(ev.g, ev.day) ? ' · otelde' : ''}</span></div>
      ${f.missing.length ? `<div class="banner" style="margin-bottom:10px">${ic('warn')}<span>Eksik: <b>${esc(f.missing.map(lbl).join(', '))}</b>. Kartta <span style="color:var(--danger)">……</span> görünüyor; misafir kaydını tamamlayın ya da metni düzenleyin.</span></div>` : ''}
      ${cc.custom ? `<div class="banner" style="margin-bottom:10px;background:var(--primary-soft);border-color:#c6dcd7;color:var(--primary)"><span>Bu kartın metni bu misafir için düzenlendi.</span>${ed ? '<button class="btn sm" data-act="cardReset">Şablona dön</button>' : ''}</div>` : ''}
      <div class="chips" style="margin-bottom:10px"><button class="chip ${cc.tab === 'view' ? 'on' : ''}" data-act="cardTab" data-v="view">Önizleme</button>${ed ? `<button class="chip ${cc.tab === 'edit' ? 'on' : ''}" data-act="cardTab" data-v="edit">Bu kartın metnini düzenle</button>` : ''}</div>
      ${cc.tab === 'edit' ? `<textarea id="cardTxt" class="inp" style="min-height:300px;line-height:1.5">${esc(cc.text)}</textarea>
        <p class="muted" style="font-size:12.5px;margin:6px 0 0">Değişiklik yalnızca bu misafirin bu kartı için. İlk satır <code># Başlık</code> büyük başlık olur; <code>**kalın**</code> kalın yazılır; {ad} gibi etiketler dolmaya devam eder.</p>`
      : `<style>${CARD_CSS}</style>${preview(cardHtml(tpl, f.text))}`}
    </div>
    <div class="mf">${cc.tab === 'edit' ? `<button class="btn sp" data-act="cardTab" data-v="view">Vazgeç</button><button class="btn pri" data-act="cardSave">Bu kart için kaydet</button>` : `
      <button class="btn" data-act="cardCopy">${ic('copy')} Metni kopyala</button>
      ${A._mailBtn ? A._mailBtn(ev) : ''}
      ${ev.g.phone ? `<button class="btn" data-act="cardWa">${ic('wa')} WhatsApp</button>` : ''}
      <button class="btn pri" data-act="cardPrint">${ic('printer')} Yazdır / PDF</button>`}</div></div></div>`;
  fitPreviews();
}
A.cardOpen = (el) => openCard(el.dataset.g, el.dataset.k, el.dataset.d);
A._cardCtx = () => cc;
A._renderCard = () => { if (cc && $('#modal').innerHTML) renderCard(); };
A.cardTpl = (el) => { const t = cardTemplates().find((x) => x.id === el.value); if (!t) return; cc.tplId = t.id; cc.text = t.text; renderCard(); };
A.cardTab = (el) => { if (cc.tab === 'edit' && el.dataset.v === 'view') { const ev = findEv(cc.gid, cc.key, cc.day); const r = resolved(ev); cc.text = r.custom || (cardTemplates().find((t) => t.id === cc.tplId) || r.tpl).text; } cc.tab = el.dataset.v; renderCard(); };
A.cardSave = async (el) => {
  const g = byId('guests', cc.gid); const t = $('#cardTxt').value; el.disabled = true;
  try { await S.store.save('guests', stamp({ ...g, cardTexts: { ...(g.cardTexts || {}), [`${cc.day}_${cc.key}`]: { tplId: cc.tplId, text: t } } })); cc.text = t; cc.custom = true; cc.tab = 'view'; toast('Kart metni kaydedildi'); setTimeout(renderCard, 50); }
  catch (e) { toast(errText(e)); el.disabled = false; }
};
A.cardReset = () => confirmBox('Bu karttaki özel düzenleme silinip şablon metnine dönülecek.', 'Şablona dön', async () => {
  const g = byId('guests', cc.gid); const ct = { ...(g.cardTexts || {}) }; delete ct[`${cc.day}_${cc.key}`];
  await S.store.save('guests', stamp({ ...g, cardTexts: ct })); const ev = findEv(cc.gid, cc.key, cc.day); const tpl = defaultFor(ev.type);
  cc.custom = false; cc.tplId = tpl.id; cc.text = tpl.text; setTimeout(renderCard, 50);
});
export const plain = (text) => String(text).replace(/^#\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1');
A.cardCopy = () => { const ev = findEv(cc.gid, cc.key, cc.day); copyText(plain(fillCard(cc.text, ev).text)); };
A.cardWa = () => { const ev = findEv(cc.gid, cc.key, cc.day); window.open(`https://wa.me/${waNum(ev.g.phone)}?text=${encodeURIComponent(String(fillCard(cc.text, ev).text).replace(/^#\s+(.+)$/m, '*$1*').replace(/\*\*(.+?)\*\*/g, '*$1*'))}`, '_blank', 'noopener'); };
const PRINT_EXTRA = `${CARD_CSS}@page{size:A5 landscape;margin:0}`;
A.cardPrint = () => {
  const ev = findEv(cc.gid, cc.key, cc.day); const tpl = cardTemplates().find((t) => t.id === cc.tplId) || defaultFor(ev.type);
  printHtml(`Kart-${ev.g.name.replace(/[^\p{L}\p{N}]+/gu, '-')}`, cardHtml(tpl, fillCard(cc.text, ev).text), PRINT_EXTRA);
  logPrinted([ev]);
};
A.cardsPrintAll = () => {
  const evs = occasionsOn(S.celDay); if (!evs.length) return;
  const html = evs.map((ev) => { const r = resolved(ev); return cardHtml(r.tpl, r.text); }).join('');
  const miss = evs.filter((ev) => resolved(ev).missing.length).length;
  printHtml(`Kutlama-kartlari-${S.celDay}`, html, PRINT_EXTRA);
  if (miss) toast(`${miss} kartta eksik bilgi var (…… olarak basılır).`);
  logPrinted(evs);
};

/* ---------- şablon yönetimi (Ayarlar) ---------- */
export function cardsSettingsCard() {
  const adm = can.admin(); const list = cardTemplates();
  return `<div class="card" style="grid-column:1/-1"><div class="pad" style="padding-bottom:4px;display:flex;align-items:center;gap:8px"><h3 style="margin:0;flex:1">Kutlama kartları</h3>${adm ? `<button class="btn sm pri" data-act="cardTplNew">${ic('plus')} Yeni kart şablonu</button>` : ''}</div>
    <p class="muted" style="margin:0 18px 6px;font-size:13.5px">Her tür için <b>otomatik</b> işaretli şablon kartta kendiliğinden gelir; kart hazırlarken başka şablon da seçilebilir.</p>
    <div class="list">${list.map((t) => `<button class="row" ${adm ? `data-act="cardTplEdit" data-id="${t.id}"` : 'disabled'}><div class="av terra">${ic('cake')}</div><div class="t"><b>${esc(t.name)}</b><span>${esc(OCC[t.occ] || '')} · ${esc(THEMES[t.theme] || '')}</span></div><div class="r">${defaultFor(t.occ).id === t.id ? '<span class="badge olive">Otomatik</span>' : ''}</div></button>`).join('')}</div></div>`;
}
let ct = null;
function openTplEditor(t, isNew) {
  ct = { id: t.id, isNew };
  const isDef = !isNew && defaultFor(t.occ).id === t.id;
  $('#modal').innerHTML = `<div class="ov center"><div class="modal" style="width:min(1000px,100%)"><div class="mh"><h2>${isNew ? 'Yeni kart şablonu' : 'Kart şablonu'}</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb"><div class="grid g2" style="align-items:start"><div>
      <div class="form" style="margin-bottom:10px">
        <div class="fld"><label for="ctName">Şablon adı</label><input id="ctName" class="inp" value="${esc(t.name)}"></div>
        <div class="fld half"><label for="ctOcc">Tür</label><select id="ctOcc" class="inp">${Object.entries(OCC).map(([k, l]) => `<option value="${k}" ${t.occ === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="fld half"><label for="ctTheme">Tasarım</label><select id="ctTheme" class="inp">${Object.entries(THEMES).map(([k, l]) => `<option value="${k}" ${t.theme === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="fld"><label for="ctSubj">E-posta konusu</label><input id="ctSubj" class="inp" value="${esc(t.subject || '')}" placeholder="ör. İyi ki doğdunuz {ad}!"></div>
        <div class="fld"><label for="ctDef">Bu tür için otomatik gelsin mi?</label><select id="ctDef" class="inp"><option value="evet" ${isDef ? 'selected' : ''}>Evet, kartlarda bu şablon otomatik gelsin</option><option value="hayir" ${isDef ? '' : 'selected'}>Hayır, sadece seçilirse</option></select></div>
      </div>
      <label class="muted" for="ctTxt" style="font-size:12.5px;font-weight:600">Kart metni</label>
      <textarea id="ctTxt" class="inp" style="min-height:250px;line-height:1.5;margin-top:4px">${esc(t.text)}</textarea>
      <div class="acts" style="margin-top:8px">${TAGS.map(([k, l]) => `<button class="chip" data-act="ctInsert" data-k="${k}" title="${esc(l)}">{${k}}</button>`).join('')}</div>
      <p class="muted" style="font-size:12.5px;margin:8px 0 0">İlk satırı <code># İyi ki doğdunuz!</code> gibi yazarsanız büyük başlık olur. <code>**kalın**</code> kalın yazılır. Etiketler her misafirde kendi bilgisiyle dolar.</p>
    </div><div><style>${CARD_CSS}</style><div class="muted" style="font-size:12.5px;margin-bottom:6px">Önizleme (örnek misafir)</div><div id="ctPrev"></div></div></div></div>
    <div class="mf">${!isNew && cardTemplates().length > 1 ? '<button class="btn danger sp" data-act="ctDelete">Sil</button>' : ''}<button class="btn" data-act="closeModal">Vazgeç</button><button class="btn pri" data-act="ctSave">Kaydet</button></div></div></div>`;
  const upd = () => {
    const occ = $('#ctOcc').value; const day = today();
    const g = { id: 'x', name: 'Ayşe Karaca', stays: [{ checkIn: day, checkOut: addDays(day, 2), room: '204' }] };
    const ev = { type: occ, key: occ, label: occ === 'ozel' ? 'Mezuniyetiniz' : OCC[occ], date: '1990' + day.slice(4), g, day };
    $('#ctPrev').innerHTML = preview(cardHtml({ theme: $('#ctTheme').value, occ }, fillCard($('#ctTxt').value, ev).text)); fitPreviews();
  };
  ['ctTxt', 'ctOcc', 'ctTheme'].forEach((id) => $('#' + id).addEventListener(id === 'ctTxt' ? 'input' : 'change', upd)); upd();
}
A.cardTplEdit = (el) => { const t = cardTemplates().find((x) => x.id === el.dataset.id); if (t) openTplEditor(t, false); };
A.cardTplNew = () => openTplEditor({ id: 'c' + Date.now().toString(36), name: 'Yeni kart', occ: 'dogum', theme: 'zarif', subject: DEFAULT_CARDS[0].subject, text: DEFAULT_CARDS[0].text }, true);
A.ctInsert = (el) => { const ta = $('#ctTxt'); const tag = `{${el.dataset.k}}`; const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? s; ta.value = ta.value.slice(0, s) + tag + ta.value.slice(e); ta.focus(); ta.selectionStart = ta.selectionEnd = s + tag.length; ta.dispatchEvent(new Event('input')); };
async function saveCards(cards, defaults) { const { id, ...rest } = S.settings; await S.store.save('settings', { ...rest, id: 'main', cards, cardDefaults: defaults }); }
A.ctSave = async (el) => {
  const name = $('#ctName').value.trim(); const text = $('#ctTxt').value;
  if (!name || !text.trim()) { toast('Şablon adı ve metni boş olamaz.'); return; }
  const t = { id: ct.id, name, occ: $('#ctOcc').value, theme: $('#ctTheme').value, subject: $('#ctSubj').value.trim(), text };
  const list = cardTemplates().slice(); const i = list.findIndex((x) => x.id === t.id); if (i >= 0) list[i] = t; else list.push(t);
  const defs = { ...(S.settings.cardDefaults || {}) };
  if ($('#ctDef').value === 'evet') defs[t.occ] = t.id; else if (defs[t.occ] === t.id) delete defs[t.occ];
  Object.keys(defs).forEach((k) => { const d = list.find((x) => x.id === defs[k]); if (!d || d.occ !== k) delete defs[k]; });
  el.disabled = true;
  try { await saveCards(list, defs); toast('Kart şablonu kaydedildi'); closeModal(); } catch (e) { toast(errText(e)); el.disabled = false; }
};
A.ctDelete = () => confirmBox('Bu kart şablonu silinecek.', 'Sil', async () => {
  const list = cardTemplates().filter((x) => x.id !== ct.id); const defs = { ...(S.settings.cardDefaults || {}) };
  Object.keys(defs).forEach((k) => { if (defs[k] === ct.id) delete defs[k]; });
  await saveCards(list, defs); toast('Şablon silindi'); closeModal();
});

/* misafir kartında "Özel günler" bölümü */
export function guestOccCard(g) {
  const os = guestOccasions(g); if (!os.length) return '';
  return `<div class="card"><div class="pad" style="padding-bottom:4px"><h3>Özel günler</h3></div><div class="list">${os.map((o) => { const nx = nextOccurrence(o); const n = nx ? yearsSince(o.date, nx) : 0; const d = nx ? Math.round((new Date(nx + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 864e5) : 0;
    return `<div class="row"><div class="av terra">${ic('cake')}</div><div class="t"><b>${esc(o.label)}</b><span>${esc([fmtDate(o.date), nx ? (d === 0 ? 'Bugün' : d + ' gün sonra') : '', n ? (o.type === 'dogum' ? n + '. yaş' : n + '. yıl') : ''].filter(Boolean).join(' · '))}</span></div>${nx ? `<button class="btn sm" data-act="cardOpen" data-g="${g.id}" data-k="${o.key}" data-d="${nx}">${ic('cake')} Kart</button>` : ''}</div>`; }).join('')}</div></div>`;
}
