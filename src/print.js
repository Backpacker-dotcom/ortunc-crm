// Çıktı: dosya kaydetme ve yazdır / PDF (web'de tarayıcının yazdırma penceresi, APK'da Android yazdırma servisi)
import {
  S, A, $, esc, ACC_TYPES, ACC_STATUS, OPP_KINDS, OPP_STAGES, WED_STAGES, ACT_TYPES, ROLES, today, fmtDate, fmtDateLong, fmtRange, money, moneyMap,
  sumByCur, num, fmtNum, byId, userName, stageLabel, wedTotal, recTitle, related, relTasks, lastContact, toast, COL_LABEL, EINV, fmtSize,
} from './core.js';
import { LIST, guestStats } from './views.js';

/* ---------- dosya kaydetme ---------- */
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
export function saveFile(name, mime, u8) {
  if (window.Android && window.Android.saveB64) { window.Android.saveB64(name, mime, b64(u8)); return; }
  try {
    const url = URL.createObjectURL(new Blob([u8], { type: mime }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(name + ' indiriliyor');
  } catch (e) { toast('Dosya indirilemedi.'); }
}
window.onNativeExport = (ok) => toast(ok ? 'Dosya kaydedildi' : 'Kaydedilmedi');

/* ---------- yazdırma ---------- */
export const DOC_CSS = `.pdoc{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1d2a2a;font-size:12.5px;line-height:1.45;max-width:1000px;margin:0 auto;padding:18px 22px;background:#fff}
.pdoc .ph{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:2px solid #1e5e5a;padding-bottom:8px;margin-bottom:14px}
.pdoc .ph b{font-family:Georgia,serif;font-size:19px;font-weight:600}.pdoc .ph span{font-size:11px;color:#667370;text-align:right}
.pdoc h1{font-family:Georgia,serif;font-size:22px;font-weight:600;margin:0 0 2px}.pdoc .sub{color:#667370;margin:0 0 14px}
.pdoc h2{font-size:11.5px;text-transform:uppercase;letter-spacing:.08em;color:#1e5e5a;margin:18px 0 6px;border-bottom:1px solid #e3dcd0;padding-bottom:4px}
.pdoc table{width:100%;border-collapse:collapse}.pdoc th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#667370;padding:5px 6px;border-bottom:1.5px solid #1d2a2a}
.pdoc td{padding:5px 6px;border-bottom:1px solid #e3dcd0;vertical-align:top}.pdoc td.n,.pdoc th.n{text-align:right;white-space:nowrap}
.pdoc table.kv td:first-child{width:150px;color:#667370}.pdoc tr{page-break-inside:avoid}
.pdoc .tot td{font-weight:700;border-top:1.5px solid #1d2a2a;border-bottom:0}.pdoc .note{white-space:pre-wrap}.pdoc .muted{color:#667370}
.pdoc .foot{margin-top:18px;font-size:10.5px;color:#999;text-align:right}`;
const PRINT_WRAP = `@media screen{#printArea{display:none}}@media print{body>*:not(#printArea){display:none!important}#printArea{display:block}@page{margin:11mm}body{background:#fff}}`;
const SNAP_CSS = `#printArea .btn,#printArea .x,#printArea .search,#printArea .check,#printArea .banner .btn{display:none!important}#printArea .card,#printArea .kpi{box-shadow:none;break-inside:avoid}#printArea .snap{padding:14px}#printArea .snap h1{font-family:Georgia,serif;font-size:22px;margin:0 0 12px}`;

export function printHtml(name, html, extraCss = '', withAppCss = false) {
  const appCss = withAppCss ? (document.querySelector('head style') || {}).textContent || '' : '';
  if (window.Android && window.Android.printHtml) {
    window.Android.printHtml(name, `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{margin:0;background:#fff}${appCss}${DOC_CSS}${extraCss}${withAppCss ? SNAP_CSS.replace(/#printArea /g, '') : ''}</style></head><body>${html}</body></html>`);
    return;
  }
  const pa = $('#printArea');
  pa.innerHTML = `<style>${PRINT_WRAP}${DOC_CSS}${extraCss}${withAppCss ? SNAP_CSS : ''}</style>${html}`;
  const t = document.title; document.title = name;
  const done = () => { document.title = t; pa.innerHTML = ''; };
  try { window.print(); } catch (e) { toast('Yazdırma bu ortamda açılamadı.'); }
  setTimeout(done, 1500);
}
const fname = (s) => String(s).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
const head = (title, sub) => `<div class="ph"><b>${esc(S.settings.hotelName)}</b><span>${esc(fmtDate(today()))} · ${esc(S.user.name)}</span></div><h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}`;
const kv = (pairs) => { const p = pairs.filter((x) => x[1] !== '' && x[1] != null); return p.length ? `<table class="kv">${p.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="note">${esc(v)}</td></tr>`).join('')}</table>` : '<p class="muted">—</p>'; };
const table = (heads, rows, numCols = []) => (rows.length ? `<table><tr>${heads.map((h, i) => `<th class="${numCols.includes(i) ? 'n' : ''}">${esc(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${numCols.includes(i) ? 'n' : 'note'}">${esc(c ?? '')}</td>`).join('')}</tr>`).join('')}</table>` : '<p class="muted">Kayıt yok.</p>');
const sec = (t, body) => `<h2>${esc(t)}</h2>${body}`;
const wrap = (inner) => `<div class="pdoc">${inner}<div class="foot">Ortunç CRM · ${esc(fmtDate(today()))}</div></div>`;

