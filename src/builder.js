// Rapor oluşturucu: veri seti + tarih + filtre + gruplama + ölçüler + karşılaştırma + grafik + Excel/PDF + kayıtlı raporlar
import * as XLSX from 'xlsx';
import {
  S, A, V, $, $$, esc, ic, today, iso, addDays, fmtDate, fmtNum, money, num, MON3, MONTHS, byId, userName, stageLabel, OPP_STAGES, WED_STAGES, OPP_KINDS,
  ACC_TYPES, ACC_STATUS, ACT_TYPES, recMetrics, recTotals, recCalc, deptOf, DEPT_LABEL, toast, errText, stamp, can, confirmBox, sortBy, CUR_SYM,
} from './core.js';
import { printHtml, saveFile } from './print.js';

const tsIso = (t) => (t ? iso(new Date(t)) : '');
const cfDims = (col) => ((S.settings.customFields || {})[col] || []).filter((f) => f.type !== 'number' && f.type !== 'textarea' && f.type !== 'date').map((f) => [f.key, f.label]);
const cfNums = (col) => ((S.settings.customFields || {})[col] || []).filter((f) => f.type === 'number').map((f) => [f.key, f.label]);
const cfVals = (col, r) => Object.fromEntries(((S.settings.customFields || {})[col] || []).map((f) => [f.key, f.type === 'number' ? num(r[f.key]) : (r[f.key] ?? '')]));

