// Belgeler (kontrat vb.): Firestore'da parçalı saklanır — ücretsiz planda ek depolama hizmeti gerekmez.
import { S, A, $, esc, ic, today, fmtDate, iso, byId, recTitle, toast, errText, confirmBox, can, sortBy, fmtSize, openForm, closeModal } from './core.js';
import { saveFile } from './print.js';

const RAW_CHUNK = 700000;            // ~933 KB base64; Firestore belge sınırı 1 MiB
const MAX = 10 * 1024 * 1024;        // 10 MB
export const DOC_KINDS = { kontrat: 'Kontrat', sozlesme: 'İmzalı sözleşme', fiyat: 'Fiyat listesi', teklif: 'Teklif', fatura: 'Fatura / dekont', diger: 'Diğer' };
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic,application/pdf,image/*';

const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (b) => { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const canFiles = (col) => can.edit(col) && S.user.role !== 'onburo';

export const filesOf = (col, id) => sortBy(S.data.files.filter((f) => f.ref && f.ref.col === col && f.ref.id === id), (f) => f.createdAt || 0, -1);
const fileIcon = (f) => (/pdf/.test(f.type) ? 'PDF' : /image/.test(f.type) ? 'IMG' : /word|docx?$/.test(f.type + f.name) ? 'DOC' : /sheet|xlsx?$/.test(f.type + f.name) ? 'XLS' : 'DOS');

export function filesCard(col, id) {
  const fs = filesOf(col, id); const ed = canFiles(col);
  const label = col === 'accounts' ? 'Kontrat yükle' : col === 'weddings' ? 'Sözleşme / belge yükle' : 'Belge yükle';
  return `<div class="card"><div class="pad" style="padding-bottom:4px;display:flex;align-items:center;gap:8px"><h3 style="margin:0;flex:1">Belgeler</h3>${ed ? `<button class="btn sm pri" data-act="fileUp" data-col="${col}" data-id="${id}">${ic('upload')} ${label}</button>` : ''}</div>
    ${fs.length ? `<div class="list">${fs.map((f) => `<div class="row"><div class="av" style="font-size:11px">${fileIcon(f)}</div>
      <div class="t"><b>${esc(f.title || f.name)}</b><span>${esc([DOC_KINDS[f.kind] || '', f.validTo ? 'Geçerlilik ' + [fmtDate(f.validFrom), fmtDate(f.validTo)].filter(Boolean).join(' – ') : '', fmtSize(f.size), fmtDate(iso(new Date(f.createdAt || Date.now()))), f.uploadedByName].filter(Boolean).join(' · '))}</span>${f.note ? `<span>${esc(f.note)}</span>` : ''}</div>
      <div class="acts">${!window.Android ? `<button class="btn sm" data-act="fileOpen" data-id="${f.id}">Aç</button>` : ''}<button class="btn sm" data-act="fileGet" data-id="${f.id}" aria-label="İndir" title="İndir">${ic('download')}</button>${can.admin() || (ed && f.uploadedBy === S.user.uid) ? `<button class="x" data-act="fileDel" data-id="${f.id}" aria-label="Sil" title="Sil">${ic('x')}</button>` : ''}</div></div>`).join('')}</div>`
    : `<div class="pad muted" style="padding-top:8px">${col === 'accounts' ? 'Kontrat ya da fiyat listesi yüklenmemiş.' : 'Belge yüklenmemiş.'} PDF, Word, Excel ya da fotoğraf · en fazla 10 MB.</div>`}</div>`;
}

let up = null;
A.fileUp = (el) => { up = { col: el.dataset.col, id: el.dataset.id }; const i = $('#attachFile'); i.value = ''; i.accept = ACCEPT; i.click(); };
export function handleAttach(input) {
  const file = input.files && input.files[0]; if (!file || !up) return;
  if (file.size > MAX) { toast(`Dosya çok büyük (${fmtSize(file.size)}). En fazla 10 MB yüklenebilir.`); return; }
  const rec = byId(up.col, up.id);
  const isAcc = up.col === 'accounts';
  openForm({
    title: 'Belge yükle', saveLabel: 'Yükle',
    intro: `<p style="margin-top:0"><b>${esc(file.name)}</b> <span class="muted">· ${fmtSize(file.size)}</span></p>`,
    data: { kind: isAcc ? 'kontrat' : up.col === 'weddings' ? 'sozlesme' : 'teklif', title: file.name.replace(/\.[^.]+$/, ''), validFrom: isAcc ? (rec.contractStart || '') : '', validTo: isAcc ? (rec.contractEnd || '') : '' },
    fields: [
      { k: 'kind', label: 'Belge türü', type: 'select', opts: Object.entries(DOC_KINDS), req: true, half: true },
      { k: 'title', label: 'Başlık', req: true, half: true },
      ...(isAcc ? [{ k: 'validFrom', label: 'Geçerlilik başlangıç', type: 'date', half: true }, { k: 'validTo', label: 'Geçerlilik bitiş', type: 'date', half: true },
        { k: 'setContract', label: 'Acente kartındaki kontrat tarihleri', type: 'select', opts: [['evet', 'Bu tarihlerle güncellensin'], ['hayir', 'Değişmesin']], half: true, def: 'evet' }] : []),
      { k: 'note', label: 'Not', type: 'textarea' },
    ],
    onSave: async (v) => {
      const { col, id } = up;
      const u8 = new Uint8Array(await file.arrayBuffer());
      const n = Math.max(1, Math.ceil(u8.length / RAW_CHUNK));
      const fid = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      for (let i = 0; i < n; i++) {
        toast(n > 1 ? `Yükleniyor… ${i + 1}/${n}` : 'Yükleniyor…');
        await S.store.save('fileChunks', { id: `${fid}_${i}`, fileId: fid, i, data: toB64(u8.subarray(i * RAW_CHUNK, (i + 1) * RAW_CHUNK)), uploadedBy: S.user.uid });
      }
      const meta = { id: fid, name: file.name, type: file.type || '', size: file.size, chunks: n, kind: v.kind, title: v.title, note: v.note, validFrom: v.validFrom || '', validTo: v.validTo || '',
        ref: { col, id }, refName: recTitle(col, byId(col, id)), uploadedBy: S.user.uid, uploadedByName: S.user.name, createdAt: Date.now() };
      await S.store.save('files', meta);
      if (isAcc && v.setContract === 'evet' && (v.validFrom || v.validTo)) {
        const a = byId('accounts', id);
        await S.store.save('accounts', { ...a, contractStart: v.validFrom || a.contractStart || '', contractEnd: v.validTo || a.contractEnd || '', updatedAt: Date.now(), updatedBy: S.user.uid, updatedByName: S.user.name });
      }
      toast('Belge yüklendi');
    },
  });
}
async function load(id) {
  const f = byId('files', id); if (!f) throw new Error('Belge bulunamadı');
  toast('Belge açılıyor…');
  const parts = [];
  for (let i = 0; i < f.chunks; i++) { const c = await S.store.get('fileChunks', `${f.id}_${i}`); if (!c) throw new Error('Belgenin bir parçası eksik'); parts.push(fromB64(c.data)); }
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; parts.forEach((p) => { out.set(p, o); o += p.length; });
  return { f, u8: out };
}
A.fileGet = async (el) => { try { const { f, u8 } = await load(el.dataset.id); saveFile(f.name, f.type || 'application/octet-stream', u8); } catch (e) { toast(errText(e)); } };
A.fileOpen = async (el) => {
  const w = window.open('', '_blank');
  try {
    const { f, u8 } = await load(el.dataset.id);
    const url = URL.createObjectURL(new Blob([u8], { type: f.type || 'application/octet-stream' }));
    if (w) w.location.href = url; else saveFile(f.name, f.type, u8);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { if (w) w.close(); toast(errText(e)); }
};
A.fileDel = (el) => {
  const f = byId('files', el.dataset.id); if (!f) return;
  confirmBox(`"${f.title || f.name}" kalıcı olarak silinecek.`, 'Sil', async () => {
    await S.store.remove('files', f.id);
    for (let i = 0; i < f.chunks; i++) { try { await S.store.remove('fileChunks', `${f.id}_${i}`); } catch (e) { /* devam */ } }
    toast('Belge silindi');
  });
};