const filesSec = (col, id) => { const fs = S.data.files.filter((f) => f.ref && f.ref.col === col && f.ref.id === id); return fs.length ? sec('Belgeler', table(['Belge', 'Tür', 'Geçerlilik', 'Boyut', 'Yükleyen'], fs.map((f) => [f.title || f.name, ({ kontrat: 'Kontrat', sozlesme: 'İmzalı sözleşme', fiyat: 'Fiyat listesi', teklif: 'Teklif', fatura: 'Fatura / dekont', diger: 'Diğer' })[f.kind] || '', fmtRange(f.validFrom, f.validTo), fmtSize(f.size), f.uploadedByName]))) : ''; };
function relSections(col, id) {
  const ts = relTasks(col, id), as = related(col, id);
  return sec('Görevler', table(['Tarih', 'Görev', 'Atanan', 'Durum'], ts.map((t) => [fmtDate(t.due), t.title + (t.note ? '\n' + t.note : ''), userName(t.assigneeId), t.done ? 'Tamamlandı' : 'Açık'])))
    + sec('Aktivite geçmişi', table(['Tarih', 'Tür', 'Konu / not', 'Giren'], as.map((a) => [fmtDate(a.date), ACT_TYPES[a.type] || '', a.subject + (a.note ? '\n' + a.note : ''), a.userName || ''])));
}
const RECORD = {
  accounts: (a) => head(a.name, [ACC_TYPES[a.type], ACC_STATUS[a.status], [a.city, a.country].filter(Boolean).join(', ')].filter(Boolean).join(' · '))
    + sec('Bilgiler', kv([['Pazar', a.market], ['Telefon', a.phone], ['E-posta', a.email], ['Web', a.web], ['Sorumlu', userName(a.ownerId)], ['Komisyon', a.commission !== '' && a.commission != null ? '%' + a.commission : ''], ['Kontrat', fmtRange(a.contractStart, a.contractEnd)], ['Kontrat notu', a.contractNote], ['Son temas', fmtDate(lastContact(a.id))], ['Notlar', a.notes]]))
    + sec('Fatura bilgileri', kv([['Ticari ünvan', a.invTitle], ['Vergi dairesi', a.taxOffice], ['Vergi no', a.taxNo], ['Fatura adresi', a.invAddress], ['Fatura e-postası', a.invEmail], ['e-Fatura', EINV[a.eInvoice] || ''], ['Ödeme koşulu', a.paymentTerms], ['MERSİS', a.mersis], ['IBAN', a.iban]]))
    + sec('Yetkili kişiler', table(['Ad Soyad', 'Görevi', 'Telefon', 'E-posta'], (a.contacts || []).map((c) => [c.name, c.title, c.phone, c.email])))
    + filesSec('accounts', a.id)
    + sec('Grup & etkinlik talepleri', table(['Talep', 'Tarih', 'Aşama', 'Tutar'], S.data.opps.filter((o) => o.accountId === a.id).map((o) => [o.title, fmtRange(o.start, o.end), stageLabel(OPP_STAGES, o.stage), o.value ? money(num(o.value), o.currency) : '']), [3]))
    + relSections('accounts', a.id),
  guests: (g) => { const s = guestStats(g); return head(g.name, [(g.tags || []).join(', '), [g.city, g.country].filter(Boolean).join(', ')].filter(Boolean).join(' · '))
    + sec('Bilgiler', kv([['Telefon', g.phone], ['E-posta', g.email], ['Doğum günü', g.birthday ? fmtDateLong(g.birthday) : ''], ['Yıl dönümü', g.anniversary ? fmtDateLong(g.anniversary) : ''], ['Diğer özel günler', (g.specials || []).filter((x) => x.date).map((x) => `${x.label}: ${fmtDate(x.date)}`).join('\n')], ['Konaklama', `${s.n} konaklama · ${s.nights} gece`], ['Tercihler', g.prefs], ['Notlar', g.notes]]))
    + sec('Konaklama geçmişi', table(['Tarih', 'Tesis', 'Oda', 'Not', 'Tutar'], (g.stays || []).slice().sort((x, y) => String(y.checkIn).localeCompare(String(x.checkIn))).map((x) => [fmtRange(x.checkIn, x.checkOut), x.property, x.room, x.note, x.amount ? fmtNum(x.amount) : '']), [4]))
    + relSections('guests', g.id); },
  opps: (o) => { const acc = byId('accounts', o.accountId); return head(o.title, [OPP_KINDS[o.kind], stageLabel(OPP_STAGES, o.stage)].join(' · '))
    + sec('Talep', kv([['Acente / firma', acc ? acc.name : ''], ['İlgili kişi', o.contactName], ['Telefon', o.phone], ['Tesis', o.property], ['Tarih', fmtRange(o.start, o.end)], ['Kişi', o.pax], ['Oda', o.rooms], ['Tahmini tutar', o.value ? money(num(o.value), o.currency) : ''], ['Kaynak', o.source], ['Sorumlu', userName(o.ownerId)], ['Teklif geçerlilik', fmtDate(o.validUntil)], ['Kayıp nedeni', o.stage === 'kaybedildi' ? o.lossReason : ''], ['Notlar', o.notes]]))
    + filesSec('opps', o.id) + relSections('opps', o.id); },
  weddings: (w) => { const c = w.currency; return head(w.couple, [w.eventType || 'Düğün', stageLabel(WED_STAGES, w.stage), w.date ? fmtDateLong(w.date) : ''].filter(Boolean).join(' · '))
    + sec('Organizasyon', kv([['Mekân', w.venue], ['Davetli', w.guests], ['Menü / paket', w.menu], ['Telefon', w.phone], ['E-posta', w.email], ['Kaynak', w.source], ['Sorumlu', userName(w.ownerId)], ['Teklif geçerlilik', fmtDate(w.validUntil)], ['Kayıp nedeni', w.stage === 'kaybedildi' ? w.lossReason : ''], ['Notlar', w.notes]]))
    + sec('Fiyat', `<table><tr><th>Kalem</th><th class="n">Tutar</th></tr><tr><td>${fmtNum(num(w.guests))} kişi × ${esc(money(num(w.perPerson), c))}</td><td class="n">${esc(money(num(w.guests) * num(w.perPerson), c))}</td></tr>${(w.extras || []).map((x) => `<tr><td>${esc(x.name)}</td><td class="n">${esc(money(num(x.amount), c))}</td></tr>`).join('')}${num(w.discount) ? `<tr><td>İndirim</td><td class="n">−${esc(money(num(w.discount), c))}</td></tr>` : ''}<tr class="tot"><td>Toplam</td><td class="n">${esc(money(wedTotal(w), c))}</td></tr>${num(w.deposit) ? `<tr><td>İstenen kapora</td><td class="n">${esc(money(num(w.deposit), c))}</td></tr>` : ''}${num(w.depositPaid) ? `<tr><td>Alınan kapora</td><td class="n">${esc(money(num(w.depositPaid), c))}</td></tr><tr><td><b>Kalan</b></td><td class="n"><b>${esc(money(Math.max(0, wedTotal(w) - num(w.depositPaid)), c))}</b></td></tr>` : ''}</table>`)
    + filesSec('weddings', w.id) + relSections('weddings', w.id); },
};
RECORD.blacklist = (b) => head(b.name, 'Kara liste') + sec('Bilgiler', kv([['Telefon', b.phone], ['E-posta', b.email], ['Sebep', (A._BL || {})[b.reason] || ''], ['Olay tarihi', fmtDate(b.date)], ['Oda / rez. no', b.room], ['Alacak', b.amount ? fmtNum(b.amount) : ''], ['Ne oldu?', b.detail], ['Ekleyen', b.addedByName]]));
A.printRec = (el) => { const r = byId(el.dataset.col, el.dataset.id); if (!r) return; printHtml(`${COL_LABEL[el.dataset.col]}-${fname(recTitle(el.dataset.col, r))}`, wrap(RECORD[el.dataset.col](r))); };