/* ---------- veri setleri ---------- */
// m: { anahtar: [etiket, tür] } tür: 'n' sayı, 'm' para (para birimine göre), 'p' oran, 'd' türetilmiş
const money3 = { gross: ['Toplam (vergiler dahil)', 'm'], net: ['Gelir (vergiler hariç)', 'm'], oda: ['Oda geliri', 'm'], yi: ['Yiyecek-içecek geliri', 'm'], salon: ['Salon / MICE geliri', 'm'], diger: ['Diğer gelir', 'm'] };
function salesRow(col, r) {
  const m = recMetrics(col, r); const g = recTotals(col, r);
  const acc = col === 'opps' ? byId('accounts', r.accountId) : null;
  return {
    dates: col === 'opps' ? { event: r.start, created: tsIso(r.createdAt), stage: tsIso(r.stageAt || r.updatedAt) } : { event: r.date, created: tsIso(r.createdAt), stage: tsIso(r.stageAt || r.updatedAt) },
    dims: {
      stage: stageLabel(col === 'opps' ? OPP_STAGES : WED_STAGES, r.stage), result: r.stage === (col === 'opps' ? 'kazanildi' : 'sozlesme') ? 'Kesinleşti' : r.stage === 'kaybedildi' ? 'Kaybedildi' : 'Açık',
      kind: col === 'opps' ? OPP_KINDS[r.kind] || '' : r.eventType || 'Düğün', segment: r.segment || '', channel: r.channel || '', source: r.source || '', owner: userName(r.ownerId),
      account: acc ? acc.name : '', accType: acc ? ACC_TYPES[acc.type] || '' : '', property: col === 'opps' ? r.property || '' : r.venue || '', lossReason: r.stage === 'kaybedildi' ? (r.lossReason || 'Belirtilmemiş') : '',
      rev: (r.revisions || []).length ? 'Revize edildi' : 'Revizesiz', ...cfVals(col, r),
    },
    amt: { gross: g, net: m.net, oda: m.dept.oda || {}, yi: m.dept.yi || {}, salon: m.dept.salon || {}, diger: m.dept.diger || {} },
    n: { count: 1, won: r.stage === (col === 'opps' ? 'kazanildi' : 'sozlesme') ? 1 : 0, lost: r.stage === 'kaybedildi' ? 1 : 0, rn: m.roomNights || 0, pax: num(col === 'opps' ? r.pax : r.guests), ...Object.fromEntries(cfNums(col).map(([k]) => [k, num(r[k])])) },
    ref: { col, id: r.id, title: col === 'opps' ? r.title : r.couple },
  };
}
const SALES_METRICS = (col) => ({ count: ['Kayıt sayısı', 'n'], won: ['Kesinleşen', 'n'], winRate: ['Kazanma oranı', 'p'], ...money3, rn: ['Oda-gece', 'n'], adr: ['ADR (vergisiz)', 'd'], pax: [col === 'opps' ? 'Kişi' : 'Davetli', 'n'], avg: ['Ortalama tutar (vergisiz)', 'd'], ...Object.fromEntries(cfNums(col).map(([k, l]) => [k, [l, 'n']])) });
const SALES_DIMS = (col) => [['stage', 'Aşama'], ['result', 'Sonuç'], ['kind', col === 'opps' ? 'Talep türü' : 'Organizasyon'], ['segment', 'Pazar segmenti'], ['channel', 'Satış kanalı'], ['source', 'Kaynak'], ['owner', 'Sorumlu'], ...(col === 'opps' ? [['account', 'Acente / firma'], ['accType', 'Acente türü']] : []), ['property', col === 'opps' ? 'Tesis' : 'Mekân'], ['lossReason', 'Kayıp nedeni'], ['rev', 'Revizyon durumu'], ...cfDims(col)];
export const DS = {
  opps: { label: 'Grup & etkinlik talepleri', dates: [['event', 'Etkinlik tarihi'], ['created', 'Kayıt tarihi'], ['stage', 'Son aşama değişikliği']], dims: () => SALES_DIMS('opps'), metrics: () => SALES_METRICS('opps'), rows: () => S.data.opps.map((r) => salesRow('opps', r)) },
  weddings: { label: 'Düğün teklifleri', dates: [['event', 'Düğün tarihi'], ['created', 'Kayıt tarihi'], ['stage', 'Son aşama değişikliği']], dims: () => SALES_DIMS('weddings'), metrics: () => SALES_METRICS('weddings'), rows: () => S.data.weddings.map((r) => salesRow('weddings', r)) },
  items: {
    label: 'Teklif kalemleri (departman)', dates: [['event', 'Etkinlik / düğün tarihi']],
    dims: () => [['dept', 'Departman'], ['name', 'Kalem'], ['src', 'Kayıt türü'], ['result', 'Sonuç'], ['segment', 'Pazar segmenti'], ['owner', 'Sorumlu']],
    metrics: () => ({ qty: ['Miktar', 'n'], net: ['Tutar (vergiler hariç)', 'm'], gross: ['Tutar (vergiler dahil)', 'm'], count: ['Satır sayısı', 'n'] }),
    rows: () => [['opps', 'Grup & etkinlik'], ['weddings', 'Düğün']].flatMap(([col, src]) => S.data[col].flatMap((r) => recCalc(col, r).lines.map((l) => ({
      dates: { event: col === 'opps' ? r.start : r.date }, dims: { dept: DEPT_LABEL[deptOf(l)], name: l.name, src, result: r.stage === (col === 'opps' ? 'kazanildi' : 'sozlesme') ? 'Kesinleşti' : r.stage === 'kaybedildi' ? 'Kaybedildi' : 'Açık', segment: r.segment || '', owner: userName(r.ownerId) },
      amt: { net: { [l.cur]: l.net }, gross: { [l.cur]: l.gross } }, n: { qty: l.qty, count: 1 }, ref: { col, id: r.id, title: col === 'opps' ? r.title : r.couple },
    })))),
  },
  accounts: {
    label: 'Acenteler & firmalar', dates: [['created', 'Kayıt tarihi'], ['contractEnd', 'Kontrat bitişi']],
    dims: () => [['type', 'Tür'], ['status', 'Durum'], ['segment', 'Pazar segmenti'], ['channel', 'Satış kanalı'], ['city', 'Şehir'], ['country', 'Ülke'], ['market', 'Pazar (bölge)'], ['owner', 'Sorumlu'], ...cfDims('accounts')],
    metrics: () => ({ count: ['Kayıt sayısı', 'n'], acts: ['Aktivite sayısı', 'n'], opps: ['Talep sayısı', 'n'], won: ['Kesinleşen talep', 'n'], wonNet: ['Kesinleşen gelir (vergisiz)', 'm'], rn: ['Kesinleşen oda-gece', 'n'] }),
    rows: () => S.data.accounts.map((a) => { const os = S.data.opps.filter((o) => o.accountId === a.id); const ws = os.filter((o) => o.stage === 'kazanildi'); const wn = {}; let rn = 0; ws.forEach((o) => { const m = recMetrics('opps', o); Object.entries(m.net).forEach(([k, v]) => { wn[k] = (wn[k] || 0) + v; }); rn += m.roomNights || 0; });
      return { dates: { created: tsIso(a.createdAt), contractEnd: a.contractEnd }, dims: { type: ACC_TYPES[a.type] || '', status: ACC_STATUS[a.status] || '', segment: a.segment || '', channel: a.channel || '', city: a.city || '', country: a.country || '', market: a.market || '', owner: userName(a.ownerId), ...cfVals('accounts', a) },
        amt: { wonNet: wn }, n: { count: 1, acts: S.data.activities.filter((x) => x.ref && x.ref.id === a.id).length, opps: os.length, won: ws.length, rn }, ref: { col: 'accounts', id: a.id, title: a.name } }; }),
  },
  stays: {
    label: 'Konaklamalar (misafir geçmişi)', dates: [['checkIn', 'Giriş tarihi']],
    dims: () => [['property', 'Tesis'], ['country', 'Ülke'], ['city', 'Şehir'], ['repeat', 'Misafir tipi'], ['vip', 'VIP'], ['note', 'Not / kanal']],
    metrics: () => ({ count: ['Konaklama sayısı', 'n'], nights: ['Gece', 'n'], guests: ['Farklı misafir', 'n'], amount: ['Tutar', 'm'] }),
    rows: () => S.data.guests.flatMap((g) => (g.stays || []).map((st) => ({
      dates: { checkIn: st.checkIn }, dims: { property: st.property || '', country: g.country || '', city: g.city || '', repeat: (g.stays || []).length > 1 ? 'Tekrar gelen' : 'İlk kez', vip: (g.tags || []).some((t) => /vip/i.test(t)) ? 'VIP' : 'Standart', note: st.note || '' },
      amt: { amount: { TRY: num(st.amount) } }, n: { count: 1, nights: st.checkIn && st.checkOut ? Math.max(0, Math.round((new Date(st.checkOut) - new Date(st.checkIn)) / 864e5)) : 0, guests: 0, _gid: g.id }, ref: { col: 'guests', id: g.id, title: g.name },
    }))),
  },
  activities: {
    label: 'Satış aktiviteleri', dates: [['date', 'Aktivite tarihi']],
    dims: () => [['type', 'Aktivite türü'], ['user', 'Giren kişi'], ['refType', 'İlgili kayıt türü'], ['refName', 'İlgili kayıt']],
    metrics: () => ({ count: ['Aktivite sayısı', 'n'] }),
    rows: () => S.data.activities.map((a) => ({ dates: { date: a.date }, dims: { type: ACT_TYPES[a.type] || '', user: a.userName || '', refType: a.ref ? ({ accounts: 'Acente / firma', guests: 'Misafir', opps: 'Grup & etkinlik', weddings: 'Düğün' })[a.ref.col] || '' : '', refName: a.refName || '' }, amt: {}, n: { count: 1 }, ref: a.ref ? { col: a.ref.col, id: a.ref.id, title: a.subject } : null })),
  },
  tasks: {
    label: 'Görevler', dates: [['due', 'Görev tarihi']],
    dims: () => [['assignee', 'Atanan'], ['status', 'Durum'], ['priority', 'Öncelik']],
    metrics: () => ({ count: ['Görev sayısı', 'n'], done: ['Tamamlanan', 'n'], late: ['Geciken', 'n'] }),
    rows: () => S.data.tasks.map((t) => ({ dates: { due: t.due }, dims: { assignee: userName(t.assigneeId), status: t.done ? 'Tamamlandı' : 'Açık', priority: t.priority === 'yuksek' ? 'Yüksek' : 'Normal' }, amt: {}, n: { count: 1, done: t.done ? 1 : 0, late: !t.done && t.due && t.due < today() ? 1 : 0 }, ref: null })),
  },
};
const TIME = [['month', 'Ay'], ['quarter', 'Çeyrek'], ['year', 'Yıl'], ['weekday', 'Haftanın günü']];
const PERIODS = [['thisYear', 'Bu yıl'], ['lastYear', 'Geçen yıl'], ['nextYear', 'Gelecek yıl'], ['thisMonth', 'Bu ay'], ['lastMonth', 'Geçen ay'], ['thisQuarter', 'Bu çeyrek'], ['last12', 'Son 12 ay'], ['next12', 'Gelecek 12 ay'], ['all', 'Tüm zamanlar'], ['custom', 'Özel aralık']];

