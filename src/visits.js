// Ziyaret planı: acente / firma ziyaretlerini planla, yapıldığında sonucu gir (aktivite ve takip görevi kendiliğinden açılır)
import * as XLSX from 'xlsx';
import { S, A, V, $, esc, ic, today, addDays, fmtDate, fmtNum, MONTHS, toast, can, sortBy, byId, userName, openForm, stamp, lastContact, ACC_TYPES, confirmBox } from './core.js';
import { printHtml, saveFile } from './print.js';
import { oppForm } from './forms.js';

export const VISIT_KIND = { ziyaret: 'Yüz yüze ziyaret', online: 'Online görüşme', fuar: 'Fuar / etkinlik', davet: 'Otele davet (site inspection)' };
export const VISIT_STATUS = { plan: 'Planlandı', yapildi: 'Yapıldı', ertelendi: 'Ertelendi', iptal: 'İptal' };
const ST_BADGE = { plan: 'teal', yapildi: 'olive', ertelendi: 'gold', iptal: 'red' };
const D = () => S.data;
const userOpts = () => { const l = (D().users || []).filter((u) => u.active !== false && ['yonetici', 'satis'].includes(u.role)).map((u) => [u.id, u.name]); return l.length ? l : [[S.user.uid, S.user.name]]; };
const accOpts = () => sortBy(D().accounts || [], (a) => (a.name || '').toLocaleLowerCase('tr-TR')).map((a) => [a.id, a.name]);
const accName = (v) => { const a = byId('accounts', v.accountId); return a ? a.name : v.accountName || '—'; };
const weekStart = (d) => { const x = new Date(d + 'T12:00:00'); const off = (x.getDay() + 6) % 7; return addDays(d, -off); };

