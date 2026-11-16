// Satış kayıtları: kesinleşen grup / etkinlik ve düğün satışlarının aylık ve yıllık defteri
import * as XLSX from 'xlsx';
import { S, A, V, esc, ic, today, fmtDate, fmtNum, money, MONTHS, MON3, toast, sortBy, byId, userName, recMetrics, recTotals, OPP_KINDS } from './core.js';
import { printHtml, saveFile } from './print.js';

const WON = (col, r) => r.stage === (col === 'opps' ? 'kazanildi' : 'sozlesme');
const tsIso = (t) => { if (!t) return ''; const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
S.led = S.led || { year: Number(today().slice(0, 4)), by: 'event', open: {} };

export function wonRows() {
  const out = [];
  ['opps', 'weddings'].forEach((col) => (S.data[col] || []).forEach((r) => {
    if (!WON(col, r)) return;
    const m = recMetrics(col, r); const g = recTotals(col, r); const acc = col === 'opps' ? byId('accounts', r.accountId) : null;
    out.push({
      col, id: r.id, title: col === 'opps' ? r.title : r.couple, kind: col === 'opps' ? OPP_KINDS[r.kind] || 'Grup & etkinlik' : r.eventType || 'Düğün',
      event: (col === 'opps' ? r.start : r.date) || '', end: col === 'opps' ? r.end || '' : '', won: tsIso(r.stageAt || r.updatedAt || r.createdAt),
      account: acc ? acc.name : col === 'weddings' ? 'Bireysel' : '', segment: r.segment || '', channel: r.channel || '', owner: userName(r.ownerId),
      rn: m.roomNights || 0, pax: Number(col === 'opps' ? r.pax : r.guests) || 0, net: (m.net || {}).TRY || 0, gross: g.TRY || 0,
      oda: ((m.dept.oda || {}).TRY) || 0, yi: ((m.dept.yi || {}).TRY) || 0, salon: ((m.dept.salon || {}).TRY) || 0, diger: ((m.dept.diger || {}).TRY) || 0,
      foreign: Object.entries(m.net || {}).filter(([k, v]) => k !== 'TRY' && v).map(([k, v]) => money(v, k)).join(' + '),
    });
  }));
  return out;
}
const dateOf = (r, by) => (by === 'won' ? r.won : r.event);
const sum = (arr, k) => arr.reduce((s, r) => s + (r[k] || 0), 0);
const km = (v) => (Math.abs(v) >= 1e6 ? `₺${(v / 1e6).toFixed(2).replace('.', ',')} mn` : money(Math.round(v)));

V.ledger = {
  title: () => 'Satış kayıtları',
  head: () => `<button class="btn" data-act="ledExcel">${ic('table')}<span class="hide-m"> Excel</span></button><button class="btn" data-act="ledPrint">${ic('printer')}<span class="hide-m"> PDF</span></button>`,
  body: () => {
    const L = S.led; const y = L.year; const all = wonRows();
    const rows = all.filter((r) => dateOf(r, L.by).startsWith(String(y)));
    const years = Array.from(new Set(all.map((r) => dateOf(r, L.by).slice(0, 4)).filter(Boolean).concat([String(y), today().slice(0, 4)]))).sort();
    const byM = Array.from({ length: 12 }, (_, i) => rows.filter((r) => Number(dateOf(r, L.by).slice(5, 7)) === i + 1));
    const yy = sortBy(years, (x) => x, -1).slice(0, 4).reverse();
    const yt = (yr) => all.filter((r) => dateOf(r, L.by).startsWith(yr));
    S.ledLast = { y, by: L.by, rows, byM };
    const fx = rows.filter((r) => r.foreign).length;
    return `<div class="perf">
      <div class="perfbar"><div class="seg" role="group" aria-label="Yıl">${years.map((v) => `<button class="${Number(v) === y ? 'on' : ''}" data-act="ledYear" data-y="${v}" aria-pressed="${Number(v) === y}">${v}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Tarih"><button class="${L.by === 'event' ? 'on' : ''}" data-act="ledBy" data-b="event">Etkinlik / konaklama tarihine göre</button><button class="${L.by === 'won' ? 'on' : ''}" data-act="ledBy" data-b="won">Kesinleşme tarihine göre</button></div></div>
      <div class="kband" style="grid-template-columns:repeat(5,minmax(0,1fr))">
        <div class="kb"><small>${y} kesinleşen satış</small><b>${rows.length}</b><em>${rows.filter((r) => r.col === 'opps').length} grup & etkinlik · ${rows.filter((r) => r.col === 'weddings').length} düğün</em></div>
        <div class="kb"><small>Gelir (vergisiz)</small><b>${km(sum(rows, 'net'))}</b><em>vergiler dahil ${km(sum(rows, 'gross'))}</em></div>
        <div class="kb"><small>Oda-gece</small><b>${fmtNum(sum(rows, 'rn'))}</b><em>${sum(rows, 'rn') ? `ort. oda fiyatı ${km(sum(rows, 'oda') / sum(rows, 'rn'))}` : ''}</em></div>
        <div class="kb"><small>Kişi / davetli</small><b>${fmtNum(sum(rows, 'pax'))}</b></div>
        <div class="kb"><small>Ortalama satış</small><b>${rows.length ? km(sum(rows, 'net') / rows.length) : '—'}</b><em>kayıt başına, vergisiz</em></div></div>
      <div class="card" style="margin-bottom:14px"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">Yıllara göre</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">Gelir vergisiz ₺${fx ? ` · ${fx} kayıtta döviz tutarı ayrıca gösterilir, ₺ toplamına katılmaz` : ''}</p></div>
        <div class="scroll-x"><table class="tb perf-t"><tr><th>Ay</th>${yy.map((v) => `<th class="n">${v}<div class="sub">adet · gelir</div></th>`).join('')}</tr>
        ${MONTHS.map((mn, i) => `<tr><td>${mn}</td>${yy.map((v) => { const a = yt(v).filter((r) => Number(dateOf(r, L.by).slice(5, 7)) === i + 1); return `<td class="n">${a.length ? `${a.length} · <b>${km(sum(a, 'net'))}</b>` : '<span class="muted">—</span>'}</td>`; }).join('')}</tr>`).join('')}
        <tr><td><b>Toplam</b></td>${yy.map((v) => { const a = yt(v); return `<td class="n"><b>${a.length} · ${km(sum(a, 'net'))}</b><div class="sub">${fmtNum(sum(a, 'rn'))} oda-gece</div></td>`; }).join('')}</tr></table></div></div>
      ${byM.map((list, i) => list.length ? `<div class="card ledm" style="margin-bottom:10px"><button class="ledh" data-act="ledToggle" data-m="${i}" aria-expanded="${!!L.open[i]}"><b>${MONTHS[i]} ${y}</b><span>${list.length} satış · ${fmtNum(sum(list, 'rn'))} oda-gece · ${fmtNum(sum(list, 'pax'))} kişi</span><b class="v">${km(sum(list, 'net'))}</b></button>
        ${L.open[i] ? `<div class="scroll-x"><table class="tb perf-t"><tr><th>${L.by === 'won' ? 'Kesinleşme' : 'Tarih'}</th><th>Kayıt</th><th>Acente / firma</th><th>Segment · kanal</th><th>Sorumlu</th><th class="n">Oda-gece</th><th class="n">Kişi</th><th class="n">Oda</th><th class="n">Y-İ</th><th class="n">Salon</th><th class="n">Toplam (vergisiz)</th></tr>
          ${sortBy(list, (r) => dateOf(r, L.by)).map((r) => `<tr><td>${esc(fmtDate(dateOf(r, L.by)))}${L.by === 'won' && r.event ? `<div class="sub">etkinlik ${esc(fmtDate(r.event))}</div>` : ''}</td><td><button class="lnk" data-act="open" data-col="${r.col}" data-id="${r.id}">${esc(r.title)}</button><div class="sub">${esc(r.kind)}</div></td><td>${esc(r.account)}</td><td>${esc(r.segment)}<div class="sub">${esc(r.channel)}</div></td><td>${esc(r.owner)}</td><td class="n">${r.rn ? fmtNum(r.rn) : '—'}</td><td class="n">${r.pax ? fmtNum(r.pax) : '—'}</td><td class="n">${r.oda ? km(r.oda) : '—'}</td><td class="n">${r.yi ? km(r.yi) : '—'}</td><td class="n">${r.salon ? km(r.salon) : '—'}</td><td class="n"><b>${km(r.net)}</b>${r.foreign ? `<div class="sub">+ ${esc(r.foreign)}</div>` : ''}</td></tr>`).join('')}</table></div>` : ''}</div>` : '').join('') || '<div class="card empty"><b>Bu yıl kesinleşen satış yok</b>Talep ya da düğün "Kesinleşti / Sözleşme" aşamasına geçtiğinde burada ay ay listelenir.</div>'}
    </div>`;
  },
};
A.ledYear = (el) => { S.led.year = Number(el.dataset.y); S.led.open = {}; A._renderView(); };
A.ledBy = (el) => { S.led.by = el.dataset.b; S.led.open = {}; A._renderView(); };
A.ledToggle = (el) => { const i = el.dataset.m; S.led.open[i] = !S.led.open[i]; A._renderView(); };
const HEAD = ['Ay', 'Kesinleşme', 'Etkinlik başlangıç', 'Etkinlik bitiş', 'Kayıt', 'Tür', 'Acente / firma', 'Segment', 'Kanal', 'Sorumlu', 'Oda-gece', 'Kişi', 'Oda geliri', 'Y-İ geliri', 'Salon geliri', 'Diğer', 'Toplam vergisiz (₺)', 'Toplam vergiler dahil (₺)', 'Döviz tutarları'];
A.ledExcel = () => {
  const L = S.ledLast; if (!L) return; const all = wonRows(); if (!all.length) return toast('Aktarılacak satış yok.');
  const line = (r) => [MONTHS[Number(dateOf(r, L.by).slice(5, 7)) - 1] || '', r.won, r.event, r.end, r.title, r.kind, r.account, r.segment, r.channel, r.owner, r.rn, r.pax, Math.round(r.oda), Math.round(r.yi), Math.round(r.salon), Math.round(r.diger), Math.round(r.net), Math.round(r.gross), r.foreign];
  const wb = XLSX.utils.book_new();
  const ys = Array.from(new Set(all.map((r) => dateOf(r, L.by).slice(0, 4)).filter(Boolean))).sort();
  const sumRows = [['Yıl', ...MON3, 'Toplam'], ...ys.map((yr) => { const a = all.filter((r) => dateOf(r, L.by).startsWith(yr)); return [yr, ...MON3.map((_, i) => Math.round(sum(a.filter((r) => Number(dateOf(r, L.by).slice(5, 7)) === i + 1), 'net'))), Math.round(sum(a, 'net'))]; })];
  const s0 = XLSX.utils.aoa_to_sheet([[`Satış kayıtları · gelir vergisiz ₺ · ${L.by === 'won' ? 'kesinleşme' : 'etkinlik'} tarihine göre`], [], ...sumRows]); XLSX.utils.book_append_sheet(wb, s0, 'Yıllık özet');
  ys.slice(-4).forEach((yr) => { const a = sortBy(all.filter((r) => dateOf(r, L.by).startsWith(yr)), (r) => dateOf(r, L.by)); const ws = XLSX.utils.aoa_to_sheet([HEAD, ...a.map(line), [], ['Toplam', '', '', '', `${a.length} satış`, '', '', '', '', '', sum(a, 'rn'), sum(a, 'pax'), Math.round(sum(a, 'oda')), Math.round(sum(a, 'yi')), Math.round(sum(a, 'salon')), Math.round(sum(a, 'diger')), Math.round(sum(a, 'net')), Math.round(sum(a, 'gross'))]]); ws['!cols'] = HEAD.map((h) => ({ wch: Math.max(10, h.length + 2) })); XLSX.utils.book_append_sheet(wb, ws, yr); });
  saveFile(`Satis-kayitlari-${today()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
};
A.ledPrint = () => {
  const L = S.ledLast; if (!L) return;
  const tbl = (list) => `<table class="tb"><tr><th>Tarih</th><th>Kayıt</th><th>Acente / firma</th><th>Segment</th><th>Sorumlu</th><th class="n">Oda-gece</th><th class="n">Kişi</th><th class="n">Vergisiz</th></tr>${sortBy(list, (r) => dateOf(r, L.by)).map((r) => `<tr><td>${esc(fmtDate(dateOf(r, L.by)))}</td><td>${esc(r.title)}</td><td>${esc(r.account)}</td><td>${esc(r.segment)}</td><td>${esc(r.owner)}</td><td class="n">${r.rn || ''}</td><td class="n">${r.pax || ''}</td><td class="n">${km(r.net)}${r.foreign ? ' + ' + esc(r.foreign) : ''}</td></tr>`).join('')}<tr><td colspan="5"><b>Toplam</b></td><td class="n"><b>${fmtNum(sum(list, 'rn'))}</b></td><td class="n"><b>${fmtNum(sum(list, 'pax'))}</b></td><td class="n"><b>${km(sum(list, 'net'))}</b></td></tr></table>`;
  printHtml(`Satis-kayitlari-${L.y}`, `<div class="pdoc"><div class="ph"><b>${esc(S.settings.hotelName)}</b><span>${esc(fmtDate(today()))} · ${esc(S.user.name)}</span></div><h1>Satış kayıtları · ${L.y}</h1><p class="sub">${L.rows.length} kesinleşen satış · ${km(sum(L.rows, 'net'))} vergisiz · ${L.by === 'won' ? 'kesinleşme' : 'etkinlik'} tarihine göre</p>
    ${L.byM.map((list, i) => (list.length ? `<h2>${MONTHS[i]} ${L.y} · ${list.length} satış · ${km(sum(list, 'net'))}</h2>${tbl(list)}` : '')).join('')}</div>`);
};
