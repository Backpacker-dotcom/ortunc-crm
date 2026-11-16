// Yönetici özeti: otel performansı, bütçe, satış, yaklaşan etkinlikler, ekip ve dikkat edilecekler tek sayfada (PDF / WhatsApp / e-posta)
import { S, A, V, $, esc, ic, today, addDays, fmtDate, fmtNum, money, MONTHS, toast, sortBy, byId, userName, recMetrics, recTotals, stageLabel, OPP_STAGES, WED_STAGES, lastContact, copyText } from './core.js';
import { printHtml } from './print.js';
import { HOTELS, sumRows, rowsOf, lastDate, dayLy, period, periodLy } from './perf.js';
import { teamActual } from './targets.js';
import { budgetRange } from './budget.js';
import { wonRows } from './ledger.js';

const km = (v) => (v == null || Number.isNaN(v) ? '—' : Math.abs(v) >= 1e6 ? `₺${(v / 1e6).toFixed(2).replace('.', ',')} mn` : money(Math.round(v)));
const pc = (v) => (v == null || Number.isNaN(v) ? '—' : `%${(Math.round(v * 10) / 10).toFixed(1).replace('.', ',')}`);
const dlt = (a, b, pts) => { if (a == null || b == null || (!b && !pts)) return ''; const p = pts ? a - b : ((a - b) / Math.abs(b)) * 100; const v = Math.abs(p).toFixed(1).replace('.', ','); return `<span class="${p >= 0 ? 'dl-up' : 'dl-dn'}">${p >= 0 ? '▲' : '▼'} ${pts ? `${v} puan` : `%${v}`}</span>`; };
const dltT = (a, b, pts) => { if (a == null || b == null || (!b && !pts)) return ''; const p = pts ? a - b : ((a - b) / Math.abs(b)) * 100; const v = Math.abs(p).toFixed(1).replace('.', ','); return ` (${p >= 0 ? '+' : '−'}${pts ? `${v} puan` : `%${v}`})`; };
const WON = (col, r) => r.stage === (col === 'opps' ? 'kazanildi' : 'sozlesme');
const LS = 'ortunc-crm.execNote';
S.exec = S.exec || { note: (() => { try { return localStorage.getItem(LS) || ''; } catch (e) { return ''; } })() };