export function visitForm(rec, preset = {}) {
  openForm({
    title: rec ? 'Ziyareti düzenle' : 'Ziyaret planla',
    data: rec || { kind: 'ziyaret', status: 'plan', date: addDays(today(), 1), ownerId: S.user.uid, ...preset },
    fields: [
      { k: 'accountId', label: 'Acente / firma', type: 'select', opts: accOpts(), req: true },
      { k: 'date', label: 'Tarih', type: 'date', req: true, half: true },
      { k: 'time', label: 'Saat', type: 'time', half: true },
      { k: 'kind', label: 'Tür', type: 'select', opts: Object.entries(VISIT_KIND), req: true, half: true },
      { k: 'ownerId', label: 'Ziyareti yapacak', type: 'select', opts: userOpts(), req: true, half: true },
      { k: 'contact', label: 'Görüşülecek kişi', ph: 'ör. Satış müdürü Ayşe Hanım', half: true },
      { k: 'place', label: 'Yer / şehir', ph: 'ör. İstanbul ofis', half: true },
      { k: 'purpose', label: 'Amaç', req: true, ph: 'ör. 2027 kontrat görüşmesi, MICE fırsatları' },
      { k: 'prep', label: 'Hazırlık notu', type: 'textarea', hint: 'Götürülecek materyal, sunulacak fiyatlar, konuşulacak konular.' },
      ...(rec ? [{ k: 'status', label: 'Durum', type: 'select', opts: Object.entries(VISIT_STATUS), req: true }] : []),
    ],
    onSave: async (v) => {
      const a = byId('accounts', v.accountId);
      await S.store.save('visits', stamp({ ...(rec || {}), ...v, status: v.status || (rec && rec.status) || 'plan', accountName: a ? a.name : '', ownerName: userName(v.ownerId) }));
      toast(rec ? 'Kaydedildi' : 'Ziyaret planlandı');
    },
    onDelete: rec && (can.admin() || rec.createdBy === S.user.uid) ? async () => { await S.store.remove('visits', rec.id); toast('Silindi'); } : null,
  });
}
// ziyaret yapıldı: sonuç + aktivite + takip görevi
function doneForm(rec) {
  openForm({
    title: `Ziyaret sonucu · ${accName(rec)}`,
    intro: `<p class="muted" style="margin:0 0 8px">${esc(fmtDate(rec.date))} · ${esc(rec.purpose || '')}</p>`,
    data: { date: rec.date, result: rec.result || '', outcome: rec.outcome || '' },
    fields: [
      { k: 'date', label: 'Yapıldığı tarih', type: 'date', req: true, half: true },
      { k: 'outcome', label: 'Sonuç', type: 'select', opts: [['olumlu', 'Olumlu, fırsat var'], ['takip', 'Takip gerekli'], ['notr', 'Bilgilendirme'], ['olumsuz', 'Olumsuz']], req: true, half: true },
      { k: 'result', label: 'Görüşme notu', type: 'textarea', req: true, ph: 'Kimlerle görüşüldü, ne konuşuldu, talepler, fiyat beklentisi…' },
      { k: 'next', label: 'Sonraki adım', ph: 'ör. 2027 fiyat teklifi gönderilecek' },
      { k: 'followUp', label: 'Takip tarihi', type: 'date', hint: 'Doldurursanız size takip görevi açılır.' },
      { k: 'opp', label: 'Bu ziyaretten talep açılsın mı?', type: 'select', opts: [['', 'Hayır'], ['evet', 'Evet, grup / etkinlik talebi aç']] },
    ],
    saveLabel: 'Yapıldı olarak kaydet',
    onSave: async (v) => {
      const a = byId('accounts', rec.accountId);
      const link = a ? { ref: { col: 'accounts', id: a.id }, refName: a.name } : {};
      await S.store.save('activities', stamp({ ...link, type: rec.kind === 'online' ? 'toplanti' : rec.kind === 'fuar' ? 'fuar' : 'ziyaret', date: v.date, subject: rec.purpose || 'Satış ziyareti', note: [v.result, v.next ? 'Sonraki adım: ' + v.next : ''].filter(Boolean).join('\n'), userId: rec.ownerId || S.user.uid, userName: rec.ownerName || userName(rec.ownerId) || S.user.name, visitId: rec.id }));
      if (v.followUp) await S.store.save('tasks', stamp({ ...link, title: 'Ziyaret takibi: ' + (v.next || rec.purpose || accName(rec)), due: v.followUp, done: false, assigneeId: rec.ownerId || S.user.uid, priority: v.outcome === 'olumlu' ? 'yuksek' : 'normal' }));
      await S.store.save('visits', stamp({ ...rec, status: 'yapildi', doneDate: v.date, result: v.result, outcome: v.outcome, next: v.next }));
      toast('Ziyaret kaydedildi; aktivite eklendi');
      if (v.opp === 'evet') setTimeout(() => oppForm(null, { accountId: rec.accountId, source: 'Satış ziyareti' }), 250);
    },
  });
}