/* ---------- tarih aralığı ---------- */
function range(c) {
  const t = new Date(today() + 'T12:00:00'), y = t.getFullYear(), m = t.getMonth();
  const d = (Y, M, D) => iso(new Date(Y, M, D, 12));
  switch (c.period) {
    case 'thisYear': return [d(y, 0, 1), d(y, 11, 31)];
    case 'lastYear': return [d(y - 1, 0, 1), d(y - 1, 11, 31)];
    case 'nextYear': return [d(y + 1, 0, 1), d(y + 1, 11, 31)];
    case 'thisMonth': return [d(y, m, 1), d(y, m + 1, 0)];
    case 'lastMonth': return [d(y, m - 1, 1), d(y, m, 0)];
    case 'thisQuarter': { const q = Math.floor(m / 3) * 3; return [d(y, q, 1), d(y, q + 3, 0)]; }
    case 'last12': return [d(y, m - 11, 1), d(y, m + 1, 0)];
    case 'next12': return [d(y, m, 1), d(y, m + 12, 0)];
    case 'custom': return [c.from || '0000-01-01', c.to || '9999-12-31'];
    default: return ['0000-01-01', '9999-12-31'];
  }
}
const shift = ([a, b], mode) => {
  if (mode === 'prevYear') { const f = (s) => (s.length === 10 && !s.startsWith('0000') && !s.startsWith('9999') ? `${Number(s.slice(0, 4)) - 1}${s.slice(4)}` : s); return [f(a), f(b)]; }
  const da = new Date(a + 'T12:00:00'), db = new Date(b + 'T12:00:00'); const len = Math.round((db - da) / 864e5) + 1; return [addDays(a, -len), addDays(a, -1)];
};
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
function groupKey(row, by, dateField, cmpMode) {
  if (!by) return ['Toplam', 'Toplam'];
  const dt = row.dates[dateField] || '';
  if (by === 'month') return dt ? [cmpMode ? dt.slice(5, 7) : dt.slice(0, 7), `${MON3[Number(dt.slice(5, 7)) - 1]}${cmpMode ? '' : ' ' + dt.slice(0, 4)}`] : ['~', 'Tarihsiz'];
  if (by === 'quarter') { if (!dt) return ['~', 'Tarihsiz']; const q = Math.floor((Number(dt.slice(5, 7)) - 1) / 3) + 1; return [cmpMode ? `${q}` : `${dt.slice(0, 4)}-${q}`, `Ç${q}${cmpMode ? '' : ' ' + dt.slice(0, 4)}`]; }
  if (by === 'year') return dt ? [dt.slice(0, 4), dt.slice(0, 4)] : ['~', 'Tarihsiz'];
  if (by === 'weekday') { if (!dt) return ['~', 'Tarihsiz']; const w = new Date(dt + 'T12:00:00').getDay(); return [String((w + 6) % 7), DAYS[w]]; }
  const v = row.dims[by]; const s = v === '' || v == null ? 'Belirtilmemiş' : String(v); return [s, s];
}