const filterNote = () => [S.q ? `Arama: "${S.q}"` : '', ...Object.values(S.f).filter(Boolean).map(String)].filter(Boolean).join(' · ');
const LISTS = {
  blacklist: () => { const l = A._blList(); return ['Kara Liste', table(['Ad Soyad', 'Telefon', 'E-posta', 'Sebep', 'Ne oldu?', 'Tarih', 'Ekleyen'], l.map((b) => [b.name, b.phone, b.email, (A._BL || {})[b.reason] || '', b.detail, fmtDate(b.date), b.addedByName])), l.length]; },
  accounts: () => { const l = LIST.accounts(); return ['Acenteler & Firmalar', table(['Firma / acente', 'Tür', 'Durum', 'Şehir', 'Yetkili', 'Telefon', 'E-posta', 'Kontrat bitiş', 'Son temas'], l.map((a) => { const c = (a.contacts || [])[0] || {}; return [a.name, ACC_TYPES[a.type], ACC_STATUS[a.status], a.city, c.name, c.phone || a.phone, c.email || a.email, fmtDate(a.contractEnd), fmtDate(lastContact(a.id))]; })), l.length]; },
  guests: () => { const l = LIST.guests(); return ['Misafirler', table(['Ad Soyad', 'Telefon', 'E-posta', 'Şehir / ülke', 'Etiketler', 'Konaklama', 'Gece', 'Son giriş'], l.map((g) => { const s = guestStats(g); return [g.name, g.phone, g.email, [g.city, g.country].filter(Boolean).join(', '), (g.tags || []).join(', '), s.n, s.nights, fmtDate(s.last)]; }), [5, 6]), l.length]; },
  opps: () => { const l = LIST.opps().slice().sort((a, b) => String(a.start || '9').localeCompare(String(b.start || '9'))); return ['Grup & Etkinlik Talepleri', table(['Talep', 'Firma', 'Tür', 'Aşama', 'Tarih', 'Kişi', 'Oda', 'Tutar', 'Sorumlu'], l.map((o) => [o.title, (byId('accounts', o.accountId) || {}).name, OPP_KINDS[o.kind], stageLabel(OPP_STAGES, o.stage), fmtRange(o.start, o.end), o.pax, o.rooms, o.value ? money(num(o.value), o.currency) : '', userName(o.ownerId)]), [5, 6, 7]) + `<p><b>Toplam:</b> ${esc(moneyMap(sumByCur(l.filter((o) => o.stage !== 'kaybedildi'), (o) => num(o.value))))} (kaybedilenler hariç)</p>`, l.length]; },
  weddings: () => { const l = LIST.weddings(); return ['Düğün Teklifleri', table(['Tarih', 'Çift', 'Mekân', 'Aşama', 'Davetli', 'Kişi başı', 'Toplam', 'Kapora alınan', 'Telefon'], l.map((w) => [fmtDate(w.date), w.couple, w.venue, stageLabel(WED_STAGES, w.stage), w.guests, w.perPerson ? money(num(w.perPerson), w.currency) : '', money(wedTotal(w), w.currency), num(w.depositPaid) ? money(num(w.depositPaid), w.currency) : '', w.phone]), [4, 5, 6, 7]) + `<p><b>Toplam:</b> ${esc(moneyMap(sumByCur(l.filter((w) => w.stage !== 'kaybedildi'), wedTotal)))} (kaybedilenler hariç)</p>`, l.length]; },
  tasks: () => { const l = LIST.tasks(); return ['Görevler & Takipler', table(['Tarih', 'Görev', 'İlgili kayıt', 'Atanan', 'Durum', 'Not'], l.map((t) => [fmtDate(t.due), t.title, t.ref ? (recTitle(t.ref.col, byId(t.ref.col, t.ref.id)) || t.refName) : '', userName(t.assigneeId), t.done ? 'Tamamlandı' : (t.due && t.due < today() ? 'Gecikti' : 'Açık'), t.note])), l.length]; },
};
A.printList = (el) => { const [title, body, n] = LISTS[el.dataset.k](); const f = filterNote(); printHtml(fname(title) + '-' + today(), wrap(head(title, `${n} kayıt${f ? ' · ' + f : ''}`) + body)); };
// Pano, takvim ve raporlar: ekrandaki görünüm aynen
A.printPage = (el) => { const b = $('#body'); if (!b) return; printHtml(fname(el.dataset.title || 'Ortunc-CRM') + '-' + today(), `<div class="snap"><h1>${esc(el.dataset.title || '')}</h1>${b.innerHTML}</div>`, '', true); };
export { ROLES };