/* ---------- liste ---------- */
S.vis = S.vis || { f: 'hafta', month: today().slice(0, 7), owner: '' };
const OUT = { olumlu: ['Olumlu', 'olive'], takip: ['Takip', 'gold'], notr: ['Bilgi', 'teal'], olumsuz: ['Olumsuz', 'red'] };
function visitsOf() {
  const t = today(); const ws = weekStart(t); const F = S.vis;
  let l = (D().visits || []).slice();
  if (F.owner) l = l.filter((v) => v.ownerId === F.owner);
  if (F.f === 'hafta') l = l.filter((v) => v.date >= ws && v.date <= addDays(ws, 6));
  else if (F.f === 'gelecek') l = l.filter((v) => v.status === 'plan' && v.date >= t);
  else if (F.f === 'gecikmis') l = l.filter((v) => v.status === 'plan' && v.date < t);
  else if (F.f === 'ay') l = l.filter((v) => (v.date || '').startsWith(F.month));
  else if (F.f === 'yapildi') l = l.filter((v) => v.status === 'yapildi');
  return sortBy(l, (v) => (v.date || '') + (v.time || ''), F.f === 'yapildi' ? -1 : 1);
}
const visitRow = (v) => {
  const late = v.status === 'plan' && v.date < today(); const o = OUT[v.outcome];
  return `<div class="row vrow"><div class="dt"><b>${esc((v.date || '').slice(8, 10))}</b><span>${esc(MONTHS[Number((v.date || '').slice(5, 7)) - 1] ? MONTHS[Number(v.date.slice(5, 7)) - 1].slice(0, 3) : '')}</span></div>
    <button class="t" data-act="visitEdit" data-id="${v.id}" style="border:0;background:none;text-align:left;padding:0;cursor:pointer"><b>${esc(accName(v))}${v.time ? ` <span class="muted" style="font-weight:400">· ${esc(v.time)}</span>` : ''}</b><span>${esc(v.purpose || '')}${v.place ? ' · ' + esc(v.place) : ''} · ${esc(VISIT_KIND[v.kind] || '')} · ${esc(v.ownerName || userName(v.ownerId))}</span>${v.status === 'yapildi' && v.result ? `<span class="vres">${esc(v.result.slice(0, 160))}${v.result.length > 160 ? '…' : ''}</span>` : ''}</button>
    <div class="vact">${late ? '<span class="badge red">Gecikti</span>' : `<span class="badge ${ST_BADGE[v.status] || ''}">${esc(VISIT_STATUS[v.status] || '')}</span>`}${o ? ` <span class="badge ${o[1]}">${o[0]}</span>` : ''}
      ${v.status === 'plan' && can.edit('accounts') ? `<button class="btn sm pri" data-act="visitDone" data-id="${v.id}">${ic('check')} Yapıldı</button>` : ''}</div></div>`;
};
V.visits = {
  title: () => 'Ziyaret planı',
  head: () => `<button class="btn" data-act="visitPrint">${ic('printer')}<span class="hide-m"> Plan PDF</span></button><button class="btn" data-act="visitExcel">${ic('table')}<span class="hide-m"> Excel</span></button>${can.edit('accounts') ? `<button class="btn" data-act="visitSuggest">${ic('briefcase')}<span class="hide-m"> Öneriler</span></button><button class="btn pri" data-act="visitNew">${ic('plus')} Ziyaret planla</button>` : ''}`,
  body: () => {
    const F = S.vis; const t = today(); const all = D().visits || [];
    const n = (fn) => all.filter(fn).length; const ws = weekStart(t);
    const list = visitsOf(); const ms = F.month;
    const monthDone = all.filter((v) => v.status === 'yapildi' && (v.doneDate || v.date || '').startsWith(t.slice(0, 7))).length;
    const monthPlan = all.filter((v) => (v.date || '').startsWith(t.slice(0, 7)) && v.status !== 'iptal').length;
    const users = userOpts();
    const groups = {}; list.forEach((v) => { const k = F.f === 'yapildi' || F.f === 'ay' ? (v.date || '').slice(0, 7) : weekStart(v.date || t); (groups[k] = groups[k] || []).push(v); });
    const gLabel = (k) => (k.length === 7 ? `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}` : k === ws ? 'Bu hafta' : k === addDays(ws, 7) ? 'Gelecek hafta' : `${fmtDate(k)} haftası`);
    return `<div class="kband" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        <button class="kb" data-act="visF" data-f="hafta"><small>Bu hafta</small><b>${n((v) => v.date >= ws && v.date <= addDays(ws, 6) && v.status !== 'iptal')}</b><em>${n((v) => v.date >= ws && v.date <= addDays(ws, 6) && v.status === 'yapildi')} yapıldı</em></button>
        <div class="kb"><small>${MONTHS[Number(t.slice(5, 7)) - 1]} · yapılan / planlanan</small><b>${monthDone} / ${monthPlan}</b><em>${monthPlan ? `%${Math.round((monthDone / monthPlan) * 100)} tamamlandı` : 'plan yok'}</em></div>
        <button class="kb ${n((v) => v.status === 'plan' && v.date < t) ? 'warn' : ''}" data-act="visF" data-f="gecikmis"><small>Geciken ziyaret</small><b>${n((v) => v.status === 'plan' && v.date < t)}</b><em>sonucu girilmemiş</em></button>
        <div class="kb"><small>60 günü geçen temas</small><b>${(D().accounts || []).filter((a) => a.status === 'aktif' && (!lastContact(a.id) || lastContact(a.id) < addDays(t, -60))).length}</b><em>aktif acente / firma</em></div></div>
      <div class="perfbar"><div class="seg" role="group" aria-label="Filtre">${[['hafta', 'Bu hafta'], ['gelecek', 'Planlanan'], ['gecikmis', 'Geciken'], ['ay', 'Ay'], ['yapildi', 'Yapılan']].map(([k, l]) => `<button class="${F.f === k ? 'on' : ''}" data-act="visF" data-f="${k}" aria-pressed="${F.f === k}">${l}</button>`).join('')}</div>
        ${F.f === 'ay' ? `<input type="month" class="inp" style="width:auto" value="${esc(ms)}" data-change="visMonth" aria-label="Ay">` : ''}
        ${users.length > 1 ? `<select class="inp" style="width:auto" data-change="visOwner" aria-label="Kişi"><option value="">Tüm ekip</option>${users.map(([id, nm]) => `<option value="${id}" ${F.owner === id ? 'selected' : ''}>${esc(nm)}</option>`).join('')}</select>` : ''}</div>
      ${list.length ? Object.entries(groups).map(([k, arr]) => `<h4 class="grp">${esc(gLabel(k))} <span class="muted">${arr.length}</span></h4><div class="card list">${arr.map(visitRow).join('')}</div>`).join('') : `<div class="card empty"><b>Bu görünümde ziyaret yok</b>Acente ve firmalara yapacağınız ziyaretleri planlayın; yapıldığında sonucu girin, görüşme notu acentenin geçmişine kendiliğinden eklenir.${can.edit('accounts') ? `<div><button class="btn pri" data-act="visitNew">${ic('plus')} Ziyaret planla</button> <button class="btn" data-act="visitSuggest">Kimi ziyaret etmeli?</button></div>` : ''}</div>`}`;
  },
};
A.visF = (el) => { S.vis.f = el.dataset.f; A._renderView(); };
A.visMonth = (el) => { S.vis.month = el.value || today().slice(0, 7); A._renderView(); };
A.visOwner = (el) => { S.vis.owner = el.value; A._renderView(); };
A.visitNew = (el) => visitForm(null, el && el.dataset && el.dataset.acc ? { accountId: el.dataset.acc } : {});
A.visitEdit = (el) => { const v = (D().visits || []).find((x) => x.id === el.dataset.id); if (v) (v.status === 'plan' || !can.edit('accounts') ? visitForm(v) : doneForm(v)); };
A.visitDone = (el) => { const v = (D().visits || []).find((x) => x.id === el.dataset.id); if (v) doneForm(v); };
A.visitSuggest = () => {
  const t = today(); const planned = new Set((D().visits || []).filter((v) => v.status === 'plan' && v.date >= t).map((v) => v.accountId));
  const rows = sortBy((D().accounts || []).filter((a) => a.status !== 'pasif' && !planned.has(a.id)).map((a) => {
    const lc = lastContact(a.id); const won = (D().opps || []).filter((o) => o.accountId === a.id && o.stage === 'kazanildi').length;
    const ce = a.contractEnd && a.contractEnd >= t && a.contractEnd <= addDays(t, 90);
    const score = (lc ? Math.min(180, (new Date(t) - new Date(lc)) / 864e5) : 200) + won * 15 + (ce ? 120 : 0) + (a.status === 'aktif' ? 30 : 0);
    return { a, lc, won, ce, score };
  }), (x) => x.score, -1).slice(0, 12);
  $('#modal').innerHTML = `<div class="ov center"><div class="modal"><div class="mh"><h2>Kimi ziyaret etmeli?</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div><div class="mb">
    <p class="muted" style="margin-top:0">Uzun süredir temas kurulmayan, kontratı yaklaşan ve iş getiren acenteler öne çıkar. Planlı ziyareti olanlar listede yok.</p>
    ${rows.length ? `<div class="list">${rows.map(({ a, lc, won, ce }) => `<div class="row"><div class="t"><b>${esc(a.name)}</b><span>${esc(ACC_TYPES[a.type] || '')}${a.city ? ' · ' + esc(a.city) : ''} · ${lc ? 'son temas ' + esc(fmtDate(lc)) : 'hiç temas yok'}${won ? ` · ${won} kesinleşen` : ''}${ce ? ` · <b style="color:#B4432E">kontrat ${esc(fmtDate(a.contractEnd))}</b>` : ''}</span></div><button class="btn sm" data-act="visitNew" data-acc="${a.id}">${ic('plus')} Planla</button></div>`).join('')}</div>` : '<p class="muted">Önerilecek acente yok.</p>'}</div>
    <div class="mf"><button class="btn" data-act="closeModal">Kapat</button></div></div></div>`;
};
const planRows = () => visitsOf();
A.visitPrint = () => {
  const l = planRows(); if (!l.length) return toast('Yazdırılacak ziyaret yok.');
  const title = { hafta: 'Bu haftanın ziyaret planı', gelecek: 'Planlanan ziyaretler', gecikmis: 'Geciken ziyaretler', ay: `${MONTHS[Number(S.vis.month.slice(5, 7)) - 1]} ${S.vis.month.slice(0, 4)} ziyaret planı`, yapildi: 'Yapılan ziyaretler (sales call raporu)' }[S.vis.f];
  printHtml(title, `<div class="pdoc"><div class="ph"><b>${esc(S.settings.hotelName)}</b><span>${esc(fmtDate(today()))} · ${esc(S.user.name)}</span></div><h1>${esc(title)}</h1><p class="sub">${l.length} ziyaret${S.vis.owner ? ' · ' + esc(userName(S.vis.owner)) : ''}</p>
    <table class="tb"><tr><th>Tarih</th><th>Acente / firma</th><th>Tür</th><th>Amaç</th><th>Kişi</th><th>Durum</th><th>Sonuç / not</th></tr>${l.map((v) => `<tr><td>${esc(fmtDate(v.date))}${v.time ? '<br>' + esc(v.time) : ''}</td><td><b>${esc(accName(v))}</b>${v.contact ? '<br>' + esc(v.contact) : ''}${v.place ? '<br>' + esc(v.place) : ''}</td><td>${esc(VISIT_KIND[v.kind] || '')}</td><td>${esc(v.purpose || '')}${v.prep ? `<br><small>${esc(v.prep)}</small>` : ''}</td><td>${esc(v.ownerName || userName(v.ownerId))}</td><td>${esc(VISIT_STATUS[v.status] || '')}${OUT[v.outcome] ? '<br>' + OUT[v.outcome][0] : ''}</td><td>${esc(v.result || '')}${v.next ? `<br><b>Sonraki adım:</b> ${esc(v.next)}` : ''}</td></tr>`).join('')}</table></div>`);
};
A.visitExcel = () => {
  const l = sortBy(D().visits || [], (v) => v.date || ''); if (!l.length) return toast('Aktarılacak ziyaret yok.');
  const rows = [['Tarih', 'Saat', 'Acente / firma', 'Görüşülen', 'Yer', 'Tür', 'Amaç', 'Ziyareti yapan', 'Durum', 'Sonuç', 'Görüşme notu', 'Sonraki adım'], ...l.map((v) => [v.date, v.time || '', accName(v), v.contact || '', v.place || '', VISIT_KIND[v.kind] || '', v.purpose || '', v.ownerName || userName(v.ownerId), VISIT_STATUS[v.status] || '', OUT[v.outcome] ? OUT[v.outcome][0] : '', v.result || '', v.next || ''])];
  const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = rows[0].map((h, i) => ({ wch: [11, 6, 26, 18, 14, 16, 30, 16, 11, 10, 50, 30][i] })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Ziyaretler');
  saveFile(`Ziyaret-plani-${today()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
};
// acente detayına ve takvime
A._visitsOfAcc = (accId) => sortBy((D().visits || []).filter((v) => v.accountId === accId), (v) => v.date || '', -1);
A._visitCalEvents = (day) => (D().visits || []).filter((v) => v.date === day && v.status !== 'iptal').map((v) => `<button class="ev v" data-act="visitEdit" data-id="${v.id}">◆ ${esc(accName(v))}</button>`);