/* ---------- hesap ---------- */
function compute(c) {
  const ds = DS[c.ds]; const metrics = ds.metrics(); const all = ds.rows();
  const inRange = (r, [a, b]) => { const d = r.dates[c.dateField]; if (c.period === 'all') return true; return d && d >= a && d <= b; };
  const passF = (r) => (c.filters || []).every((f) => !f.dim || !f.val || String(r.dims[f.dim] ?? '') === f.val);
  const cur = c.currency || 'TRY';
  const agg = (rows, cmp) => {
    const g = new Map();
    rows.forEach((r) => {
      const [k, label] = groupKey(r, c.groupBy, c.dateField, cmp);
      const k2 = c.groupBy2 ? groupKey(r, c.groupBy2, c.dateField, cmp)[1] : '';
      const key = k + '\u0001' + k2;
      if (!g.has(key)) g.set(key, { k, label, k2, sum: {}, gids: new Set() });
      const e = g.get(key);
      Object.entries(r.n).forEach(([m, v]) => { if (m[0] !== '_') e.sum[m] = (e.sum[m] || 0) + (v || 0); });
      Object.entries(r.amt).forEach(([m, mp]) => { e.sum[m] = (e.sum[m] || 0) + ((mp || {})[cur] || 0); });
      if (r.n._gid) e.gids.add(r.n._gid);
      e.refs = e.refs || []; if (r.ref) e.refs.push(r.ref);
    });
    g.forEach((e) => { if (e.gids.size) e.sum.guests = e.gids.size; derive(e.sum); });
    return g;
  };
  const derive = (s) => { s.winRate = (s.won || 0) + (s.lost || 0) ? (s.won / (s.won + s.lost)) * 100 : null; s.adr = s.rn ? (s.oda || 0) / s.rn : null; s.avg = s.count ? (s.net || 0) / s.count : null; };
  const r0 = range(c);
  const cur0 = all.filter((r) => inRange(r, r0) && passF(r));
  const cmp = c.compare && c.compare !== 'none' && c.period !== 'all';
  const g0 = agg(cur0, cmp && ['month', 'quarter', 'weekday'].includes(c.groupBy));
  let g1 = null, r1 = null;
  if (cmp) { r1 = shift(r0, c.compare); g1 = agg(all.filter((r) => inRange(r, r1) && passF(r)), ['month', 'quarter', 'weekday'].includes(c.groupBy)); }
  const tot = { sum: {} }; cur0.forEach((r) => { Object.entries(r.n).forEach(([m, v]) => { if (m[0] !== '_') tot.sum[m] = (tot.sum[m] || 0) + (v || 0); }); Object.entries(r.amt).forEach(([m, mp]) => { tot.sum[m] = (tot.sum[m] || 0) + ((mp || {})[cur] || 0); }); });
  if (c.ds === 'stays') tot.sum.guests = new Set(cur0.map((r) => r.n._gid)).size; derive(tot.sum);
  let tot1 = null; if (g1) { tot1 = { sum: {} }; g1.forEach((e) => Object.entries(e.sum).forEach(([m, v]) => { if (typeof v === 'number') tot1.sum[m] = (tot1.sum[m] || 0) + v; })); derive(tot1.sum); }
  return { ds, metrics, g0, g1, tot, tot1, r0, r1, n: cur0.length, cur };
}

/* ---------- biçim ---------- */
const fmtM = (type, v, cur) => (v == null || Number.isNaN(v) ? '—' : type === 'm' ? money(v, cur) : type === 'p' ? `%${fmtNum(v)}` : type === 'd' ? (v >= 100 ? money(v, cur) : fmtNum(v)) : fmtNum(v));
const pct = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
const deltaHtml = (a, b) => { const p = pct(a || 0, b || 0); if (p == null) return '<span class="muted">—</span>'; const cls = p >= 0 ? 'olive' : 'red'; return `<span class="badge ${cls}">${p >= 0 ? '+' : ''}${p.toFixed(1).replace('.', ',')}%</span>`; };
const mtype = (metrics, k) => (k === 'adr' || k === 'avg' ? 'm' : (metrics[k] || [])[1]);

