// Hedefler & bütçe: gelir bütçesi (budget.js) ile gerçekleşenin karşılaştırması ve satış ekibi hedefleri
import * as XLSX from 'xlsx';
import { S, A, V, $, $$, esc, ic, today, fmtDate, fmtNum, money, num, MON3, MONTHS, toast, can, sortBy, recMetrics, errText, closeModal, stamp, confirmBox } from './core.js';
import { printHtml, saveFile } from './print.js';
import { HOTELS, sumRows, TAXF } from './perf.js';
import { tdoc, budgetSeries, budgetRange, budgetVersions, exportBudgetXlsx, printBudget, openBudget, monthTot, normB } from './budget.js';

const M12 = () => Array(12).fill(0);
export const TEAM_KEYS = [['rev', 'Kesinleşen gelir (₺, vergisiz)'], ['rn', 'Kesinleşen oda-gece'], ['opps', 'Yeni talep'], ['visits', 'Satış ziyareti']];
// geriye uyum (özet ekranı): net bütçe serisi
export const budget = (y, hs) => { const b = budgetSeries(y, hs, true); return { rn: b.rn, roomRev: b.roomRev, fbRev: b.fbRev.map((v, i) => v + b.bfRev[i]), set: b.set }; };
// gerçekleşen (gece raporları): ay ay, net ve brüt
function actual(y, hs) {
  const o = { months: Array.from({ length: 12 }, () => null), otbRn: M12(), otbRev: M12() };
  for (let m = 0; m < 12; m++) { const p = `${y}-${String(m + 1).padStart(2, '0')}`; const r = (S.perf.daily || []).filter((x) => hs.includes(x.hotel) && x.date.startsWith(p)); if (r.length) o.months[m] = sumRows(r); }
  const t = today(); const f = TAXF(); (S.perf.otb || []).forEach((r) => { if (!hs.includes(r.hotel) || !r.date.startsWith(String(y)) || r.date < t) return; const m = Number(r.date.slice(5, 7)) - 1; o.otbRn[m] += r.rooms || 0; o.otbRev[m] += r.roomRev || 0; });
  o.otbRevG = o.otbRev.map((v) => v * f.pkg);
  return o;
}
const pctOf = (a, b) => (b ? (a / b) * 100 : null);
const P = (v) => (v == null ? '—' : `%${Math.round(v)}`);
const km = (v) => (v == null || Number.isNaN(v) ? '—' : Math.abs(v) >= 1e6 ? `₺${(v / 1e6).toFixed(2).replace('.', ',')} mn` : money(Math.round(v)));
const bar = (p) => `<div class="pbar" title="${p == null ? '' : '%' + Math.round(p)}"><i style="width:${Math.max(0, Math.min(100, p || 0))}%;background:${p == null ? '#CBD5E2' : p >= 100 ? '#4F6B2E' : p >= 80 ? 'var(--primary)' : '#C98A1B'}"></i></div>`;

