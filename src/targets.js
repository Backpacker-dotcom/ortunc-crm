// Hedefler & bütçe: otel bütçesi (aylık oda-gece, oda ve yiyecek-içecek geliri) ve satış ekibi hedefleri; gerçekleşenle karşılaştırma
import * as XLSX from 'xlsx';
import { S, A, V, $, $$, esc, ic, today, fmtNum, money, num, MON3, MONTHS, toast, can, sortBy, taxCfg, recMetrics, errText, closeModal, stamp, confirmBox } from './core.js';
import { printHtml, saveFile } from './print.js';
import { HOTELS } from './perf.js';

const M12 = () => Array(12).fill(0);
const KEYS = [['rn', 'Oda-gece'], ['roomRev', 'Oda geliri'], ['fbRev', 'Yiyecek-içecek']];
export const TEAM_KEYS = [['rev', 'Kesinleşen gelir (₺, vergisiz)'], ['rn', 'Kesinleşen oda-gece'], ['opps', 'Yeni talep'], ['visits', 'Satış ziyareti']];
// Ufuk'un 2027 bütçe sunumundaki rakamlar (brüt ₺)
const SEED_2027 = {
  gross: true,
  hotels: {
    ortunc: { rn: [70, 105, 245, 275, 500, 625, 985, 1025, 700, 200, 0, 0], roomRev: [721000, 1102500, 2609250, 2818750, 8800000, 14365625, 39400000, 45868750, 20125000, 3300000, 0, 0], fbRev: [860500, 1324500, 3778000, 3397500, 7640000, 9912500, 20347500, 23150000, 12950000, 1817500, 0, 0] },
    elia: { rn: [40, 40, 80, 80, 250, 200, 310, 420, 250, 80, 40, 40], roomRev: [180000, 180000, 500000, 500000, 1812500, 1600000, 2945000, 5019000, 2062500, 500000, 220000, 220000], fbRev: M12() },
  },
};

const tdoc = (y) => (S.data.targets || []).find((t) => t.id === String(y)) || null;
const hb = (t, h) => { const x = (t && t.hotels && t.hotels[h]) || {}; return { rn: x.rn || M12(), roomRev: x.roomRev || M12(), fbRev: x.fbRev || M12() }; };
// bütçeyi net'e çevir (brüt girildiyse): oda = KDV + konaklama vergisi, Y-İ = KDV
const netF = (t) => { if (!t || !t.gross) return { room: 1, fb: 1 }; const c = taxCfg(); return { room: (1 + c.kv / 100) * (1 + c.kdv / 100), fb: 1 + c.kdv / 100 }; };
export function budget(y, hs) {
  const t = tdoc(y); const f = netF(t);
  const out = { rn: M12(), roomRev: M12(), fbRev: M12(), set: !!t };
  hs.forEach((h) => { const b = hb(t, h); for (let i = 0; i < 12; i++) { out.rn[i] += num(b.rn[i]); out.roomRev[i] += num(b.roomRev[i]) / f.room; out.fbRev[i] += num(b.fbRev[i]) / f.fb; } });
  return out;
}
function actual(y, hs) {
  const o = { rn: M12(), roomRev: M12(), fbRev: M12(), totalRev: M12(), days: M12(), otbRn: M12(), otbRev: M12() };
  (S.perf.daily || []).forEach((r) => { if (!hs.includes(r.hotel) || !r.date.startsWith(String(y))) return; const m = Number(r.date.slice(5, 7)) - 1; o.rn[m] += r.occ || 0; o.roomRev[m] += r.roomRev || 0; o.fbRev[m] += r.fbRev || 0; o.totalRev[m] += r.totalRev || 0; o.days[m]++; });
  const t = today(); (S.perf.otb || []).forEach((r) => { if (!hs.includes(r.hotel) || !r.date.startsWith(String(y)) || r.date < t) return; const m = Number(r.date.slice(5, 7)) - 1; o.otbRn[m] += r.rooms || 0; o.otbRev[m] += r.roomRev || 0; });
  return o;
}
const pctOf = (a, b) => (b ? (a / b) * 100 : null);
const P = (v) => (v == null ? '—' : `%${Math.round(v)}`);
const km = (v) => (v == null ? '—' : Math.abs(v) >= 1e6 ? `₺${(v / 1e6).toFixed(2).replace('.', ',')} mn` : money(Math.round(v)));
const bar = (p) => `<div class="pbar" title="${p == null ? '' : '%' + Math.round(p)}"><i style="width:${Math.max(0, Math.min(100, p || 0))}%;background:${p == null ? '#CBD5E2' : p >= 100 ? '#4F6B2E' : p >= 80 ? 'var(--primary)' : '#C98A1B'}"></i></div>`;