function data() {
  const t = today(); const hs = Object.keys(HOTELS); const d = lastDate('all');
  const hotel = d ? [...hs.map((h) => [h, HOTELS[h]]), ['all', 'İki otel']].map(([h, label]) => {
    const r = rowsOf(h, d, d); if (!r.length) return null;
    const day = sumRows(r); const mtd = period(h, d, '_mtd'); const ytd = period(h, d, '_ytd');
    const y = Number(d.slice(0, 4)); const hh = h === 'all' ? hs : [h];
    const rM = budgetRange(y, hh, d.slice(0, 8) + '01', d, true); const rY = budgetRange(y, hh, `${y}-01-01`, d, true);
    const bM = rM ? rM.roomRev : null; const bY = rY ? rY.roomRev : null;
    return { h, label, day, dly: dayLy(h, d), mtd, mly: periodLy(h, d, '_mtd'), ytd, yly: periodLy(h, d, '_ytd'), bM, bY };
  }).filter(Boolean) : [];
  const otb = hs.map((h) => { const o = (S.perf.otb || []).filter((x) => x.hotel === h && x.date >= t && x.date <= addDays(t, 29)); const cap = ((sortBy((S.perf.daily || []).filter((r) => r.hotel === h), (r) => r.date, -1)[0]) || {}).rooms || 0; const rn = o.reduce((s, x) => s + x.rooms, 0); return { h, rn, rev: o.reduce((s, x) => s + x.roomRev, 0), occ: cap ? (rn / (cap * 30)) * 100 : null }; });
  // satış
  const won = wonRows(); const ym = t.slice(0, 7), yy = t.slice(0, 4);
  const wonM = won.filter((r) => r.won.startsWith(ym)); const wonY = won.filter((r) => r.won.startsWith(yy));
  const openL = [...(S.data.opps || []).filter((o) => !['kazanildi', 'kaybedildi'].includes(o.stage)).map((r) => ['opps', r]), ...(S.data.weddings || []).filter((w) => !['sozlesme', 'kaybedildi'].includes(w.stage)).map((r) => ['weddings', r])];
  const pipe = openL.reduce((s, [c, r]) => s + (recTotals(c, r).TRY || 0), 0);
  const since = addDays(t, -365); let w12 = 0, l12 = 0;
  ['opps', 'weddings'].forEach((col) => (S.data[col] || []).forEach((r) => { const dd = new Date(r.stageAt || r.updatedAt || r.createdAt || 0).toISOString().slice(0, 10); if (dd < since) return; if (WON(col, r)) w12++; else if (r.stage === 'kaybedildi') l12++; }));
  const big = sortBy(openL.map(([c, r]) => ({ c, r, v: recTotals(c, r).TRY || 0 })), (x) => x.v, -1).slice(0, 6);
  const sum = (a, k) => a.reduce((s, r) => s + (r[k] || 0), 0);
  // yaklaşan etkinlikler
  const up = sortBy([...(S.data.opps || []).filter((o) => o.stage !== 'kaybedildi' && o.start >= t && o.start <= addDays(t, 30)).map((r) => ({ c: 'opps', r, d: r.start, title: r.title, who: (byId('accounts', r.accountId) || {}).name || '', pax: r.pax, st: stageLabel(OPP_STAGES, r.stage), won: r.stage === 'kazanildi' })),
    ...(S.data.weddings || []).filter((w) => w.stage !== 'kaybedildi' && w.date >= t && w.date <= addDays(t, 30)).map((r) => ({ c: 'weddings', r, d: r.date, title: r.couple, who: r.venue || 'Düğün', pax: r.guests, st: stageLabel(WED_STAGES, r.stage), won: r.stage === 'sozlesme' }))], (x) => x.d);
  // ekip
  const m = Number(t.slice(5, 7)) - 1;
  const team = sortBy((S.data.users || []).filter((u) => u.active !== false && ['yonetici', 'satis'].includes(u.role)), (u) => u.name || '').map((u) => { const a = teamActual(u.id, Number(yy)); const tg = (((S.data.targets || []).find((x) => x.id === yy) || {}).team || {})[u.id] || {}; return { name: u.name, rev: a.rev[m], revT: (tg.rev || [])[m] || 0, rn: a.rn[m], visits: a.visits[m], visitsT: (tg.visits || [])[m] || 0, opps: a.opps[m] }; }).filter((x) => x.rev || x.rn || x.visits || x.opps || x.revT || x.visitsT);
  // dikkat
  const late = (S.data.tasks || []).filter((x) => !x.done && x.due && x.due < t).length;
  const lateV = (S.data.visits || []).filter((v) => v.status === 'plan' && v.date < t).length;
  const endC = sortBy((S.data.accounts || []).filter((a) => a.status !== 'pasif' && a.contractEnd && a.contractEnd >= t && a.contractEnd <= addDays(t, 60)), (a) => a.contractEnd);
  const cold = (S.data.accounts || []).filter((a) => a.status === 'aktif' && (!lastContact(a.id) || lastContact(a.id) < addDays(t, -60))).length;
  const expQ = openL.filter(([c, r]) => r.validUntil && r.validUntil < t && ['teklif', 'gorusme', 'opsiyon'].includes(r.stage)).length;
  return { t, d, hotel, otb, wonM, wonY, sum, pipe, openN: openL.length, w12, l12, big, up, team, late, lateV, endC, cold, expQ };
}

