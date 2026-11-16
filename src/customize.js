// Kişiselleştirme: özel alanlar, düzenlenebilir aşamalar, logo ve marka rengi
import { S, A, $, $$, esc, ic, toast, errText, can, openForm, closeModal, confirmBox, OPP_STAGES, WED_STAGES, fmtDate, num } from './core.js';

export const CF_TYPES = [['text', 'Metin'], ['textarea', 'Uzun metin'], ['number', 'Sayı'], ['date', 'Tarih'], ['select', 'Liste (seçmeli)'], ['check', 'Evet / Hayır']];
export const CF_COLS = [['opps', 'Grup & etkinlik'], ['weddings', 'Düğün teklifleri'], ['accounts', 'Acenteler & firmalar'], ['guests', 'Misafirler']];
export const cfOf = (col) => ((S.settings.customFields || {})[col] || []);

/* ---------- formlarda, detayda, çıktıda ---------- */
export function cfFormFields(col) {
  const fs = cfOf(col); if (!fs.length) return [];
  return [{ type: 'section', label: 'Ek alanlar' }, ...fs.map((f) => {
    if (f.type === 'select') return { k: f.key, label: f.label, type: 'select', opts: (f.options || []).map((o) => [o, o]), half: true };
    if (f.type === 'check') return { k: f.key, label: f.label, type: 'select', opts: [['Evet', 'Evet'], ['Hayır', 'Hayır']], half: true };
    if (f.type === 'textarea') return { k: f.key, label: f.label, type: 'textarea' };
    return { k: f.key, label: f.label, type: f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text', half: true };
  })];
}
export const cfValue = (f, v) => (v == null || v === '' ? '' : f.type === 'date' ? fmtDate(v) : f.type === 'number' ? new Intl.NumberFormat('tr-TR').format(num(v)) : String(v));
export const cfPairs = (col, r) => cfOf(col).map((f) => [f.label, cfValue(f, r[f.key])]).filter((x) => x[1] !== '');
export function cfCard(col, r) {
  const p = cfPairs(col, r); if (!p.length) return '';
  return `<div class="card pad"><h3>Ek alanlar</h3><dl class="dl">${p.map(([k, v]) => `<dt>${esc(k)}</dt><dd style="white-space:pre-wrap">${esc(v)}</dd>`).join('')}</dl></div>`;
}

/* ---------- aşamalar ---------- */
const BASE = { opps: OPP_STAGES.map((x) => [...x]), weddings: WED_STAGES.map((x) => [...x]) };
const LOCKED = { opps: ['talep', 'teklif', 'kazanildi', 'kaybedildi'], weddings: ['talep', 'teklif', 'sozlesme', 'kaybedildi'] };
// Ayarlardaki aşama listesini çalışma anındaki dizilere uygular (yerinde değiştirir; tüm ekranlar aynı diziyi kullanır)
export function applyStages() {
  [['opps', OPP_STAGES], ['weddings', WED_STAGES]].forEach(([col, arr]) => {
    const conf = (S.settings.stages || {})[col];
    const list = conf && conf.length ? conf.map((x) => [x.key, x.label]) : BASE[col].map((x) => [...x]);
    LOCKED[col].forEach((k) => { if (!list.some((x) => x[0] === k)) list.push(BASE[col].find((x) => x[0] === k)); });
    // kazanıldı / kaybedildi her zaman sonda
    const tail = list.filter((x) => x[0] === LOCKED[col][2] || x[0] === LOCKED[col][3]); const head = list.filter((x) => !tail.includes(x));
    arr.splice(0, arr.length, ...head, ...tail.sort((a) => (a[0] === 'kaybedildi' ? 1 : -1)));
  });
}
let stEdit = null;
A.stagesEdit = (el) => {
  const col = el.dataset.col; const arr = col === 'opps' ? OPP_STAGES : WED_STAGES;
  stEdit = { col, list: arr.map(([key, label]) => ({ key, label, locked: LOCKED[col].includes(key) })) };
  renderStages();
};
function renderStages() {
  const { col, list } = stEdit; const fixed = (k) => k === LOCKED[col][2] || k === LOCKED[col][3];
  $('#modal').innerHTML = `<div class="ov center"><div class="modal"><div class="mh"><h2>${col === 'opps' ? 'Grup & etkinlik' : 'Düğün'} · satış aşamaları</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb"><p class="muted" style="margin-top:0">Aşamaların adını değiştirin, sırasını ayarlayın ya da yeni aşama ekleyin. Kilitli aşamalar raporlar ve teklif akışı için gerekli; adı değişebilir, silinemez. Kazanıldı ve kaybedildi her zaman sondadır.</p>
      <div class="rows">${list.map((s, i) => `<div class="subrow" style="grid-template-columns:1fr auto auto auto"><input class="inp" data-stl="${i}" value="${esc(s.label)}" aria-label="Aşama adı">
        <button class="btn sm" data-act="stMove" data-i="${i}" data-d="-1" ${i === 0 || fixed(s.key) || fixed((list[i - 1] || {}).key) ? 'disabled' : ''} aria-label="Yukarı">↑</button>
        <button class="btn sm" data-act="stMove" data-i="${i}" data-d="1" ${fixed(s.key) || fixed((list[i + 1] || {}).key) || i === list.length - 1 ? 'disabled' : ''} aria-label="Aşağı">↓</button>
        ${s.locked ? `<span class="badge" title="Silinemez">Kilitli</span>` : `<button class="x" data-act="stDel" data-i="${i}" aria-label="Sil">${ic('x')}</button>`}</div>`).join('')}</div>
      <div style="margin-top:8px"><button class="btn sm" data-act="stAdd">${ic('plus')} Aşama ekle</button></div></div>
    <div class="mf"><button class="btn sp" data-act="stReset">Varsayılana dön</button><button class="btn" data-act="closeModal">Vazgeç</button><button class="btn pri" data-act="stSave">Kaydet</button></div></div></div>`;
}
const readSt = () => $$('[data-stl]').forEach((i) => { stEdit.list[Number(i.dataset.stl)].label = i.value; });
A.stMove = (el) => { readSt(); const i = Number(el.dataset.i), j = i + Number(el.dataset.d); const l = stEdit.list; [l[i], l[j]] = [l[j], l[i]]; renderStages(); };
A.stDel = (el) => { readSt(); const s = stEdit.list[Number(el.dataset.i)]; const used = S.data[stEdit.col].filter((r) => r.stage === s.key).length; if (used) { toast(`Bu aşamada ${used} kayıt var; önce onları başka aşamaya taşıyın.`); return; } stEdit.list.splice(Number(el.dataset.i), 1); renderStages(); };
A.stAdd = () => { readSt(); const l = stEdit.list; const at = l.findIndex((s) => s.key === LOCKED[stEdit.col][2]); l.splice(at < 0 ? l.length : at, 0, { key: 'a' + Date.now().toString(36), label: 'Yeni aşama', locked: false }); renderStages(); const ins = $$('[data-stl]'); const t = ins[at < 0 ? ins.length - 1 : at]; t.focus(); t.select(); };
A.stReset = () => { stEdit.list = BASE[stEdit.col].map(([key, label]) => ({ key, label, locked: LOCKED[stEdit.col].includes(key) })); renderStages(); };
A.stSave = async (el) => {
  readSt(); if (stEdit.list.some((s) => !s.label.trim())) return toast('Aşama adı boş olamaz.');
  el.disabled = true;
  try { const { id, ...rest } = S.settings; await S.store.save('settings', { ...rest, id: 'main', stages: { ...(S.settings.stages || {}), [stEdit.col]: stEdit.list.map(({ key, label }) => ({ key, label: label.trim() })) } }); toast('Aşamalar kaydedildi'); closeModal(); }
  catch (e) { toast(errText(e)); el.disabled = false; }
};

/* ---------- özel alanlar ---------- */
let cfCol = 'opps';
A.cfEdit = (el) => { cfCol = el.dataset.col; renderCf(); };
function renderCf() {
  const fs = cfOf(cfCol); const lbl = Object.fromEntries(CF_TYPES);
  $('#modal').innerHTML = `<div class="ov center"><div class="modal"><div class="mh"><h2>Özel alanlar · ${esc(Object.fromEntries(CF_COLS)[cfCol])}</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb"><p class="muted" style="margin-top:0">Bu kayıt türüne kendi alanlarınızı ekleyin (ör. "Bütçe aralığı", "Karar verici", "Rakip otel", "Sözleşme no"). Alanlar formun "Ek alanlar" bölümünde, kayıt detayında, yazdırmada, Excel'de ve rapor oluşturucuda görünür.</p>
      ${fs.length ? `<div class="card list" style="box-shadow:none">${fs.map((f, i) => `<div class="row"><div class="t"><b>${esc(f.label)}</b><span>${esc(lbl[f.type] || f.type)}${f.type === 'select' ? ' · ' + esc((f.options || []).join(', ')) : ''}</span></div>
        <button class="btn sm" data-act="cfMove" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Yukarı">↑</button><button class="btn sm" data-act="cfMove" data-i="${i}" data-d="1" ${i === fs.length - 1 ? 'disabled' : ''} aria-label="Aşağı">↓</button>
        <button class="btn sm" data-act="cfOne" data-i="${i}">${ic('pencil')}</button><button class="x" data-act="cfDel" data-i="${i}" aria-label="Sil">${ic('x')}</button></div>`).join('')}</div>` : '<div class="empty" style="padding:24px"><b>Henüz özel alan yok</b>İlk alanınızı ekleyin.</div>'}
      <div style="margin-top:10px"><button class="btn pri sm" data-act="cfOne" data-i="-1">${ic('plus')} Alan ekle</button></div></div></div></div>`;
}
async function saveCf(list) { const { id, ...rest } = S.settings; await S.store.save('settings', { ...rest, id: 'main', customFields: { ...(S.settings.customFields || {}), [cfCol]: list } }); }
A.cfOne = (el) => {
  const i = Number(el.dataset.i); const f = i >= 0 ? cfOf(cfCol)[i] : null;
  openForm({
    title: f ? 'Alanı düzenle' : 'Yeni alan', data: f ? { ...f, options: (f.options || []).join('\n') } : { type: 'text' },
    fields: [{ k: 'label', label: 'Alan adı', req: true, ph: 'ör. Karar verici' }, { k: 'type', label: 'Tür', type: 'select', opts: CF_TYPES, req: true },
      { k: 'options', label: 'Seçenekler (Liste türü için, her satıra bir tane)', type: 'textarea' }],
    onSave: async (v) => {
      const list = cfOf(cfCol).slice();
      const nf = { key: f ? f.key : 'cf_' + Date.now().toString(36), label: v.label.trim(), type: v.type, options: v.options.split('\n').map((x) => x.trim()).filter(Boolean) };
      if (nf.type === 'select' && !nf.options.length) { const e = new Error(); e.userMsg = 'Liste türü için en az bir seçenek yazın.'; throw e; }
      if (f) list[i] = nf; else list.push(nf);
      await saveCf(list); toast('Alan kaydedildi'); setTimeout(renderCf, 60); return false;
    },
  });
};
A.cfMove = async (el) => { const l = cfOf(cfCol).slice(); const i = Number(el.dataset.i), j = i + Number(el.dataset.d); [l[i], l[j]] = [l[j], l[i]]; await saveCf(l); setTimeout(renderCf, 60); };
A.cfDel = (el) => { const f = cfOf(cfCol)[Number(el.dataset.i)]; confirmBox(`"${f.label}" alanı listeden kaldırılacak. Kayıtlardaki değerler silinmez; alanı aynı adla yeniden ekleseniz de eski değerler görünmez.`, 'Kaldır', async () => { await saveCf(cfOf(cfCol).filter((x) => x.key !== f.key)); setTimeout(renderCf, 60); }); };

/* ---------- marka ---------- */
const PALETTE = ['#1F5E8C', '#0F6E6E', '#2E5A3C', '#6B4C9A', '#8A3B2E', '#3D4B66', '#B26A00'];
A.brandEdit = () => {
  const b = S.settings.brand || {};
  $('#modal').innerHTML = `<div class="ov center"><div class="modal sm"><div class="mh"><h2>Logo ve marka rengi</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb"><div class="fld"><label>Logo</label><div style="display:flex;gap:12px;align-items:center"><div id="lgPrev" style="width:56px;height:56px;border:1px solid var(--line);border-radius:10px;display:grid;place-items:center;overflow:hidden;background:#fff">${b.logo ? `<img src="${esc(b.logo)}" style="max-width:100%;max-height:100%">` : '<span class="muted" style="font-size:12px">yok</span>'}</div>
      <label class="btn sm">${ic('upload')} Logo seç<input type="file" accept="image/*" id="lgFile" hidden></label>${b.logo ? '<button class="btn sm danger" data-act="brandNoLogo">Kaldır</button>' : ''}</div><span class="hint">Kare ya da yatay PNG/JPG; menüde, giriş ekranında ve çıktılarda kullanılır.</span></div>
      <div class="fld" style="margin-top:14px"><label for="brCol">Marka rengi</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${PALETTE.map((c) => `<button class="btn sm" data-act="brandPick" data-c="${c}" style="width:30px;padding:0;background:${c};border-color:${c}" aria-label="${c}"></button>`).join('')}<input type="color" id="brCol" value="${esc(b.color || '#1F5E8C')}" style="width:44px;height:32px;border:1px solid var(--line);border-radius:6px;padding:2px;background:#fff"></div><span class="hint">Düğmeler, seçili menü ve vurgular bu renkte olur.</span></div></div>
    <div class="mf"><button class="btn" data-act="closeModal">Vazgeç</button><button class="btn pri" data-act="brandSave">Kaydet</button></div></div></div>`;
  $('#brCol').addEventListener('input', (e) => document.documentElement.style.setProperty('--primary', e.target.value));
  $('#lgFile').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image(); const url = URL.createObjectURL(f);
    img.onload = () => { const s = Math.min(1, 160 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); A._logo = c.toDataURL('image/png'); $('#lgPrev').innerHTML = `<img src="${A._logo}" style="max-width:100%;max-height:100%">`; URL.revokeObjectURL(url); };
    img.onerror = () => toast('Görsel okunamadı.'); img.src = url;
  });
  A._logo = undefined;
};
A.brandPick = (el) => { $('#brCol').value = el.dataset.c; document.documentElement.style.setProperty('--primary', el.dataset.c); };
A.brandNoLogo = () => { A._logo = ''; $('#lgPrev').innerHTML = '<span class="muted" style="font-size:12px">yok</span>'; };
A.brandSave = async (el) => {
  el.disabled = true;
  const b = { ...(S.settings.brand || {}), color: $('#brCol').value }; if (A._logo !== undefined) b.logo = A._logo;
  try { const { id, ...rest } = S.settings; await S.store.save('settings', { ...rest, id: 'main', brand: b }); toast('Marka kaydedildi'); closeModal(); } catch (e) { toast(errText(e)); el.disabled = false; }
};
document.addEventListener('click', (e) => { if (e.target.closest('[data-act=closeModal]') && document.querySelector('#brCol')) setTimeout(() => A._applyBrand && A._applyBrand(), 0); }, true);