/* ---------- satış ekibi gerçekleşen ---------- */
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
S.goals = S.goals || { year: Number(today().slice(0, 4)), hotel: 'all' };
V.goals = {
  title: () => 'Hedefler & bütçe',
  head: () => `${can.admin() ? `<button class="btn" data-act="budgetEdit">${ic('pencil')}<span class="hide-m"> Otel bütçesi</span></button><button class="btn" data-act="teamEdit">${ic('target')}<span class="hide-m"> Ekip hedefleri</span></button>` : ''}<button class="btn" data-act="goalsExcel">${ic('table')}<span class="hide-m"> Excel</span></button><button class="btn" data-act="goalsPrint">${ic('printer')}<span class="hide-m"> PDF</span></button>`,
  body: () => {
    if (A._loadPerf) A._loadPerf();
    const G = S.goals; const y = G.year; const hs = G.hotel === 'all' ? Object.keys(HOTELS) : [G.hotel];
    const b = budget(y, hs); const a = actual(y, hs); const ly = actual(y - 1, hs); const t = today(); const cm = String(y) === t.slice(0, 4) ? Number(t.slice(5, 7)) - 1 : String(y) < t.slice(0, 4) ? 12 : -1;
    const sumTo = (arr, n) => arr.slice(0, Math.max(0, n)).reduce((s, v) => s + v, 0);
    // bugüne kadar: tamamlanan aylar + içinde bulunulan ayın gerçekleşeni; bütçe tarafında içinde bulunulan ay gün oranıyla
    const dim = (m) => new Date(y, m + 1, 0).getDate(); const frac = cm >= 0 && cm < 12 ? Number(t.slice(8, 10)) / dim(cm) : 0;
    const ytdB = (k) => sumTo(b[k], cm) + (cm >= 0 && cm < 12 ? b[k][cm] * frac : 0); const ytdA = (k) => sumTo(a[k], Math.min(12, cm + 1));
    const yr = (k) => b[k].reduce((s, v) => s + v, 0);
    const adr = (rev, rn) => (rn ? rev / rn : null);
    S.goalsLast = { y, hs, b, a, ly };
    const yearOpts = [y - 2, y - 1, y, y + 1, y + 2].filter((v, i, arr) => arr.indexOf(v) === i);
    const team = salesUsers();
    return `<div class="perf">
      <div class="perfbar"><div class="seg" role="group" aria-label="Yıl">${yearOpts.map((v) => `<button class="${v === y ? 'on' : ''}" data-act="goalsYear" data-y="${v}" aria-pressed="${v === y}">${v}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Otel">${[['all', 'İki otel'], ...Object.entries(HOTELS)].map(([k, l]) => `<button class="${G.hotel === k ? 'on' : ''}" data-act="goalsHotel" data-h="${k}" aria-pressed="${G.hotel === k}">${esc(l)}</button>`).join('')}</div></div>
      ${!b.set ? `<div class="banner">${ic('target')}<span><b>${y} için otel bütçesi girilmedi.</b> ${can.admin() ? 'Sağ üstteki "Otel bütçesi" ile aylık oda-gece ve gelir hedeflerini girin.' : 'Yönetici bütçeyi girdiğinde gerçekleşme burada görünür.'}</span>${can.admin() && y === 2027 ? '<button class="btn sm" data-act="budgetSeed">2027 bütçe sunumundaki rakamları yükle</button>' : ''}</div>` : ''}
      <div class="kband">
        ${[['roomRev', 'Oda geliri'], ['rn', 'Oda-gece'], ['fbRev', 'Yiyecek-içecek']].map(([k, l]) => { const p = pctOf(ytdA(k), ytdB(k)); return `<div class="kb"><small>${l} · bugüne kadar</small><b>${k === 'rn' ? fmtNum(ytdA(k)) : km(ytdA(k))}</b><em>${b.set ? `bütçe ${k === 'rn' ? fmtNum(Math.round(ytdB(k))) : km(ytdB(k))} · ${P(p)}` : 'bütçe yok'}</em>${bar(p)}</div>`; }).join('')}
        <div class="kb"><small>ADR · bugüne kadar</small><b>${km(adr(ytdA('roomRev'), ytdA('rn')))}</b><em>${b.set ? `bütçe ${km(adr(ytdB('roomRev'), ytdB('rn')))}` : 'bütçe yok'}</em></div>
        <div class="kb"><small>Yıl bütçesi · oda geliri</small><b>${b.set ? km(yr('roomRev')) : '—'}</b><em>${b.set ? `${fmtNum(yr('rn'))} oda-gece · ADR ${km(adr(yr('roomRev'), yr('rn')))}` : ''}</em>${b.set ? bar(pctOf(sumTo(a.roomRev, 12), yr('roomRev'))) : ''}<span class="kfoot">${b.set ? `yılın ${P(pctOf(sumTo(a.roomRev, 12), yr('roomRev')))} gerçekleşti` : ''}</span></div>
        <div class="kb"><small>Gelecek aylar · kesin rezervasyon</small><b>${km(a.otbRev.reduce((s, v) => s + v, 0))}</b><em>${fmtNum(a.otbRn.reduce((s, v) => s + v, 0))} oda-gece (rapordaki ileri tarihler)</em></div>
      </div>
      <div class="card" style="margin-bottom:14px"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">${y} aylık · bütçe ve gerçekleşen</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">Tutarlar vergiler hariç (net) ₺.${tdoc(y) && tdoc(y).gross ? ` Bütçe brüt girildi; oda gelirinde KDV %${taxCfg().kdv} ve konaklama vergisi %${taxCfg().kv}, yiyecek-içecekte KDV %${taxCfg().kdv} düşülerek net'e çevrildi.` : ''} Gerçekleşen, işlenen gece raporlarından gelir.</p></div>
        <div class="pad" style="padding-top:6px">${chartBA(b.roomRev, a.roomRev, a.otbRev)}<p class="muted" style="font-size:12px;margin:2px 0 8px">Oda geliri · açık gri: bütçe · koyu: gerçekleşen · kesikli: ileri tarihli kesin rezervasyon</p></div>
        <div class="scroll-x"><table class="tb perf-t"><tr><th>Ay</th><th class="n">Oda-gece<div class="sub">bütçe → gerçek</div></th><th class="n">%</th><th class="n">ADR<div class="sub">bütçe → gerçek</div></th><th class="n">Oda geliri<div class="sub">bütçe → gerçek</div></th><th class="n">%</th><th class="n">Y-İ geliri<div class="sub">bütçe → gerçek</div></th><th class="n">${y - 1} oda geliri</th><th class="n">Kesin rez.<div class="sub">oda-gece · gelir</div></th></tr>
        ${MONTHS.map((mn, i) => `<tr class="${i === cm ? 'cur' : ''}"><td>${esc(mn)}</td><td class="n">${fmtNum(Math.round(b.rn[i]))} → <b>${a.days[i] ? fmtNum(a.rn[i]) : '—'}</b></td><td class="n">${a.days[i] ? P(pctOf(a.rn[i], b.rn[i])) : '—'}</td><td class="n">${km(adr(b.roomRev[i], b.rn[i]))} → <b>${a.days[i] ? km(adr(a.roomRev[i], a.rn[i])) : '—'}</b></td><td class="n">${km(b.roomRev[i])} → <b>${a.days[i] ? km(a.roomRev[i]) : '—'}</b></td><td class="n">${a.days[i] ? P(pctOf(a.roomRev[i], b.roomRev[i])) : '—'}</td><td class="n">${km(b.fbRev[i])} → <b>${a.days[i] ? km(a.fbRev[i]) : '—'}</b></td><td class="n">${ly.days[i] ? km(ly.roomRev[i]) : '—'}</td><td class="n">${a.otbRn[i] ? `${fmtNum(a.otbRn[i])} · ${km(a.otbRev[i])}` : '—'}</td></tr>`).join('')}
        <tr><td><b>Yıl</b></td><td class="n"><b>${fmtNum(Math.round(yr('rn')))} → ${fmtNum(sumTo(a.rn, 12))}</b></td><td class="n"><b>${P(pctOf(sumTo(a.rn, 12), yr('rn')))}</b></td><td class="n"><b>${km(adr(yr('roomRev'), yr('rn')))} → ${km(adr(sumTo(a.roomRev, 12), sumTo(a.rn, 12)))}</b></td><td class="n"><b>${km(yr('roomRev'))} → ${km(sumTo(a.roomRev, 12))}</b></td><td class="n"><b>${P(pctOf(sumTo(a.roomRev, 12), yr('roomRev')))}</b></td><td class="n"><b>${km(yr('fbRev'))} → ${km(sumTo(a.fbRev, 12))}</b></td><td class="n"><b>${km(sumTo(ly.roomRev, 12))}</b></td><td class="n"><b>${fmtNum(a.otbRn.reduce((s, v) => s + v, 0))}</b></td></tr></table></div></div>
      <div class="card"><div class="pad" style="padding-bottom:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><h3 style="margin:0;flex:1">Satış ekibi · ${y}</h3><span class="muted" style="font-size:12.5px">Gelir ve oda-gece kesinleşme tarihine, talep kayıt tarihine, ziyaret aktivite tarihine göre</span></div>
        ${team.length ? `<div class="scroll-x"><table class="tb perf-t"><tr><th>Kişi</th>${TEAM_KEYS.map(([, l]) => `<th class="n">${esc(l)}<div class="sub">${cm >= 0 && cm < 12 ? MONTHS[cm] : 'yıl'} · yıl</div></th>`).join('')}</tr>
          ${team.map((u) => { const tt = teamTarget(y, u.id); const aa = teamActual(u.id, y); return `<tr><td>${esc(u.name)}</td>${TEAM_KEYS.map(([k]) => { const fm = (v) => (k === 'rev' ? km(v) : fmtNum(v)); const mA = cm >= 0 && cm < 12 ? aa[k][cm] : null; const mT = cm >= 0 && cm < 12 ? tt[k][cm] : null; const yA = aa[k].reduce((s, v) => s + v, 0); const yT = tt[k].reduce((s, v) => s + v, 0); return `<td class="n">${mA == null ? '' : `${fm(mA)}${mT ? ` / ${fm(mT)}` : ''}`}<div class="sub">yıl ${fm(yA)}${yT ? ` / ${fm(yT)} · ${P(pctOf(yA, yT))}` : ''}</div>${yT ? bar(pctOf(yA, yT)) : ''}</td>`; }).join('')}</tr>`; }).join('')}</table></div>` : '<div class="pad muted">Satış rolünde kullanıcı yok.</div>'}</div>
    </div>`;
  },
};
function chartBA(bud, act, otb) {
  const W = 760, H = 200, pb = 24, pt = 10, cw = W / 12; const max = Math.max(1, ...bud, ...act.map((v, i) => v + otb[i]));
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
A.goalsYear = (el) => { S.goals.year = Number(el.dataset.y); A._renderView(); };
A.goalsHotel = (el) => { S.goals.hotel = el.dataset.h; A._renderView(); };

/* ---------- bütçe düzenleyici ---------- */
let BE = null;
const gridModal = (title, intro, head, rows, foot) => {
  $('#modal').innerHTML = `<div class="ov center"><div class="modal" style="width:min(1040px,100%)"><div class="mh"><h2>${title}</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb">${intro}<div class="scroll-x"><table class="tb gridin"><tr>${head}</tr>${rows}</table></div><p class="err" id="geErr" role="alert"></p></div>
    <div class="mf">${foot}</div></div></div>`;
};
A.budgetEdit = () => {
  const y = S.goals.year; const t = tdoc(y);
  BE = { y, gross: t ? !!t.gross : true, hotels: Object.fromEntries(Object.keys(HOTELS).map((h) => [h, hb(t, h)])) };
  const cols = Object.keys(HOTELS).flatMap((h) => KEYS.map(([k, l]) => [h, k, `${HOTELS[h]}<div class="sub">${l}</div>`]));
  gridModal(`${y} otel bütçesi`, `<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><label class="perfdate">Tutarlar <select class="inp" id="beGross"><option value="1" ${BE.gross ? 'selected' : ''}>Brüt (KDV ve konaklama vergisi dahil)</option><option value="0" ${BE.gross ? '' : 'selected'}>Net (vergiler hariç)</option></select></label><span class="muted" style="font-size:12.5px">Karşılaştırmalarda brüt bütçe net'e çevrilir. Hücreler arasında Tab ile geçebilirsiniz.</span></div>`,
    `<th>Ay</th>${cols.map(([, , l]) => `<th class="n">${l}</th>`).join('')}`,
    MONTHS.map((mn, i) => `<tr><td>${esc(mn)}</td>${cols.map(([h, k]) => `<td><input class="inp n" inputmode="decimal" data-g="${h}.${k}.${i}" value="${BE.hotels[h][k][i] || ''}" aria-label="${esc(`${HOTELS[h]} ${mn} ${k}`)}"></td>`).join('')}</tr>`).join('') + `<tr class="tot"><td><b>Toplam</b></td>${cols.map(([h, k]) => `<td class="n" data-gt="${h}.${k}"></td>`).join('')}</tr>`,
    `${t ? '<button class="btn danger sp" data-act="budgetDel">Bütçeyi sil</button>' : ''}${y === 2027 ? '<button class="btn" data-act="budgetSeed">Sunumdaki 2027 rakamlarını doldur</button>' : ''}<button class="btn" data-act="closeModal">Vazgeç</button><button class="btn pri" data-act="budgetSave">Kaydet</button>`);
  const totals = () => cols.forEach(([h, k]) => { const s = $$(`[data-g^="${h}.${k}."]`).reduce((a, el) => a + num(el.value), 0); $(`[data-gt="${h}.${k}"]`).textContent = k === 'rn' ? fmtNum(s) : money(s); });
  $$('[data-g]').forEach((el) => el.addEventListener('input', totals)); totals();
};
A.budgetSeed = async () => {
  if ($('#beGross')) { Object.entries(SEED_2027.hotels).forEach(([h, o]) => KEYS.forEach(([k]) => o[k].forEach((v, i) => { const el = $(`[data-g="${h}.${k}.${i}"]`); if (el) { el.value = v || ''; el.dispatchEvent(new Event('input')); } }))); $('#beGross').value = '1'; toast('2027 sunum rakamları dolduruldu; kontrol edip kaydedin'); return; }
  try { await S.store.save('targets', stamp({ id: '2027', year: 2027, ...JSON.parse(JSON.stringify(SEED_2027)), team: (tdoc(2027) || {}).team || {} })); toast('2027 bütçesi yüklendi'); } catch (e) { toast(errText(e)); }
};
A.budgetSave = async (el) => {
  const hotels = {}; Object.keys(HOTELS).forEach((h) => { hotels[h] = {}; KEYS.forEach(([k]) => { hotels[h][k] = Array.from({ length: 12 }, (_, i) => num(($(`[data-g="${h}.${k}.${i}"]`) || {}).value)); }); });
  el.disabled = true;
  try { const t = tdoc(BE.y) || {}; await S.store.save('targets', stamp({ ...t, id: String(BE.y), year: BE.y, gross: $('#beGross').value === '1', hotels })); toast('Bütçe kaydedildi'); closeModal(); } catch (e) { $('#geErr').textContent = errText(e); el.disabled = false; }
};
A.budgetDel = () => { const t = tdoc(BE.y); if (!t) return; confirmBox(`${BE.y} bütçesi ve ekip hedefleri silinecek.`, 'Sil', async () => { await S.store.remove('targets', t.id); toast('Silindi'); closeModal(); }); };