const WON = (col, r) => r.stage === (col === 'opps' ? 'kazanildi' : 'sozlesme');
const tsIso = (t) => { if (!t) return ''; const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function teamActual(uid, y) {
  const o = { rev: M12(), rn: M12(), opps: M12(), visits: M12() }; const ys = String(y);
  ['opps', 'weddings'].forEach((col) => (S.data[col] || []).forEach((r) => {
    if (r.ownerId !== uid) return;
    const c = tsIso(r.createdAt); if (c.startsWith(ys)) o.opps[Number(c.slice(5, 7)) - 1]++;
    if (WON(col, r)) { const d = tsIso(r.stageAt || r.updatedAt || r.createdAt); if (d.startsWith(ys)) { const m = recMetrics(col, r); const i = Number(d.slice(5, 7)) - 1; o.rev[i] += (m.net || {}).TRY || 0; o.rn[i] += m.roomNights || 0; } }
  }));
  (S.data.activities || []).forEach((a) => { if (a.userId === uid && a.type === 'ziyaret' && (a.date || '').startsWith(ys)) o.visits[Number(a.date.slice(5, 7)) - 1]++; });
  return o;
}
const teamTarget = (y, uid) => { const t = tdoc(y); const x = (t && t.team && t.team[uid]) || {}; return Object.fromEntries(TEAM_KEYS.map(([k]) => [k, (x[k] || M12()).map(num)])); };
const salesUsers = () => sortBy((S.data.users || []).filter((u) => u.active !== false && ['yonetici', 'satis'].includes(u.role)), (u) => u.name || '');

/* ---------- ekran ---------- */

/* ---------- ekran ---------- */
S.goals = S.goals || { year: Number(today().slice(0, 4)), hotel: 'all', mode: 'gross' };
V.goals = {
  title: () => 'Hedefler & bütçe',
  head: () => `${can.admin() ? `<button class="btn pri" data-act="budgetEdit">${ic('pencil')}<span class="hide-m"> Bütçeyi düzenle / revize et</span></button><button class="btn" data-act="teamEdit">${ic('target')}<span class="hide-m"> Ekip hedefleri</span></button>` : ''}<button class="btn" data-act="goalsExcel">${ic('table')}<span class="hide-m"> Excel</span></button><button class="btn" data-act="goalsPrint">${ic('printer')}<span class="hide-m"> PDF</span></button>`,
  body: () => {
    if (A._loadPerf) A._loadPerf();
    const G = S.goals; const y = G.year; const hs = G.hotel === 'all' ? Object.keys(HOTELS) : [G.hotel]; const gross = G.mode !== 'net';
    const b = budgetSeries(y, hs, !gross); const a = actual(y, hs); const t = today(); const ys = String(y);
    const doc = tdoc(y); const vers = budgetVersions(y);
    // bugüne kadar: bütçe gün gün (dün dahil, gece raporu dünün)
    const upto = ys === t.slice(0, 4) ? (() => { const d = new Date(t + 'T12:00:00'); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })() : ys < t.slice(0, 4) ? `${ys}-12-31` : null;
    const bTD = upto && b.set ? budgetRange(y, hs, `${ys}-01-01`, upto, !gross) : null;
    const aTD = upto ? sumRows((S.perf.daily || []).filter((x) => hs.includes(x.hotel) && x.date >= `${ys}-01-01` && x.date <= upto)) : null;
    const g = (o, k) => (o ? o[gross ? { roomRev: 'roomRevG', bfRev: 'bfRevG', restRev: 'restRevG', totalRev: 'totalRevG', adr: 'adrG', sadr: 'sadrG' }[k] || k : k] : null);
    const yr = (k) => b[k].reduce((s, v) => s + v, 0);
    const adrB = (rev, rn) => (rn ? rev / rn : null);
    S.goalsLast = { y, hs, b, a, gross };
    const yearOpts = [y - 2, y - 1, y, y + 1, y + 2];
    const team = salesUsers();
    const lastV = vers[vers.length - 1];
    return `<div class="perf">
      <div class="perfbar"><div class="seg" role="group" aria-label="Yıl">${yearOpts.map((v) => `<button class="${v === y ? 'on' : ''}" data-act="goalsYear" data-y="${v}" aria-pressed="${v === y}">${v}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Otel">${[['all', 'İki otel'], ...Object.entries(HOTELS)].map(([k, l]) => `<button class="${G.hotel === k ? 'on' : ''}" data-act="goalsHotel" data-h="${k}" aria-pressed="${G.hotel === k}">${esc(l)}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Tutarlar"><button class="${gross ? '' : 'on'}" data-act="goalsMode" data-m="net">Net</button><button class="${gross ? 'on' : ''}" data-act="goalsMode" data-m="gross">Brüt</button></div></div>
      ${!b.set ? `<div class="banner">${ic('target')}<span><b>${y} için gelir bütçesi girilmedi.</b> ${can.admin() ? '"Bütçeyi düzenle" ile aylık ya da gün gün girin; Excel bütçe dosyanızı da yükleyebilirsiniz.' : 'Yönetici bütçeyi girdiğinde gerçekleşme burada görünür.'}</span>${can.admin() ? '<button class="btn sm" data-act="budgetEdit">Bütçeyi gir</button>' : ''}</div>` : ''}
      ${b.set ? `<div class="kband">
        ${[['roomRev', 'Oda geliri'], ['bfRev', 'Kahvaltı'], ['fbRev', 'Restoran'], ['total', 'Toplam']].map(([k, l]) => { const av = aTD ? (k === 'fbRev' ? g(aTD, 'restRev') : k === 'total' ? (g(aTD, 'roomRev') || 0) + (g(aTD, 'bfRev') || 0) + (g(aTD, 'restRev') || 0) : g(aTD, k)) : null; const bv = bTD ? bTD[k] : null; const p = pctOf(av, bv); return `<div class="kb"><small>${l} · bugüne kadar</small><b>${km(av)}</b><em>bütçe ${km(bv)} · ${P(p)}</em>${bar(p)}</div>`; }).join('')}
        <div class="kb"><small>Oda ADR · bugüne kadar</small><b>${km(g(aTD, 'adr'))}</b><em>bütçe ${km(bTD && bTD.adr)}</em><span class="kfoot">satış ADR (oda+kahvaltı) ${km(g(aTD, 'sadr'))}</span></div>
        <div class="kb"><small>Yıl bütçesi · toplam</small><b>${km(yr('total'))}</b><em>${fmtNum(Math.round(yr('rn')))} oda-gece · ADR ${km(adrB(yr('roomRev'), yr('rn')))}</em><span class="kfoot">${lastV ? `${esc(lastV.label)}${lastV.at ? ' · ' + esc(fmtDate(new Date(lastV.at).toISOString().slice(0, 10))) : ''}` : ''}</span></div>
      </div>` : ''}
      <div class="card" style="margin-bottom:14px"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">${y} aylık · bütçe ve gerçekleşen</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">Tutarlar ${gross ? 'vergiler dahil (brüt)' : 'vergiler hariç (net)'} ₺. ${doc && doc.gross !== false && !gross ? `Brüt bütçe net'e çevrildi (oda ve kahvaltı KDV %${TAXF().kdv} + konaklama vergisi %${TAXF().kv}, restoran KDV %${TAXF().kdv}). ` : ''}Gerçekleşen gece raporlarından; restoran = yiyecek-içecek gelirinden kahvaltı çıkarılarak.</p></div>
        <div class="pad" style="padding-top:6px">${chartBA(b.total, a.months.map((x) => (x ? (g(x, 'roomRev') || 0) + (g(x, 'bfRev') || 0) + (g(x, 'restRev') != null ? g(x, 'restRev') : 0) : 0)), gross ? a.otbRevG : a.otbRev)}<p class="muted" style="font-size:12px;margin:2px 0 8px">Toplam gelir · açık gri: bütçe · koyu: gerçekleşen · kesikli: ileri tarihli kesin rezervasyon (oda)</p></div>
        <div class="scroll-x"><table class="tb perf-t"><tr><th>Ay</th><th class="n">Oda-gece<div class="sub">bütçe → gerçek</div></th><th class="n">Oda ADR<div class="sub">bütçe → gerçek</div></th><th class="n">Satış ADR<div class="sub">oda + kahvaltı</div></th><th class="n">Oda geliri<div class="sub">bütçe → gerçek</div></th><th class="n">%</th><th class="n">Kahvaltı<div class="sub">bütçe → gerçek</div></th><th class="n">Restoran<div class="sub">bütçe → gerçek</div></th><th class="n">Toplam<div class="sub">bütçe → gerçek</div></th><th class="n">%</th><th class="n">Kesin rez.<div class="sub">oda-gece · oda geliri</div></th></tr>
        ${MONTHS.map((mn, i) => { const x = a.months[i]; const tot = x ? (g(x, 'roomRev') || 0) + (g(x, 'bfRev') || 0) + (g(x, 'restRev') != null ? g(x, 'restRev') : 0) : null; const note = doc && (normB(doc).notes || [])[i]; return `<tr class="${ys + '-' + String(i + 1).padStart(2, '0') === t.slice(0, 7) ? 'cur' : ''}"><td>${esc(mn)}${note ? `<div class="sub">${esc(note)}</div>` : ''}</td><td class="n">${fmtNum(Math.round(b.rn[i]))} → <b>${x ? fmtNum(x.occ) : '—'}</b></td><td class="n">${km(adrB(b.roomRev[i], b.rn[i]))} → <b>${x ? km(g(x, 'adr')) : '—'}</b></td><td class="n">${x && g(x, 'sadr') != null ? km(g(x, 'sadr')) : '—'}</td><td class="n">${km(b.roomRev[i])} → <b>${x ? km(g(x, 'roomRev')) : '—'}</b></td><td class="n">${x ? P(pctOf(g(x, 'roomRev'), b.roomRev[i])) : '—'}</td><td class="n">${km(b.bfRev[i])} → <b>${x && g(x, 'bfRev') != null ? km(g(x, 'bfRev')) : '—'}</b></td><td class="n">${km(b.fbRev[i])} → <b>${x && g(x, 'restRev') != null ? km(g(x, 'restRev')) : '—'}</b></td><td class="n">${km(b.total[i])} → <b>${x ? km(tot) : '—'}</b></td><td class="n">${x ? P(pctOf(tot, b.total[i])) : '—'}</td><td class="n">${a.otbRn[i] ? `${fmtNum(a.otbRn[i])} · ${km(gross ? a.otbRevG[i] : a.otbRev[i])}` : '—'}</td></tr>`; }).join('')}
        <tr><td><b>Yıl</b></td><td class="n"><b>${fmtNum(Math.round(yr('rn')))}</b></td><td class="n"><b>${km(adrB(yr('roomRev'), yr('rn')))}</b></td><td></td><td class="n"><b>${km(yr('roomRev'))}</b></td><td></td><td class="n"><b>${km(yr('bfRev'))}</b></td><td class="n"><b>${km(yr('fbRev'))}</b></td><td class="n"><b>${km(yr('total'))}</b></td><td></td><td class="n"><b>${fmtNum(a.otbRn.reduce((s, v) => s + v, 0))}</b></td></tr></table></div></div>
      ${vers.length ? `<div class="card" style="margin-bottom:14px"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">Bütçe sürümleri</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">Her revizyonda önceki sürüm saklanır; istediğiniz sürümü Excel ya da PDF olarak indirebilirsiniz.</p></div>
        <div class="scroll-x"><table class="tb perf-t"><tr><th>Sürüm</th><th>Tarih · hazırlayan</th><th>Not</th><th class="n">Oda-gece</th><th class="n">Ortunç</th><th class="n">Elia</th><th class="n">Genel toplam (brüt)</th><th class="n">Öncekine göre</th><th></th></tr>
        ${vers.map((v, i) => { const tot = (h) => Array.from({ length: 12 }, (_, m) => monthTot(v.doc, h, y, m).total).reduce((s2, z) => s2 + z, 0); const rn = Object.keys(HOTELS).reduce((s2, h) => s2 + Array.from({ length: 12 }, (_, m) => monthTot(v.doc, h, y, m).rn).reduce((q, z) => q + z, 0), 0); const all = tot('ortunc') + tot('elia'); const prev = i ? (() => { const pv = vers[i - 1]; return Object.keys(HOTELS).reduce((s2, h) => s2 + Array.from({ length: 12 }, (_, m) => monthTot(pv.doc, h, y, m).total).reduce((q, z) => q + z, 0), 0); })() : null;
          return `<tr${v.current ? ' class="cur"' : ''}><td><b>${esc(v.label)}</b></td><td>${v.at ? esc(fmtDate(new Date(v.at).toISOString().slice(0, 10))) : ''}${v.by ? ` · ${esc(v.by)}` : ''}</td><td>${esc(v.note || '')}</td><td class="n">${fmtNum(Math.round(rn))}</td><td class="n">${km(tot('ortunc'))}</td><td class="n">${km(tot('elia'))}</td><td class="n"><b>${km(all)}</b></td><td class="n">${prev != null ? `${all >= prev ? '+' : '−'}${km(Math.abs(all - prev))}` : '—'}</td><td class="n" style="white-space:nowrap"><button class="btn sm" data-act="bVerX" data-i="${i}" title="Excel">${ic('table')}</button> <button class="btn sm" data-act="bVerP" data-i="${i}" title="PDF">${ic('printer')}</button></td></tr>`; }).join('')}</table></div></div>` : ''}
      <div class="card"><div class="pad" style="padding-bottom:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><h3 style="margin:0;flex:1">Satış ekibi · ${y}</h3><span class="muted" style="font-size:12.5px">Gelir ve oda-gece kesinleşme tarihine, talep kayıt tarihine, ziyaret aktivite tarihine göre</span></div>
        ${team.length ? (() => { const cm = ys === t.slice(0, 4) ? Number(t.slice(5, 7)) - 1 : -1; return `<div class="scroll-x"><table class="tb perf-t"><tr><th>Kişi</th>${TEAM_KEYS.map(([, l]) => `<th class="n">${esc(l)}<div class="sub">${cm >= 0 ? MONTHS[cm] : 'yıl'} · yıl</div></th>`).join('')}</tr>
          ${team.map((u) => { const tt = teamTarget(y, u.id); const aa = teamActual(u.id, y); return `<tr><td>${esc(u.name)}</td>${TEAM_KEYS.map(([k]) => { const fm = (v) => (k === 'rev' ? km(v) : fmtNum(v)); const mA = cm >= 0 ? aa[k][cm] : null; const mT = cm >= 0 ? tt[k][cm] : null; const yA = aa[k].reduce((s2, v) => s2 + v, 0); const yT = tt[k].reduce((s2, v) => s2 + v, 0); return `<td class="n">${mA == null ? '' : `${fm(mA)}${mT ? ` / ${fm(mT)}` : ''}`}<div class="sub">yıl ${fm(yA)}${yT ? ` / ${fm(yT)} · ${P(pctOf(yA, yT))}` : ''}</div>${yT ? bar(pctOf(yA, yT)) : ''}</td>`; }).join('')}</tr>`; }).join('')}</table></div>`; })() : '<div class="pad muted">Satış rolünde kullanıcı yok.</div>'}</div>
    </div>`;
  },
};
function chartBA(bud, act, otb) {
  const W = 760, H = 200, pb = 24, pt = 10, cw = W / 12; const max = Math.max(1, ...bud, ...act.map((v, i) => v + (otb[i] || 0)));
  const y = (v) => pt + (H - pt - pb) * (1 - v / max); let g = '';
  for (let i = 0; i <= 3; i++) { const yy = pt + ((H - pt - pb) * i) / 3; g += `<line x1="0" x2="${W}" y1="${yy}" y2="${yy}" stroke="#E2E7EF"/>`; }
  for (let i = 0; i < 12; i++) {
    const x = cw * i + cw / 2;
    g += `<rect x="${x - 16}" y="${y(bud[i])}" width="32" height="${H - pb - y(bud[i])}" fill="#DDE4EE" rx="2"><title>${MON3[i]} bütçe: ${km(bud[i])}</title></rect>`;
    g += `<rect x="${x - 8}" y="${y(act[i])}" width="16" height="${H - pb - y(act[i])}" fill="var(--primary)" rx="2"><title>${MON3[i]} gerçekleşen: ${km(act[i])}</title></rect>`;
    if (otb[i]) g += `<rect x="${x - 8}" y="${y(act[i] + otb[i])}" width="16" height="${y(act[i]) - y(act[i] + otb[i])}" fill="none" stroke="var(--primary)" stroke-dasharray="3 2" rx="2"><title>${MON3[i]} kesin rezervasyon: ${km(otb[i])}</title></rect>`;
    g += `<text x="${x}" y="${H - 7}" font-size="11" text-anchor="middle" fill="#69768D">${MON3[i]}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:220px" role="img" aria-label="Aylık bütçe ve gerçekleşen oda geliri">${g}</svg>`;
}

/* ---------- ekip hedefleri ---------- */
const gridModal = (title, intro, head, rows, foot) => {
  $('#modal').innerHTML = `<div class="ov center"><div class="modal" style="width:min(1040px,100%)"><div class="mh"><h2>${title}</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb">${intro}<div class="scroll-x"><table class="tb gridin"><tr>${head}</tr>${rows}</table></div><p class="err" id="geErr" role="alert"></p></div>
    <div class="mf">${foot}</div></div></div>`;
};
let TE = null;
A.teamEdit = (el) => {
  const y = S.goals.year; const key = (el && el.dataset && el.dataset.k) || (TE && TE.y === y ? TE.key : 'rev'); const users = salesUsers();
  if (!users.length) return toast('Satış rolünde kullanıcı yok.');
  TE = { y, key };
  gridModal(`${y} ekip hedefleri`, `<div class="acts" style="margin-bottom:10px">${TEAM_KEYS.map(([k, l]) => `<button class="chip ${k === key ? 'on' : ''}" data-act="teamEdit" data-k="${k}">${esc(l)}</button>`).join('')}</div><p class="muted" style="margin:0 0 8px;font-size:12.5px">Önce bu ölçüyü kaydedin, sonra diğerine geçin. Boş bırakılan ay hedefsiz sayılır.</p>`,
    `<th>Ay</th>${users.map((u) => `<th class="n">${esc(u.name)}</th>`).join('')}`,
    MONTHS.map((mn, i) => `<tr><td>${esc(mn)}</td>${users.map((u) => `<td><input class="inp n" inputmode="decimal" data-t="${u.id}.${i}" value="${teamTarget(y, u.id)[key][i] || ''}" aria-label="${esc(`${u.name} ${mn}`)}"></td>`).join('')}</tr>`).join('') + `<tr class="tot"><td><b>Toplam</b></td>${users.map((u) => `<td class="n" data-tt="${u.id}"></td>`).join('')}</tr>`,
    '<button class="btn" data-act="closeModal">Kapat</button><button class="btn pri" data-act="teamSave">Bu ölçüyü kaydet</button>');
  const totals = () => users.forEach((u) => { const s = $$(`[data-t^="${u.id}."]`).reduce((a, x) => a + num(x.value), 0); $(`[data-tt="${u.id}"]`).textContent = key === 'rev' ? money(s) : fmtNum(s); });
  $$('[data-t]').forEach((x) => x.addEventListener('input', totals)); totals();
};
A.teamSave = async (el) => {
  const t = tdoc(TE.y) || { id: String(TE.y), year: TE.y, v: 2, gross: true }; const team = JSON.parse(JSON.stringify(t.team || {}));
  salesUsers().forEach((u) => { team[u.id] = team[u.id] || {}; team[u.id][TE.key] = Array.from({ length: 12 }, (_, i) => num(($(`[data-t="${u.id}.${i}"]`) || {}).value)); });
  el.disabled = true;
  try { await S.store.save('targets', stamp({ ...t, team })); toast('Hedefler kaydedildi'); el.disabled = false; } catch (e) { $('#geErr').textContent = errText(e); el.disabled = false; }
};

/* ---------- çıktı ---------- */

A.goalsYear = (el) => { S.goals.year = Number(el.dataset.y); A._renderView(); };
A.goalsHotel = (el) => { S.goals.hotel = el.dataset.h; A._renderView(); };
A.goalsMode = (el) => { S.goals.mode = el.dataset.m; A._renderView(); };
A.bVerX = (el) => exportBudgetXlsx(S.goals.year, Number(el.dataset.i));
A.bVerP = (el) => printBudget(S.goals.year, Number(el.dataset.i));
A.goalsExcel = () => {
  const L = S.goalsLast; if (!L) return; const gross = L.gross; const g = (x, k) => (x ? x[gross ? { roomRev: 'roomRevG', bfRev: 'bfRevG', restRev: 'restRevG', adr: 'adrG', sadr: 'sadrG' }[k] || k : k] : null); const r0 = (v) => (v == null ? '' : Math.round(v));
  const rows = [[`${L.y} · ${gross ? 'brüt' : 'net'} ₺`, 'Bütçe oda-gece', 'Gerçek oda-gece', 'Bütçe oda ADR', 'Gerçek oda ADR', 'Gerçek satış ADR (oda+kahvaltı)', 'Bütçe oda geliri', 'Gerçek oda geliri', 'Bütçe kahvaltı', 'Gerçek kahvaltı', 'Bütçe restoran', 'Gerçek restoran', 'Bütçe toplam', 'Gerçek toplam', 'Kesin rez. oda-gece', 'Kesin rez. oda geliri']];
  MONTHS.forEach((mn, i) => { const x = L.a.months[i]; rows.push([mn, r0(L.b.rn[i]), x ? x.occ : '', r0(L.b.rn[i] ? L.b.roomRev[i] / L.b.rn[i] : null), r0(g(x, 'adr')), r0(g(x, 'sadr')), r0(L.b.roomRev[i]), r0(g(x, 'roomRev')), r0(L.b.bfRev[i]), r0(g(x, 'bfRev')), r0(L.b.fbRev[i]), r0(g(x, 'restRev')), r0(L.b.total[i]), x ? r0((g(x, 'roomRev') || 0) + (g(x, 'bfRev') || 0) + (g(x, 'restRev') || 0)) : '', L.a.otbRn[i], r0(gross ? L.a.otbRevG[i] : L.a.otbRev[i])]); });
  const team = [['Kişi', 'Ay', ...TEAM_KEYS.flatMap(([, l]) => [`${l} hedef`, `${l} gerçek`])]];
  salesUsers().forEach((u) => { const tt = teamTarget(L.y, u.id); const aa = teamActual(u.id, L.y); MONTHS.forEach((mn, i) => team.push([u.name, mn, ...TEAM_KEYS.flatMap(([k]) => [tt[k][i], Math.round(aa[k][i])])])); });
  const wb = XLSX.utils.book_new(); const w1 = XLSX.utils.aoa_to_sheet(rows); w1['!cols'] = rows[0].map(() => ({ wch: 16 })); XLSX.utils.book_append_sheet(wb, w1, 'Bütçe ve gerçekleşen'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(team), 'Ekip hedefleri');
  saveFile(`Hedefler-${L.y}-${today()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
};
A.goalsPrint = () => {
  const body = $('#body .perf'); if (!body) return;
  const c = body.cloneNode(true); c.querySelectorAll('.perfbar,.banner button,[data-act=bVerX],[data-act=bVerP]').forEach((x) => x.remove());
  printHtml(`Hedefler-${S.goals.year}`, `<div class="pdoc"><div class="ph"><b>${esc(S.settings.hotelName)}</b><span>${esc(fmtDate(today()))} · ${esc(S.user.name)}</span></div><h1>Hedefler & bütçe · ${S.goals.year} · ${esc(S.goals.hotel === 'all' ? 'Ortunç + Elia' : HOTELS[S.goals.hotel])} · ${S.goals.mode === 'net' ? 'net' : 'brüt'}</h1>${c.innerHTML}</div>`, '@page{size:A4 landscape;margin:9mm}', true);
};

/* ---------- pano kartı ---------- */
A._goalsWidget = () => {
  const y = Number(today().slice(0, 4)); if (!tdoc(y)) return '';
  const hs = Object.keys(HOTELS); const t = today(); const d = new Date(t + 'T12:00:00'); d.setDate(d.getDate() - 1); const upto = d.toISOString().slice(0, 10);
  const bm = budgetRange(y, hs, upto.slice(0, 8) + '01', upto, false); const by = budgetRange(y, hs, `${y}-01-01`, upto, false);
  const am = sumRows((S.perf.daily || []).filter((x) => x.date >= upto.slice(0, 8) + '01' && x.date <= upto)); const ay = sumRows((S.perf.daily || []).filter((x) => x.date >= `${y}-01-01` && x.date <= upto));
  const p = pctOf(am.roomRevG, bm && bm.roomRev); const yp = pctOf(ay.roomRevG, by && by.roomRev);
  return `<div class="card pad"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><h3 style="margin:0;flex:1">Bütçe · ${y} · oda geliri (brüt)</h3><button class="btn sm" data-act="nav" data-v="goals">${ic('target')} Hedefler</button></div>
    <div class="bars"><div class="bar"><span>${MONTHS[Number(upto.slice(5, 7)) - 1]} (bugüne kadar)</span>${bar(p)}<span class="v">${P(p)}</span></div><div class="bar"><span>Yıl (bugüne kadar)</span>${bar(yp)}<span class="v">${P(yp)}</span></div></div></div>`;
};