function html(D, forPrint) {
  const H = D.hotel; const s = D.sum;
  const sec = (title, inner) => `<section class="xs"><h2>${title}</h2>${inner}</section>`;
  const hotelT = H.length ? `<table class="tb"><tr><th></th>${H.map((x) => `<th class="n">${esc(x.label)}</th>`).join('')}</tr>
    <tr><td>Dün doluluk</td>${H.map((x) => `<td class="n"><b>${pc(x.day.occPct)}</b> ${dlt(x.day.occPct, x.dly && x.dly.occPct, true)}<div class="sub">${fmtNum(x.day.occ)} / ${fmtNum(x.day.rooms)} oda</div></td>`).join('')}</tr>
    <tr><td>Dün oda ADR<div class="sub">net · brüt</div></td>${H.map((x) => `<td class="n">${km(x.day.adr)} · <b>${km(x.day.adrG)}</b></td>`).join('')}</tr>
    <tr><td>Dün satış ADR<div class="sub">oda + kahvaltı, net · brüt</div></td>${H.map((x) => `<td class="n">${km(x.day.sadr)} · <b>${km(x.day.sadrG)}</b></td>`).join('')}</tr>
    <tr><td>Dün oda geliri<div class="sub">net · brüt</div></td>${H.map((x) => `<td class="n">${km(x.day.roomRev)} · <b>${km(x.day.roomRevG)}</b></td>`).join('')}</tr>
    <tr><td>Dün toplam gelir<div class="sub">net · brüt</div></td>${H.map((x) => `<td class="n">${km(x.day.totalRev)} · <b>${km(x.day.totalRevG)}</b> ${dlt(x.day.totalRev, x.dly && x.dly.totalRev)}</td>`).join('')}</tr>
    <tr><td>Ay başından ADR<div class="sub">oda · satış (oda+kahvaltı), brüt</div></td>${H.map((x) => `<td class="n">${km(x.mtd.adrG)} · <b>${km(x.mtd.sadrG)}</b></td>`).join('')}</tr>
    <tr><td>Ay başından doluluk</td>${H.map((x) => `<td class="n">${pc(x.mtd.occPct)} ${dlt(x.mtd.occPct, x.mly && x.mly.occPct, true)}</td>`).join('')}</tr>
    <tr><td>Ay başından oda geliri</td>${H.map((x) => `<td class="n"><b>${km(x.mtd.roomRev)}</b> ${dlt(x.mtd.roomRev, x.mly && x.mly.roomRev)}${x.bM ? `<div class="sub">bütçe gerçekleşmesi ${pc((x.mtd.roomRev / x.bM) * 100)}</div>` : ''}</td>`).join('')}</tr>
    <tr><td>Yıl başından oda geliri</td>${H.map((x) => `<td class="n"><b>${km(x.ytd.roomRev)}</b> ${dlt(x.ytd.roomRev, x.yly && x.yly.roomRev)}${x.bY ? `<div class="sub">bütçe gerçekleşmesi ${pc((x.ytd.roomRev / x.bY) * 100)}</div>` : ''}</td>`).join('')}</tr>
    <tr><td>Yıl başından toplam gelir</td>${H.map((x) => `<td class="n"><b>${km(x.ytd.totalRev)}</b> ${dlt(x.ytd.totalRev, x.yly && x.yly.totalRev)}</td>`).join('')}</tr>
    <tr><td>Önümüzdeki 30 gün</td>${H.map((x) => { const o = x.h === 'all' ? D.otb.reduce((a, b) => ({ rn: a.rn + b.rn, rev: a.rev + b.rev }), { rn: 0, rev: 0 }) : D.otb.find((z) => z.h === x.h) || {}; return `<td class="n">${fmtNum(o.rn || 0)} oda-gece<div class="sub">${km(o.rev || 0)} kesin rezervasyon</div></td>`; }).join('')}</tr></table>
    <p class="muted xs-n">İş günü ${esc(fmtDate(D.d))} · tek değerli satırlar net (vergiler hariç) · bütçe gerçekleşmesi net, gün gün bütçeye göre · ▲▼ geçen yılın aynı dönemine göre</p>` : '<p class="muted">Gece raporu verisi yok.</p>';
  const sales = `<div class="xk"><div><small>${MONTHS[Number(D.t.slice(5, 7)) - 1]} kesinleşen</small><b>${D.wonM.length} · ${km(s(D.wonM, 'net'))}</b><span>${fmtNum(s(D.wonM, 'rn'))} oda-gece</span></div><div><small>${D.t.slice(0, 4)} kesinleşen</small><b>${D.wonY.length} · ${km(s(D.wonY, 'net'))}</b><span>${fmtNum(s(D.wonY, 'rn'))} oda-gece</span></div><div><small>Açık teklifler</small><b>${D.openN} · ${km(D.pipe)}</b><span>vergiler dahil</span></div><div><small>Kazanma oranı · 12 ay</small><b>${D.w12 + D.l12 ? '%' + Math.round((D.w12 / (D.w12 + D.l12)) * 100) : '—'}</b><span>${D.w12} kazanıldı · ${D.l12} kaybedildi</span></div></div>
    ${D.big.length ? `<table class="tb"><tr><th>En büyük açık teklifler</th><th>Acente / firma</th><th>Tarih</th><th>Aşama</th><th class="n">Tutar</th></tr>${D.big.map(({ c, r, v }) => `<tr><td>${esc(c === 'opps' ? r.title : r.couple)}</td><td>${esc(c === 'opps' ? (byId('accounts', r.accountId) || {}).name || '' : 'Düğün')}</td><td>${esc(fmtDate(c === 'opps' ? r.start : r.date))}</td><td>${esc(stageLabel(c === 'opps' ? OPP_STAGES : WED_STAGES, r.stage))}</td><td class="n">${km(v)}</td></tr>`).join('')}</table>` : ''}`;
  const up = D.up.length ? `<table class="tb"><tr><th>Tarih</th><th>Etkinlik</th><th>Acente / mekân</th><th class="n">Kişi</th><th>Durum</th></tr>${D.up.map((x) => `<tr><td>${esc(fmtDate(x.d))}</td><td>${esc(x.title)}</td><td>${esc(x.who)}</td><td class="n">${x.pax ? fmtNum(x.pax) : ''}</td><td>${x.won ? '<b>Kesin</b>' : esc(x.st)}</td></tr>`).join('')}</table>` : '<p class="muted">Önümüzdeki 30 günde grup ya da düğün yok.</p>';
  const team = D.team.length ? `<table class="tb"><tr><th>Kişi</th><th class="n">Kesinleşen gelir</th><th class="n">Oda-gece</th><th class="n">Yeni talep</th><th class="n">Ziyaret</th></tr>${D.team.map((x) => `<tr><td>${esc(x.name)}</td><td class="n">${km(x.rev)}${x.revT ? `<div class="sub">hedef ${km(x.revT)} · ${pc((x.rev / x.revT) * 100)}</div>` : ''}</td><td class="n">${fmtNum(x.rn)}</td><td class="n">${x.opps}</td><td class="n">${x.visits}${x.visitsT ? ` / ${x.visitsT}` : ''}</td></tr>`).join('')}</table>` : '<p class="muted">Bu ay ekip hareketi yok.</p>';
  const warn = [D.late && `${D.late} geciken takip görevi`, D.lateV && `${D.lateV} ziyaretin sonucu girilmedi`, D.expQ && `${D.expQ} teklifin geçerlilik süresi doldu`, ...D.endC.map((a) => `${a.name}: kontrat ${fmtDate(a.contractEnd)} tarihinde bitiyor`), D.cold && `${D.cold} aktif acenteyle 60 günü aşkın süredir temas yok`].filter(Boolean);
  return `<div class="xsum">
    ${sec('Otel performansı', hotelT)}
    ${sec('Satış', sales)}
    ${sec('Önümüzdeki 30 gün · gruplar ve düğünler', up)}
    ${sec(`Ekip · ${MONTHS[Number(D.t.slice(5, 7)) - 1]}`, team)}
    ${sec('Dikkat', warn.length ? `<ul>${warn.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '<p class="muted">Dikkat gerektiren konu yok.</p>')}
    ${forPrint ? (S.exec.note ? sec('Not', `<p style="white-space:pre-wrap">${esc(S.exec.note)}</p>`) : '') : sec('Not', `<textarea class="inp" rows="3" data-change="execNote" placeholder="Özete eklenecek yorumunuz (yazdırırken ve paylaşırken eklenir)">${esc(S.exec.note)}</textarea>`)}
  </div>`;
}
function plain(D) {
  const s = D.sum; const L = [`*${S.settings.hotelName} · Yönetici özeti · ${fmtDate(D.t)}*`, ''];
  D.hotel.forEach((x) => { L.push(`*${x.label}* (${fmtDate(D.d)})`); L.push(`Dün: doluluk ${pc(x.day.occPct)}${dltT(x.day.occPct, x.dly && x.dly.occPct, true)}, oda ADR ${km(x.day.adr)} net / ${km(x.day.adrG)} brüt, satış ADR (oda+kahvaltı) ${km(x.day.sadr)} net / ${km(x.day.sadrG)} brüt, toplam ${km(x.day.totalRev)} net`); L.push(`Ay başından: doluluk ${pc(x.mtd.occPct)}, oda geliri ${km(x.mtd.roomRev)}${dltT(x.mtd.roomRev, x.mly && x.mly.roomRev)}${x.bM ? `, bütçe gerçekleşmesi ${pc((x.mtd.roomRev / x.bM) * 100)}` : ''}`); L.push(`Yıl başından: oda geliri ${km(x.ytd.roomRev)}${dltT(x.ytd.roomRev, x.yly && x.yly.roomRev)}, toplam ${km(x.ytd.totalRev)}`); L.push(''); });
  L.push('*Satış*'); L.push(`Bu ay kesinleşen: ${D.wonM.length} satış, ${km(s(D.wonM, 'net'))}`); L.push(`Yıl başından: ${D.wonY.length} satış, ${km(s(D.wonY, 'net'))}`); L.push(`Açık teklif: ${D.openN} adet, ${km(D.pipe)}`); L.push('');
  if (D.up.length) { L.push('*Önümüzdeki 30 gün*'); D.up.slice(0, 8).forEach((x) => L.push(`${fmtDate(x.d)} · ${x.title}${x.pax ? ` · ${x.pax} kişi` : ''} · ${x.won ? 'kesin' : x.st}`)); L.push(''); }
  if (S.exec.note) { L.push('*Not*'); L.push(S.exec.note); }
  return L.join('\n').trim();
}

V.exec = {
  title: () => 'Yönetici özeti',
  head: () => `<button class="btn" data-act="execWa">${ic('wa')}<span class="hide-m"> WhatsApp</span></button><button class="btn" data-act="execMail">${ic('mail')}<span class="hide-m"> E-posta</span></button><button class="btn pri" data-act="execPrint">${ic('printer')} PDF</button>`,
  body: () => { if (A._loadPerf) A._loadPerf(); const D = data(); S.execLast = D; return `<p class="muted" style="margin:-4px 0 12px">${esc(fmtDate(D.t))} · Onur Bey ve yönetim için tek sayfalık özet. Rakamlar gece raporlarından ve CRM kayıtlarından kendiliğinden gelir.</p>${html(D, false)}`; },
};
A.execNote = (el) => { S.exec.note = el.value; try { localStorage.setItem(LS, el.value); } catch (e) { /* yok */ } };
A.execPrint = () => { const D = S.execLast || data(); printHtml(`Yonetici-ozeti-${D.t}`, `<div class="pdoc"><div class="ph"><b>${esc(S.settings.hotelName)}</b><span>${esc(fmtDate(D.t))} · hazırlayan ${esc(S.user.name)}</span></div><h1>Yönetici özeti</h1>${html(D, true)}</div>`, XCSS); };
A.execWa = () => { const tx = plain(S.execLast || data()); if (window.Android && window.Android.copy) { copyText(tx); toast('Özet kopyalandı; WhatsApp\'ta yapıştırın'); } window.open(`https://wa.me/?text=${encodeURIComponent(tx)}`, '_blank'); };
A.execMail = () => { const D = S.execLast || data(); window.location.href = `mailto:?subject=${encodeURIComponent(`Yönetici özeti · ${fmtDate(D.t)}`)}&body=${encodeURIComponent(plain(D).replace(/\*/g, ''))}`; };
const XCSS = `.xsum .xs{margin:0 0 14px;break-inside:avoid}.xsum h2{font-size:14px;margin:0 0 6px;padding-bottom:4px;border-bottom:2px solid #1F5E8C}.xsum .sub{font-size:10.5px;color:#69768D}.dl-up{color:#4F6B2E;font-size:11px}.dl-dn{color:#B4432E;font-size:11px}.xk{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px}.xk div{border:1px solid #E2E7EF;border-radius:6px;padding:6px 8px}.xk small{display:block;color:#69768D;font-size:10.5px}.xk b{display:block;font-size:14px}.xk span{font-size:10.5px;color:#69768D}.xs-n{font-size:10.5px;margin:4px 0 0}`;
