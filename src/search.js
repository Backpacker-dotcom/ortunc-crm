// Genel arama (Ctrl+K): tüm kayıt türlerinde ad, telefon, e-posta, şehir, not içinde arar.
import { S, A, $, $$, esc, ic, trLower, digits, fmtDate, moneyMap, recTotals, stageLabel, OPP_STAGES, WED_STAGES, ACC_TYPES, closeModal } from './core.js';

const SRC = [
  ['accounts', 'Acenteler & firmalar', 'building', (a) => [a.name, a.city, a.country, a.email, a.phone, a.invTitle, a.taxNo, ...(a.contacts || []).flatMap((c) => [c.name, c.phone, c.email])], (a) => [ACC_TYPES[a.type], a.city].filter(Boolean).join(' · ')],
  ['opps', 'Grup & etkinlik', 'handshake', (o) => [o.title, o.contactName, o.phone, (S.data.accounts.find((a) => a.id === o.accountId) || {}).name, o.notes], (o) => [stageLabel(OPP_STAGES, o.stage), fmtDate(o.start)].filter(Boolean).join(' · ')],
  ['weddings', 'Düğün teklifleri', 'heart', (w) => [w.couple, w.phone, w.email, w.notes], (w) => [stageLabel(WED_STAGES, w.stage), fmtDate(w.date), moneyMap(recTotals('weddings', w))].filter(Boolean).join(' · ')],
  ['guests', 'Misafirler', 'users', (g) => [g.name, g.phone, g.email, g.city, g.country, (g.tags || []).join(' '), g.notes], (g) => [g.city || g.country, g.phone].filter(Boolean).join(' · ')],
  ['blacklist', 'Kara liste', 'ban', (b) => [b.name, b.phone, b.email, b.detail], (b) => 'Kara liste'],
  ['tasks', 'Görevler', 'list', (t) => [t.title, t.note, t.refName], (t) => (t.done ? 'Tamamlandı' : 'Açık · ' + fmtDate(t.due))],
];
let hits = [], sel = 0;
const titleOf = (col, r) => r.name || r.title || r.couple || '';
function find(q) {
  const n = trLower(q).trim(); const d = digits(q);
  if (n.length < 2 && d.length < 3) return [];
  const out = [];
  SRC.forEach(([col, label, icon, fields, sub]) => {
    const list = (S.data[col] || []).filter((r) => fields(r).some((v) => { if (!v) return false; const s = String(v); return trLower(s).includes(n) || (d.length >= 3 && digits(s).includes(d)); }));
    list.slice(0, 6).forEach((r) => out.push({ col, label, icon, r, title: titleOf(col, r), sub: sub(r) }));
  });
  return out;
}
const mark = (t, q) => { const s = esc(t); const n = q.trim(); if (!n) return s; const i = trLower(t).indexOf(trLower(n)); return i < 0 ? s : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + n.length)) + '</mark>' + esc(t.slice(i + n.length)); };
function renderHits(q) {
  hits = find(q); sel = 0;
  const box = $('#gsRes'); if (!box) return;
  if (!q.trim()) { box.innerHTML = '<div class="grp">Ad, telefon (son haneler yeter), e-posta, şehir ya da firma yazın.</div>'; return; }
  if (!hits.length) { box.innerHTML = `<div class="grp">"${esc(q)}" için kayıt bulunamadı.</div>`; return; }
  let last = ''; box.innerHTML = hits.map((h, i) => { const g = h.label !== last ? `<div class="grp">${esc(h.label)}</div>` : ''; last = h.label; return `${g}<button class="hit ${i === 0 ? 'sel' : ''}" data-act="gsGo" data-i="${i}">${ic(h.icon)}<b>${mark(h.title, q)}</b><span>${esc(h.sub || '')}</span></button>`; }).join('');
}
A.gsOpen = () => {
  $('#modal').innerHTML = `<div class="ov center" style="align-items:flex-start;padding-top:10vh"><div class="modal gs"><div class="mb"><input class="gsq" id="gsQ" placeholder="Ara: misafir, acente, teklif, telefon…" autocomplete="off" aria-label="Genel arama"><div class="res" id="gsRes"></div></div></div></div>`;
  const i = $('#gsQ'); i.focus(); renderHits('');
  i.addEventListener('input', () => renderHits(i.value));
  i.addEventListener('keydown', (e) => {
    const b = $$('#gsRes .hit');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!b.length) return; sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + b.length) % b.length; b.forEach((x, k) => x.classList.toggle('sel', k === sel)); b[sel].scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter' && hits[sel]) { e.preventDefault(); go(hits[sel]); }
  });
};
function go(h) {
  closeModal();
  if (h.col === 'tasks') { A.editTask({ dataset: { id: h.r.id } }); return; }
  A.open({ dataset: { col: h.col, id: h.r.id } });
}
A.gsGo = (el) => go(hits[Number(el.dataset.i)]);
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { if (S.gate === 'in') { e.preventDefault(); A.gsOpen(); } }
  else if (e.key === '/' && S.gate === 'in' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); A.gsOpen(); }
});