/* ---------- grafik (SVG) ---------- */
function chartSvg(groups, metricKey, metrics, cur, cmpMap, kind) {
  const vals = groups.map((e) => e.sum[metricKey] || 0); const prev = cmpMap ? groups.map((e) => (cmpMap.get(e.k) || { sum: {} }).sum[metricKey] || 0) : null;
  const max = Math.max(1, ...vals, ...(prev || [0])); const W = 760, H = 240, pl = 8, pb = 34, pt = 14; const n = Math.max(1, groups.length); const cw = (W - pl * 2) / n;
  const y = (v) => pt + (H - pt - pb) * (1 - v / max);
  const lab = (s) => (s.length > 12 ? s.slice(0, 11) + '…' : s);
  let body = '';
  for (let i = 0; i <= 4; i++) { const yy = pt + ((H - pt - pb) * i) / 4; body += `<line x1="${pl}" x2="${W - pl}" y1="${yy}" y2="${yy}" stroke="#E2E7EF"/>`; }
  if (kind === 'line') {
    const pts = (arr) => arr.map((v, i) => `${pl + cw * i + cw / 2},${y(v)}`).join(' ');
    if (prev) body += `<polyline points="${pts(prev)}" fill="none" stroke="#B9C4D4" stroke-width="2" stroke-dasharray="4 4"/>`;
    body += `<polyline points="${pts(vals)}" fill="none" stroke="var(--primary)" stroke-width="2.5"/>` + vals.map((v, i) => `<circle cx="${pl + cw * i + cw / 2}" cy="${y(v)}" r="3.5" fill="var(--primary)"><title>${esc(groups[i].label)}: ${esc(fmtM(mtype(metrics, metricKey), v, cur))}</title></circle>`).join('');
  } else {
    const bw = Math.min(46, cw * (prev ? 0.36 : 0.62));
    groups.forEach((e, i) => {
      const x = pl + cw * i + cw / 2; const v = vals[i];
      if (prev) body += `<rect x="${x - bw - 1}" y="${y(prev[i])}" width="${bw}" height="${H - pb - y(prev[i])}" fill="#C9D3E1" rx="2"><title>Önceki: ${esc(fmtM(mtype(metrics, metricKey), prev[i], cur))}</title></rect>`;
      body += `<rect x="${prev ? x + 1 : x - bw / 2}" y="${y(v)}" width="${bw}" height="${H - pb - y(v)}" fill="var(--primary)" rx="2"><title>${esc(e.label)}: ${esc(fmtM(mtype(metrics, metricKey), v, cur))}</title></rect>`;
    });
  }
  body += groups.map((e, i) => `<text x="${pl + cw * i + cw / 2}" y="${H - 12}" font-size="11" text-anchor="middle" fill="#69768D">${esc(lab(e.label))}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(metrics[metricKey] ? metrics[metricKey][0] : '')} grafiği" style="max-height:260px;font-family:inherit">${body}</svg>`;
}

/* ---------- durum ---------- */
const DEF = { ds: 'opps', dateField: 'event', period: 'thisYear', from: '', to: '', filters: [{ dim: 'result', val: 'Kesinleşti' }], groupBy: 'month', groupBy2: '', metrics: ['count', 'rn', 'net', 'adr'], currency: 'TRY', compare: 'prevYear', chart: 'bar', name: '' };
const LS = 'ortunc-crm.rb';
const loadCfg = () => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(LS) || '{}') }; } catch (e) { return { ...DEF }; } };
const saveLocal = () => { try { localStorage.setItem(LS, JSON.stringify(S.rb)); } catch (e) { /* yok */ } };
S.rb = null;
const opt = (list, v, empty) => `${empty ? `<option value="">${empty}</option>` : ''}${list.map(([k, l]) => `<option value="${esc(k)}" ${String(v) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('')}`;

export const QUICK = [
  ['Aylık kesinleşen grup satışları', { ds: 'opps', dateField: 'event', period: 'thisYear', filters: [{ dim: 'result', val: 'Kesinleşti' }], groupBy: 'month', groupBy2: '', metrics: ['count', 'rn', 'net', 'adr', 'pax'], compare: 'prevYear', chart: 'bar' }],
  ['Yıllık satış özeti (yıl yıl)', { ds: 'opps', dateField: 'event', period: 'all', filters: [{ dim: 'result', val: 'Kesinleşti' }], groupBy: 'year', groupBy2: '', metrics: ['count', 'rn', 'oda', 'yi', 'salon', 'net'], compare: 'none', chart: 'bar' }],
  ['Segment bazında gelir', { ds: 'opps', dateField: 'event', period: 'thisYear', filters: [{ dim: 'result', val: 'Kesinleşti' }], groupBy: 'segment', groupBy2: '', metrics: ['count', 'rn', 'net', 'adr'], compare: 'prevYear', chart: 'bar' }],
  ['Kanal performansı', { ds: 'opps', dateField: 'event', period: 'thisYear', filters: [], groupBy: 'channel', groupBy2: '', metrics: ['count', 'won', 'winRate', 'net'], compare: 'none', chart: 'bar' }],
  ['Acente üretimi', { ds: 'opps', dateField: 'event', period: 'thisYear', filters: [{ dim: 'result', val: 'Kesinleşti' }], groupBy: 'account', groupBy2: '', metrics: ['count', 'rn', 'net', 'adr'], compare: 'prevYear', chart: 'bar' }],
  ['Satış hunisi ve dönüşüm (kişi bazında)', { ds: 'opps', dateField: 'created', period: 'thisYear', filters: [], groupBy: 'owner', groupBy2: '', metrics: ['count', 'won', 'winRate', 'gross'], compare: 'none', chart: 'bar' }],
  ['Kayıp nedenleri', { ds: 'opps', dateField: 'created', period: 'thisYear', filters: [{ dim: 'result', val: 'Kaybedildi' }], groupBy: 'lossReason', groupBy2: '', metrics: ['count', 'gross'], compare: 'none', chart: 'bar' }],
  ['Departman gelirleri (aylık)', { ds: 'items', dateField: 'event', period: 'thisYear', filters: [{ dim: 'result', val: 'Kesinleşti' }], groupBy: 'month', groupBy2: 'dept', metrics: ['net'], compare: 'none', chart: 'bar' }],
  ['Düğünler · aylık sözleşmeler', { ds: 'weddings', dateField: 'event', period: 'next12', filters: [{ dim: 'result', val: 'Kesinleşti' }], groupBy: 'month', groupBy2: '', metrics: ['count', 'pax', 'net', 'yi'], compare: 'none', chart: 'bar' }],
  ['Satış ekibi aktiviteleri', { ds: 'activities', dateField: 'date', period: 'thisMonth', filters: [], groupBy: 'user', groupBy2: 'type', metrics: ['count'], compare: 'none', chart: 'bar' }],
  ['Konaklamalar · ülke bazında', { ds: 'stays', dateField: 'checkIn', period: 'thisYear', filters: [], groupBy: 'country', groupBy2: '', metrics: ['count', 'nights', 'guests'], compare: 'prevYear', chart: 'bar' }],
];

/* ---------- ekran ---------- */
V.builder = {
  title: () => 'Rapor oluşturucu',
  head: () => `<button class="btn" data-act="rbPrint">${ic('printer')}<span class="hide-m"> PDF / Yazdır</span></button><button class="btn" data-act="rbExcel">${ic('download')}<span class="hide-m"> Excel</span></button>${can.edit('activities') ? `<button class="btn pri" data-act="rbSave">${ic('check')} Raporu kaydet</button>` : ''}`,
  body: () => {
    if (!S.rb) S.rb = loadCfg();
    const c = S.rb; if (!DS[c.ds]) Object.assign(c, DEF);
    const ds = DS[c.ds]; const dims = ds.dims(); const metrics = ds.metrics();
    if (!ds.dates.some((d) => d[0] === c.dateField)) c.dateField = ds.dates[0][0];
    c.metrics = (c.metrics || []).filter((m) => metrics[m]); if (!c.metrics.length) c.metrics = [Object.keys(metrics)[0]];
    const res = compute(c);
    const valsOf = (dim) => sortBy(Array.from(new Set(ds.rows().map((r) => String(r.dims[dim] ?? '')).filter(Boolean))), (x) => x);
    const saved = sortBy(S.data.reports || [], (r) => r.name || '');
    const groups0 = Array.from(res.g0.values());
    // satırlar: groupBy2 varsa pivot
    let table;
    if (c.groupBy2) {
      const mk = c.metrics[0]; const cols = sortBy(Array.from(new Set(groups0.map((e) => e.k2))), (x) => x); const rowsK = sortBy(Array.from(new Set(groups0.map((e) => e.k + '\u0001' + e.label))), (x) => x);
      const cell = (rk, ck) => { const e = groups0.find((x) => x.k + '\u0001' + x.label === rk && x.k2 === ck); return e ? e.sum[mk] || 0 : 0; };
      table = `<table class="tb"><tr><th>${esc((dims.concat(TIME).find((d) => d[0] === c.groupBy) || ['', ''])[1])}</th>${cols.map((cc) => `<th class="n">${esc(cc)}</th>`).join('')}<th class="n">Toplam</th></tr>
        ${rowsK.map((rk) => { const lab = rk.split('\u0001')[1]; const vs = cols.map((cc) => cell(rk, cc)); return `<tr><td>${esc(lab)}</td>${vs.map((v) => `<td class="n">${v ? esc(fmtM(mtype(metrics, mk), v, res.cur)) : '<span class="muted">—</span>'}</td>`).join('')}<td class="n"><b>${esc(fmtM(mtype(metrics, mk), vs.reduce((a, b) => a + b, 0), res.cur))}</b></td></tr>`; }).join('')}
        <tr><td><b>Toplam</b></td>${cols.map((cc) => `<td class="n"><b>${esc(fmtM(mtype(metrics, mk), rowsK.reduce((s, rk) => s + cell(rk, cc), 0), res.cur))}</b></td>`).join('')}<td class="n"><b>${esc(fmtM(mtype(metrics, mk), res.tot.sum[mk], res.cur))}</b></td></tr></table>`;
      const r2 = (v) => (v == null ? '' : Math.round(v * 100) / 100);
      S.rbAoa = [[(dims.concat(TIME).find((d) => d[0] === c.groupBy) || ['', ''])[1] + ' / ' + metrics[mk][0], ...cols, 'Toplam'], ...rowsK.map((rk) => { const vs = cols.map((cc) => cell(rk, cc)); return [rk.split('\u0001')[1], ...vs.map(r2), r2(vs.reduce((a, b) => a + b, 0))]; }), ['Toplam', ...cols.map((cc) => r2(rowsK.reduce((s, rk) => s + cell(rk, cc), 0))), r2(res.tot.sum[mk])]];
    } else {
      const gs = sortBy(groups0, (e) => (['month', 'quarter', 'year', 'weekday'].includes(c.groupBy) ? e.k : -(e.sum[c.metrics[0]] || 0)));
      table = `<table class="tb"><tr><th>${esc(c.groupBy ? (dims.concat(TIME).find((d) => d[0] === c.groupBy) || ['', ''])[1] : 'Toplam')}</th>${c.metrics.map((m) => `<th class="n">${esc(metrics[m][0])}</th>${res.g1 ? `<th class="n">Önceki</th><th class="n">Fark</th>` : ''}`).join('')}</tr>
        ${gs.map((e) => { const p = res.g1 ? res.g1.get(e.k + '\u0001') : null; return `<tr><td>${esc(e.label)}</td>${c.metrics.map((m) => `<td class="n">${esc(fmtM(mtype(metrics, m), e.sum[m], res.cur))}</td>${res.g1 ? `<td class="n muted">${esc(fmtM(mtype(metrics, m), p ? p.sum[m] : 0, res.cur))}</td><td class="n">${deltaHtml(e.sum[m], p ? p.sum[m] : 0)}</td>` : ''}`).join('')}</tr>`; }).join('')}
        ${c.groupBy ? `<tr><td><b>Toplam</b></td>${c.metrics.map((m) => `<td class="n"><b>${esc(fmtM(mtype(metrics, m), res.tot.sum[m], res.cur))}</b></td>${res.g1 ? `<td class="n muted"><b>${esc(fmtM(mtype(metrics, m), res.tot1.sum[m], res.cur))}</b></td><td class="n">${deltaHtml(res.tot.sum[m], res.tot1.sum[m])}</td>` : ''}`).join('')}</tr>` : ''}</table>`;
      S.rbGroups = gs;
      const r2 = (v) => (v == null ? '' : Math.round(v * 100) / 100);
      S.rbAoa = [[c.groupBy ? (dims.concat(TIME).find((d) => d[0] === c.groupBy) || ['', ''])[1] : 'Toplam', ...c.metrics.flatMap((m) => [metrics[m][0] + (mtype(metrics, m) === 'm' ? ` (${res.cur})` : ''), ...(res.g1 ? [metrics[m][0] + ' · önceki', metrics[m][0] + ' · fark %'] : [])])],
        ...gs.map((e) => { const p = res.g1 ? res.g1.get(e.k + '\u0001') : null; return [e.label, ...c.metrics.flatMap((m) => [r2(e.sum[m]), ...(res.g1 ? [r2(p ? p.sum[m] : 0), r2(pct(e.sum[m] || 0, p ? p.sum[m] || 0 : 0))] : [])])]; }),
        ...(c.groupBy ? [['Toplam', ...c.metrics.flatMap((m) => [r2(res.tot.sum[m]), ...(res.g1 ? [r2(res.tot1.sum[m]), r2(pct(res.tot.sum[m] || 0, res.tot1.sum[m] || 0))] : [])])]] : [])];
    }
    const chartGroups = c.groupBy2 ? null : S.rbGroups;
    const chart = c.chart !== 'none' && chartGroups && chartGroups.length > 1 ? chartSvg(chartGroups, c.metrics[0], metrics, res.cur, res.g1 ? new Map(Array.from(res.g1.values()).map((e) => [e.k, e])) : null, c.chart) : '';
    const rangeTxt = c.period === 'all' ? 'Tüm zamanlar' : `${fmtDate(res.r0[0])} – ${fmtDate(res.r0[1])}${res.r1 ? ` · karşılaştırma: ${fmtDate(res.r1[0])} – ${fmtDate(res.r1[1])}` : ''}`;
    S.rbLast = { table, chart, rangeTxt, res, c };
    return `<div class="rb">
      <aside class="card pad rbcfg">
        <div class="fld"><label for="rbDs">Ne raporlanacak?</label><select id="rbDs" class="inp" data-change="rbSet" data-k="ds">${opt(Object.entries(DS).map(([k, d]) => [k, d.label]), c.ds)}</select></div>
        <div class="fld"><label for="rbDf">Tarih alanı</label><select id="rbDf" class="inp" data-change="rbSet" data-k="dateField">${opt(ds.dates, c.dateField)}</select></div>
        <div class="fld"><label for="rbPe">Dönem</label><select id="rbPe" class="inp" data-change="rbSet" data-k="period">${opt(PERIODS, c.period)}</select></div>
        ${c.period === 'custom' ? `<div class="form" style="gap:8px"><div class="fld half"><label>Başlangıç</label><input type="date" class="inp" value="${esc(c.from)}" data-change="rbSet" data-k="from"></div><div class="fld half"><label>Bitiş</label><input type="date" class="inp" value="${esc(c.to)}" data-change="rbSet" data-k="to"></div></div>` : ''}
        <div class="fld"><label>Filtreler</label>${(c.filters || []).map((f, i) => `<div style="display:flex;gap:6px;margin-bottom:6px"><select class="inp" data-change="rbFilt" data-i="${i}" data-p="dim" aria-label="Filtre alanı">${opt(dims, f.dim, 'Alan seçin')}</select><select class="inp" data-change="rbFilt" data-i="${i}" data-p="val" aria-label="Filtre değeri" ${f.dim ? '' : 'disabled'}>${opt(f.dim ? valsOf(f.dim).map((v) => [v, v]) : [], f.val, 'Değer')}</select><button class="x" data-act="rbFiltDel" data-i="${i}" aria-label="Filtreyi kaldır">${ic('x')}</button></div>`).join('')}
          <button class="btn sm" data-act="rbFiltAdd">${ic('plus')} Filtre ekle</button></div>
        <div class="fld"><label for="rbG">Gruplama (satırlar)</label><select id="rbG" class="inp" data-change="rbSet" data-k="groupBy">${opt([...TIME, ...dims], c.groupBy, 'Gruplama yok (tek toplam)')}</select></div>
        <div class="fld"><label for="rbG2">İkinci gruplama (sütunlar)</label><select id="rbG2" class="inp" data-change="rbSet" data-k="groupBy2">${opt([...TIME, ...dims].filter((d) => d[0] !== c.groupBy), c.groupBy2, 'Yok')}</select><span class="hint">Seçilirse ilk ölçü tablo olarak çaprazlanır.</span></div>
        <div class="fld"><label>Ölçüler</label><div class="acts">${Object.entries(metrics).map(([k, [l]]) => `<button class="chip ${c.metrics.includes(k) ? 'on' : ''}" data-act="rbMetric" data-k="${k}" aria-pressed="${c.metrics.includes(k)}">${esc(l)}</button>`).join('')}</div></div>
        <div class="form" style="gap:8px">
          <div class="fld half"><label for="rbCur">Para birimi</label><select id="rbCur" class="inp" data-change="rbSet" data-k="currency">${opt(Object.keys(CUR_SYM).map((k) => [k, `${CUR_SYM[k]} ${k}`]), c.currency)}</select></div>
          <div class="fld half"><label for="rbCh">Grafik</label><select id="rbCh" class="inp" data-change="rbSet" data-k="chart">${opt([['bar', 'Sütun'], ['line', 'Çizgi'], ['none', 'Yok']], c.chart)}</select></div>
          <div class="fld"><label for="rbCmp">Karşılaştır</label><select id="rbCmp" class="inp" data-change="rbSet" data-k="compare">${opt([['none', 'Karşılaştırma yok'], ['prevYear', 'Geçen yılın aynı dönemi'], ['prevPeriod', 'Bir önceki dönem']], c.compare)}</select></div>
        </div>
      </aside>
      <section class="rbout">
        <div class="card pad" style="margin-bottom:12px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="font-size:15px">${esc(c.name || ds.label)}</b><span class="muted" style="font-size:13px">${esc(rangeTxt)} · ${res.n} kayıt${c.currency !== 'TRY' ? ' · ' + c.currency : ''}</span></div>
          ${(c.filters || []).filter((f) => f.dim && f.val).length ? `<div class="acts" style="margin-top:6px">${c.filters.filter((f) => f.dim && f.val).map((f) => `<span class="badge teal">${esc((dims.find((d) => d[0] === f.dim) || ['', f.dim])[1])}: ${esc(f.val)}</span>`).join('')}</div>` : ''}
          ${chart ? `<div style="margin-top:10px">${chart}</div>${res.g1 ? '<p class="muted" style="font-size:12px;margin:2px 0 0">Koyu: seçili dönem · açık: karşılaştırılan dönem</p>' : ''}` : ''}</div>
        <div class="card"><div class="scroll-x">${res.n ? table : '<div class="empty"><b>Bu seçimlerle kayıt yok</b>Dönemi genişletin ya da filtreleri kaldırın.</div>'}</div></div>
      </section>
      <aside class="card rbside"><div class="pad" style="padding-bottom:4px"><h3 style="margin:0">Hazır raporlar</h3></div><div class="list">${QUICK.map(([n], i) => `<button class="row" data-act="rbQuick" data-i="${i}"><div class="t"><b style="font-weight:400">${esc(n)}</b></div></button>`).join('')}</div>
        <div class="pad" style="padding-bottom:4px;border-top:1px solid var(--line)"><h3 style="margin:0">Kaydedilen raporlar</h3></div>${saved.length ? `<div class="list">${saved.map((r) => `<div class="row"><button class="t" style="border:0;background:none;text-align:left;padding:0" data-act="rbOpen" data-id="${r.id}"><b style="font-weight:400">${esc(r.name)}</b><span>${esc(r.createdByName || '')}</span></button>${can.admin() || r.createdBy === S.user.uid ? `<button class="x" data-act="rbDel" data-id="${r.id}" aria-label="Sil">${ic('x')}</button>` : ''}</div>`).join('')}</div>` : '<div class="pad muted" style="padding-top:4px;font-size:13px">Ayarladığınız raporu "Raporu kaydet" ile ekibe kaydedin.</div>'}</aside>
    </div>`;
  },
};
const rerender = () => { saveLocal(); A._renderView(); };
A.rbSet = (el) => { const k = el.dataset.k; S.rb[k] = el.value; if (k === 'ds') { const d = DS[el.value]; S.rb.dateField = d.dates[0][0]; S.rb.filters = []; S.rb.groupBy = 'month'; S.rb.groupBy2 = ''; S.rb.metrics = Object.keys(d.metrics()).slice(0, 3); } if (k === 'groupBy' && S.rb.groupBy2 === el.value) S.rb.groupBy2 = ''; S.rb.name = ''; rerender(); };
A.rbFilt = (el) => { const f = S.rb.filters[Number(el.dataset.i)]; f[el.dataset.p] = el.value; if (el.dataset.p === 'dim') f.val = ''; rerender(); };
A.rbFiltAdd = () => { S.rb.filters = [...(S.rb.filters || []), { dim: '', val: '' }]; rerender(); };
A.rbFiltDel = (el) => { S.rb.filters.splice(Number(el.dataset.i), 1); rerender(); };
A.rbMetric = (el) => { const m = S.rb.metrics; const i = m.indexOf(el.dataset.k); if (i >= 0) { if (m.length > 1) m.splice(i, 1); } else m.push(el.dataset.k); rerender(); };
A.rbQuick = (el) => { const [name, cfg] = QUICK[Number(el.dataset.i)]; S.rb = { ...DEF, ...JSON.parse(JSON.stringify(cfg)), currency: S.rb.currency || 'TRY', name }; rerender(); };
A.rbOpen = (el) => { const r = (S.data.reports || []).find((x) => x.id === el.dataset.id); if (!r) return; S.rb = { ...DEF, ...r.cfg, name: r.name }; rerender(); };
A.rbDel = (el) => { const r = (S.data.reports || []).find((x) => x.id === el.dataset.id); confirmBox(`"${r.name}" raporu silinecek.`, 'Sil', async () => { await S.store.remove('reports', r.id); toast('Rapor silindi'); }); };
A.rbSave = () => {
  const { name, ...cfg } = S.rb;
  A._openForm({ title: 'Raporu kaydet', data: { name: name || '' }, fields: [{ k: 'name', label: 'Rapor adı', req: true, ph: 'ör. Aylık MICE satışları' }],
    onSave: async (v) => { const ex = (S.data.reports || []).find((r) => r.name === v.name.trim()); await S.store.save('reports', stamp({ ...(ex || {}), name: v.name.trim(), cfg, createdByName: (ex && ex.createdByName) || S.user.name })); S.rb.name = v.name.trim(); saveLocal(); toast('Rapor kaydedildi; ekip "Kaydedilen raporlar" listesinde görür'); } });
};
A.rbExcel = () => {
  const L = S.rbLast; if (!L) return;
  if (!L.res.n || !S.rbAoa) return toast('Aktarılacak veri yok.');
  const ws = XLSX.utils.aoa_to_sheet(S.rbAoa); ws['!cols'] = S.rbAoa[0].map((h, i) => ({ wch: Math.max(12, String(h).length + 2, i === 0 ? 24 : 0) })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Rapor');
  const info = XLSX.utils.aoa_to_sheet([['Rapor', L.c.name || L.res.ds.label], ['Dönem', L.rangeTxt], ['Kayıt sayısı', L.res.n], ['Para birimi', L.res.cur], ['Filtreler', (L.c.filters || []).filter((f) => f.dim && f.val).map((f) => `${f.dim}: ${f.val}`).join('; ') || '—'], ['Oluşturan', S.user.name], ['Tarih', fmtDate(today())]]);
  XLSX.utils.book_append_sheet(wb, info, 'Bilgi');
  saveFile(`Rapor-${(L.c.name || L.res.ds.label).replace(/[^\p{L}\p{N}]+/gu, '-')}-${today()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
};
A.rbPrint = () => {
  const L = S.rbLast; if (!L) return;
  const html = `<div class="pdoc"><div class="ph"><b>${esc(S.settings.hotelName)}</b><span>${esc(fmtDate(today()))} · ${esc(S.user.name)}</span></div><h1>${esc(L.c.name || L.res.ds.label)}</h1><p class="sub">${esc(L.rangeTxt)} · ${L.res.n} kayıt · ${esc(L.res.cur)}</p>${L.chart ? `<div style="margin:6px 0 12px">${L.chart.replace(/var\(--primary\)/g, getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#1F5E8C')}</div>` : ''}${L.table.replace(/<span class="badge (\w+)">/g, '<span>')}</div>`;
  printHtml(`Rapor-${today()}`, html);
};