/* ---------- ekip hedefleri ---------- */
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
  const t = tdoc(TE.y) || { id: String(TE.y), year: TE.y, gross: true, hotels: {} }; const team = JSON.parse(JSON.stringify(t.team || {}));
  salesUsers().forEach((u) => { team[u.id] = team[u.id] || {}; team[u.id][TE.key] = Array.from({ length: 12 }, (_, i) => num(($(`[data-t="${u.id}.${i}"]`) || {}).value)); });
  el.disabled = true;
  try { await S.store.save('targets', stamp({ ...t, team })); toast('Hedefler kaydedildi'); el.disabled = false; } catch (e) { $('#geErr').textContent = errText(e); el.disabled = false; }
};

/* ---------- çıktı ---------- */
A.goalsExcel = () => {
  const L = S.goalsLast; if (!L) return;
  const rows = [['Ay', 'Bütçe oda-gece', 'Gerçek oda-gece', 'Bütçe oda geliri (net)', 'Gerçek oda geliri', 'Bütçe Y-İ (net)', 'Gerçek Y-İ', `${L.y - 1} oda geliri`, 'Kesin rez. oda-gece', 'Kesin rez. oda geliri']];
  MONTHS.forEach((mn, i) => rows.push([mn, Math.round(L.b.rn[i]), L.a.rn[i], Math.round(L.b.roomRev[i]), Math.round(L.a.roomRev[i]), Math.round(L.b.fbRev[i]), Math.round(L.a.fbRev[i]), Math.round(L.ly.roomRev[i]), L.a.otbRn[i], Math.round(L.a.otbRev[i])]));
  const team = [['Kişi', 'Ay', ...TEAM_KEYS.flatMap(([, l]) => [`${l} hedef`, `${l} gerçek`])]];
  salesUsers().forEach((u) => { const tt = teamTarget(L.y, u.id); const aa = teamActual(u.id, L.y); MONTHS.forEach((mn, i) => team.push([u.name, mn, ...TEAM_KEYS.flatMap(([k]) => [tt[k][i], Math.round(aa[k][i])])])); });
  const wb = XLSX.utils.book_new(); const w1 = XLSX.utils.aoa_to_sheet(rows); w1['!cols'] = rows[0].map(() => ({ wch: 18 })); XLSX.utils.book_append_sheet(wb, w1, 'Otel bütçesi'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(team), 'Ekip hedefleri');
  saveFile(`Hedefler-${L.y}-${today()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
};
A.goalsPrint = () => {
  const body = $('#body .perf'); if (!body) return;
  const c = body.cloneNode(true); c.querySelectorAll('.perfbar,.banner button').forEach((x) => x.remove());
  printHtml(`Hedefler-${S.goals.year}`, `<div class="pdoc"><div class="ph"><b>${esc(S.settings.hotelName)}</b><span>${esc(today().split('-').reverse().join('.'))} · ${esc(S.user.name)}</span></div><h1>Hedefler & bütçe · ${S.goals.year} · ${esc(S.goals.hotel === 'all' ? 'Ortunç + Elia' : HOTELS[S.goals.hotel])}</h1>${c.innerHTML}</div>`, '', true);
};

/* ---------- pano kartı ---------- */
A._goalsWidget = () => {
  const y = Number(today().slice(0, 4)); if (!tdoc(y)) return '';
  const hs = Object.keys(HOTELS); const b = budget(y, hs); const a = actual(y, hs); const m = Number(today().slice(5, 7)) - 1;
  const p = pctOf(a.roomRev[m], b.roomRev[m]); const yp = pctOf(a.roomRev.slice(0, m + 1).reduce((s, v) => s + v, 0), b.roomRev.slice(0, m + 1).reduce((s, v) => s + v, 0));
  return `<div class="card pad"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><h3 style="margin:0;flex:1">Bütçe · ${y}</h3><button class="btn sm" data-act="nav" data-v="goals">${ic('target')} Hedefler</button></div>
    <div class="bars"><div class="bar"><span>${MONTHS[m]} oda geliri</span>${bar(p)}<span class="v">${P(p)}</span></div><div class="bar"><span>Yıl (bu aya kadar)</span>${bar(yp)}<span class="v">${P(yp)}</span></div></div></div>`;
};
