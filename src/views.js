import {
  S, A, V, $, $$, esc, ic, ACC_TYPES, ACC_STATUS, OPP_KINDS, OPP_STAGES, WED_STAGES, ACT_TYPES, ACT_ICON, ROLES, STAGE_BADGE,
  today, addDays, iso, MONTHS, MON3, fmtDate, fmtDateLong, fmtRange, money, moneyMap, sumByCur, num, fmtNum, match, initials, waNum,
  byId, userName, stageLabel, sortBy, wedTotal, recTitle, related, relTasks, lastContact, can, toast, stamp, errText, COL_LABEL, openForm, EINV, copyText,
  occasionsOn, guestOccasions, nextOccurrence, yearsSince, priceRows, recTotals,
} from './core.js';
import { accountForm, guestForm, oppForm, weddingForm, activityForm, taskForm, refLabel } from './forms.js';

export const NAV = [
  ['pano', 'Pano', 'house'], ['accounts', 'Acenteler', 'building'], ['guests', 'Misafirler', 'users'], ['cel', 'Kutlamalar', 'cake'], ['black', 'Kara liste', 'ban'], ['opps', 'Grup & Etkinlik', 'handshake'],
  ['weddings', 'Düğün Teklifleri', 'heart'], ['tasks', 'Görevler', 'list'], ['cal', 'Takvim', 'calendar'], ['reports', 'Raporlar', 'chart'], ['settings', 'Ayarlar', 'settings'],
];
const TABS = [['pano', 'Pano', 'house'], ['accounts', 'Acenteler', 'building'], ['opps', 'Talepler', 'handshake'], ['weddings', 'Düğün', 'heart']];

const D = () => S.data;
const openOpps = () => D().opps.filter((o) => !['kazanildi', 'kaybedildi'].includes(o.stage));
const overdue = () => D().tasks.filter((t) => !t.done && t.due && t.due < today());
const myOpen = () => D().tasks.filter((t) => !t.done && t.assigneeId === S.user.uid);
const badge = (list, k) => `<span class="badge ${STAGE_BADGE[k] || ''}">${esc(stageLabel(list, k))}</span>`;
const empty = (title, text, btn = '') => `<div class="card empty"><b>${esc(title)}</b>${esc(text)}${btn ? `<div>${btn}</div>` : ''}</div>`;
const addBtn = (act, label, col) => (can.edit(col) ? `<button class="btn pri" data-act="${act}">${ic('plus')} ${esc(label)}</button>` : '');
const chip = (key, val, label, count) => `<button class="chip ${(S.f[key] || '') === val ? 'on' : ''}" data-act="filter" data-k="${key}" data-v="${val}">${esc(label)}${count != null ? `<i>${count}</i>` : ''}</button>`;
const searchBox = (ph) => `<label class="search">${ic('search')}<input type="search" data-search placeholder="${esc(ph)}" value="${esc(S.q)}" aria-label="${esc(ph)}"></label>`;
const dateBox = (s) => { if (!s) return '<div class="datebox"><b>—</b><span>tarih</span></div>'; const [y, m, d] = s.split('-').map(Number); return `<div class="datebox"><b>${d}</b><span>${MON3[m - 1]} ${String(y).slice(2)}</span></div>`; };

/* ================= kabuk ================= */
export function renderShell() {
  const od = overdue().length;
  const navBtn = ([k, l, i]) => `<button class="${S.view === k ? 'on' : ''}" data-act="nav" data-v="${k}">${ic(i)}<span>${l}</span>${k === 'tasks' && od ? `<span class="badge red">${od}</span>` : ''}</button>`;
  $('#app').innerHTML = `
    <aside class="side"><div class="brand"><b>${esc(S.settings.hotelName)}</b><span>Müşteri İlişkileri</span></div>
      <nav class="nav">${NAV.map(navBtn).join('')}</nav>
      <div class="who"><b>${esc(S.user.name)}</b>${esc(ROLES[S.user.role] || '')}${S.store.kind === 'local' ? ' · demo' : ''}<br>${S.store.kind === 'firebase' ? '<button data-act="logout">Çıkış yap</button>' : ''}</div>
    </aside>
    <main><div id="view"></div></main>
    <nav class="tabbar">${TABS.map(([k, l, i]) => `<button class="${S.view === k ? 'on' : ''}" data-act="nav" data-v="${k}">${ic(i)}${l}</button>`).join('')}
      <button class="${TABS.some((t) => t[0] === S.view) ? '' : 'on'}" data-act="menu">${ic('menu')}Menü</button></nav>`;
  renderView();
}
export function renderView() {
  const v = V[S.view] || V.pano;
  $('#view').innerHTML = `<div class="head"><h1>${esc(v.title())}</h1>${v.head ? v.head() : ''}</div>${v.chips ? `<div class="chips">${v.chips()}</div>` : ''}<div id="body"></div>`;
  renderBody();
}
export function renderBody() {
  const b = $('#body'); if (!b) return;
  const v = V[S.view] || V.pano;
  b.innerHTML = v.body();
}
let raf = 0;
export function refresh() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    if (S.gate !== 'in' || !$('#view')) return;
    const v = V[S.view] || V.pano;
    const c = $('#view .chips'); if (c && v.chips) c.innerHTML = v.chips();
    if (v.headLive) { const h = $('#view .head'); if (h) h.innerHTML = `<h1>${esc(v.title())}</h1>${v.head ? v.head() : ''}`; }
    renderBody(); renderSheet();
    const nb = $$('.nav button').find((x) => x.dataset.v === 'tasks');
    if (nb) { const od = overdue().length; const old = $('.badge', nb); if (old) old.remove(); if (od) nb.insertAdjacentHTML('beforeend', `<span class="badge red">${od}</span>`); }
  });
}
A._refresh = refresh;
A._renderView = () => renderView();
A.nav = (el) => { S.view = el.dataset.v; S.q = ''; S.f = {}; S.sheet = null; $('#modal').innerHTML = ''; renderSheet(); renderShell(); window.scrollTo(0, 0); };
A.menu = () => {
  $('#modal').innerHTML = `<div class="ov center"><div class="modal"><div class="mh"><h2>Menü</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb"><div class="menu-grid grid g2">${NAV.map(([k, l, i]) => `<button class="btn" data-act="nav" data-v="${k}">${ic(i)} ${l}</button>`).join('')}</div>
    <p class="muted" style="margin:14px 0 0">${esc(S.user.name)} · ${esc(ROLES[S.user.role] || '')}</p></div>
    ${S.store.kind === 'firebase' ? `<div class="mf"><button class="btn" data-act="logout">${ic('logout')} Çıkış yap</button></div>` : ''}</div></div>`;
};
A.filter = (el) => { S.f[el.dataset.k] = el.dataset.v; refresh(); };
A.open = (el) => { S.sheet = { col: el.dataset.col, id: el.dataset.id }; renderSheet(); };
A.closeSheet = () => { S.sheet = null; renderSheet(); };
A.newAccount = () => accountForm(); A.newGuest = () => guestForm(); A.newOpp = () => oppForm(); A.newWedding = () => weddingForm();
A.newTask = () => taskForm(); A.newActivity = () => activityForm();
A.edit = (el) => { const r = byId(el.dataset.col, el.dataset.id); if (!r) return; if (el.dataset.col === 'blacklist') return A.blEdit(el); ({ accounts: accountForm, guests: guestForm, opps: oppForm, weddings: weddingForm })[el.dataset.col](r); };
A.addAct = (el) => activityForm(el.dataset.col, el.dataset.id);
A.addTask = (el) => taskForm(el.dataset.col, el.dataset.id);
A.addOppFor = (el) => { const a = byId('accounts', el.dataset.id); oppForm(null, { accountId: a.id, contactName: (a.contacts && a.contacts[0] && a.contacts[0].name) || '', phone: (a.contacts && a.contacts[0] && a.contacts[0].phone) || a.phone || '' }); };
A.editAct = (el) => { const r = byId('activities', el.dataset.id); if (r && (can.admin() || r.userId === S.user.uid)) activityForm(null, null, r); };
A.editTask = (el) => { const r = byId('tasks', el.dataset.id); if (r && can.edit('tasks')) taskForm(null, null, r); };
A.toggleTask = async (el) => {
  const t = byId('tasks', el.dataset.id); if (!t || !can.edit('tasks')) return;
  try { await S.store.save('tasks', stamp({ ...t, done: !t.done, doneAt: !t.done ? Date.now() : null })); } catch (e) { toast(errText(e)); }
};
A.setStage = async (el) => {
  const col = el.dataset.col; const r = byId(col, el.dataset.id); const st = el.value || el.dataset.v;
  if (!r || !can.edit(col) || r.stage === st) return;
  const apply = async (extra = {}) => { await S.store.save(col, stamp({ ...r, ...extra, stage: st, stageAt: Date.now() })); toast('Aşama güncellendi'); };
  if (st === 'kaybedildi') {
    openForm({ title: 'Kayıp nedeni', saveLabel: 'Kaybedildi olarak işaretle', data: { lossReason: r.lossReason || '' },
      fields: [{ k: 'lossReason', label: 'Neden kaybedildi?', ph: 'ör. Fiyat, tarih dolu, rakip mekân, vazgeçti' }], onSave: (v) => apply(v) });
    refresh(); return;
  }
  try { await apply(); if (st === 'teklif' && A.offer) setTimeout(() => A.offer({ dataset: { col, id: r.id } }), 120); } catch (e) { toast(errText(e)); refresh(); }
};


/* ================= süzülmüş listeler (ekran ve çıktı ortak) ================= */
export const LIST = {
  accounts: () => sortBy(D().accounts.filter((a) => (!S.f.type || a.type === S.f.type) && (!S.f.status || a.status === S.f.status) && match(S.q, a.name, a.city, a.country, a.market, a.email, ...(a.contacts || []).map((c) => c.name))), (a) => a.name.toLocaleLowerCase('tr-TR')),
  guests: () => { const sp = new Set(specialDays(30).map((x) => x.g.id)); return sortBy(D().guests.filter((g) => (S.f.g === 'vip' ? isVip(g) : S.f.g === 'repeat' ? (g.stays || []).length > 1 : S.f.g === 'special' ? sp.has(g.id) : true) && match(S.q, g.name, g.phone, g.email, g.city, g.country, (g.tags || []).join(' '))), (g) => g.name.toLocaleLowerCase('tr-TR')); },
  opps: () => D().opps.filter((o) => (!S.f.kind || o.kind === S.f.kind) && match(S.q, o.title, o.contactName, (byId('accounts', o.accountId) || {}).name)),
  weddings: () => sortBy(D().weddings.filter((w) => (!S.f.ws || w.stage === S.f.ws) && (!S.f.wy || (w.date || '').startsWith(S.f.wy)) && match(S.q, w.couple, w.phone, w.email)), (w) => w.date || '9999'),
  tasks: () => { const f = S.f.t || ''; const l = D().tasks.filter((t) => (f === 'done' ? t.done : !t.done) && (f !== 'mine' || t.assigneeId === S.user.uid) && (f !== 'late' || (t.due && t.due < today()))); return f === 'done' ? sortBy(l, (t) => t.doneAt || 0, -1).slice(0, 100) : sortBy(l, (t) => t.due || '9999'); },
};
const printBtn = (kind) => `<button class="btn" data-act="printList" data-k="${kind}" title="Yazdır / PDF">${ic('printer')}<span class="hide-m"> Yazdır</span></button>`;

/* ================= PANO ================= */
function upcomingEvents(days) {
  const t = today(), lim = addDays(t, days);
  const ev = [];
  D().opps.filter((o) => o.stage !== 'kaybedildi' && o.start && (o.end || o.start) >= t && o.start <= lim).forEach((o) => ev.push({ date: o.start, col: 'opps', id: o.id, title: o.title, sub: `${OPP_KINDS[o.kind] || ''}${o.pax ? ' · ' + o.pax + ' kişi' : ''}`, stage: badge(OPP_STAGES, o.stage) }));
  D().weddings.filter((w) => w.stage !== 'kaybedildi' && w.date && w.date >= t && w.date <= lim).forEach((w) => ev.push({ date: w.date, col: 'weddings', id: w.id, title: w.couple, sub: `${w.eventType || 'Düğün'}${w.guests ? ' · ' + w.guests + ' davetli' : ''}`, stage: badge(WED_STAGES, w.stage) }));
  return sortBy(ev, (e) => e.date);
}
function specialDays(days) {
  const out = [];
  for (let i = 0; i <= days; i++) { const d = addDays(today(), i); occasionsOn(d).forEach((o) => out.push({ g: o.g, label: o.label, date: d, diff: i, o })); }
  return out;
}
const taskRow = (t) => {
  const late = !t.done && t.due && t.due < today();
  return `<div class="row ${t.done ? 'done' : ''}"><button class="check ${t.done ? 'on' : ''}" data-act="toggleTask" data-id="${t.id}" aria-label="Tamamlandı">${t.done ? ic('check') : ''}</button>
    <button class="t" style="border:0;background:none;text-align:left;padding:0" data-act="editTask" data-id="${t.id}"><b>${esc(t.title)}</b><span>${esc([refLabel(t), userName(t.assigneeId)].filter(Boolean).join(' · '))}</span></button>
    <div class="r">${t.priority === 'yuksek' && !t.done ? '<span class="badge terra">Yüksek</span> ' : ''}<span class="${late ? 'badge red' : ''}">${t.due === today() ? 'Bugün' : fmtDate(t.due)}</span></div></div>`;
};
const evRow = (e) => `<button class="row" data-act="open" data-col="${e.col}" data-id="${e.id}">${dateBox(e.date)}<div class="t"><b>${esc(e.title)}</b><span>${esc(e.sub)}</span></div><div class="r">${e.stage}</div></button>`;
const actItem = (a, showRef) => `<div class="it"><div class="dot">${ic(ACT_ICON[a.type] || 'note')}</div><div class="bd">
  <b>${esc(a.subject)}</b><small>${esc(ACT_TYPES[a.type] || '')} · ${fmtDate(a.date)} · ${esc(a.userName || '')}${showRef && a.ref ? ` · <a href="#" data-act="open" data-col="${a.ref.col}" data-id="${a.ref.id}">${esc(refLabel(a))}</a>` : ''}</small>
  ${a.note ? `<p>${esc(a.note)}</p>` : ''}</div>${can.admin() || a.userId === S.user.uid ? `<button class="x" data-act="editAct" data-id="${a.id}" aria-label="Düzenle">${ic('pencil')}</button>` : ''}</div>`;

V.pano = {
  title: () => 'Pano',
  head: () => `<button class="btn" data-act="printPage" data-title="Pano" title="Yazdır / PDF">${ic('printer')}</button>${can.edit('activities') ? `<button class="btn" data-act="newActivity">${ic('plus')} Aktivite</button>` : ''}${can.edit('tasks') ? `<button class="btn" data-act="newTask">${ic('plus')} Görev</button>` : ''}`,
  body: () => {
    const t = today(), y = t.slice(0, 4);
    const oo = openOpps(), od = overdue();
    const wOpen = D().weddings.filter((w) => !['sozlesme', 'kaybedildi'].includes(w.stage));
    const wWon = D().weddings.filter((w) => w.stage === 'sozlesme' && (w.date || '').startsWith(y));
    const due = sortBy(D().tasks.filter((x) => !x.done && x.due && x.due <= addDays(t, 7)), (x) => x.due).slice(0, 8);
    const ev = upcomingEvents(45).slice(0, 7), sp = specialDays(21).slice(0, 6);
    const max = Math.max(1, ...OPP_STAGES.map(([k]) => D().opps.filter((o) => o.stage === k).length));
    const endC = sortBy(D().accounts.filter((a) => a.status !== 'pasif' && a.contractEnd && a.contractEnd >= t && a.contractEnd <= addDays(t, 60)), (a) => a.contractEnd);
    const cold = sortBy(D().accounts.filter((a) => a.status === 'aktif').map((a) => ({ a, lc: lastContact(a.id) })).filter((x) => !x.lc || x.lc < addDays(t, -60)), (x) => x.lc || '').slice(0, 6);
    const acts = sortBy(D().activities, (a) => a.date + String(a.createdAt || ''), -1).slice(0, 7);
    const isEmpty = !D().accounts.length && !D().guests.length && !D().opps.length && !D().weddings.length;
    return `
    ${S.store.kind === 'local' ? `<div class="banner">${ic('warn')}<span><b>Demo modu.</b> Kayıtlar yalnızca bu cihazda durur; ekip bulutu bağlanınca herkes aynı veriyi canlı görür.</span>${isEmpty ? '<button class="btn sm" data-act="loadSample">Örnek verileri yükle</button>' : ''}</div>` : ''}
    ${isEmpty && S.store.kind !== 'local' ? `<div class="banner"><span><b>Hoş geldiniz.</b> İlk acentenizi, misafirinizi ya da düğün teklifinizi ekleyerek başlayın; Excel'den toplu aktarım Ayarlar'da.</span></div>` : ''}
    <div class="kpis">
      <button class="kpi" data-act="nav" data-v="accounts"><small>Aktif acente / firma</small><b>${D().accounts.filter((a) => a.status === 'aktif').length}</b><em>${D().accounts.filter((a) => a.status === 'potansiyel').length} potansiyel</em></button>
      <button class="kpi" data-act="nav" data-v="opps"><small>Açık grup & etkinlik</small><b>${oo.length}</b><em>${moneyMap(sumByCur(oo, (o) => num(o.value)))}</em></button>
      <button class="kpi" data-act="nav" data-v="weddings"><small>Açık düğün teklifi</small><b>${wOpen.length}</b><em>${y}: ${wWon.length} sözleşme</em></button>
      <button class="kpi" data-act="nav" data-v="guests"><small>Misafir kaydı</small><b>${D().guests.length}</b><em>${D().guests.filter((g) => (g.stays || []).length > 1).length} tekrar gelen</em></button>
      <button class="kpi ${od.length ? 'warn' : ''}" data-act="nav" data-v="tasks"><small>Geciken takip</small><b>${od.length}</b><em>${myOpen().length} açık görevim</em></button>
    </div>
    <div class="grid g2">
      <div class="card"><div class="pad" style="padding-bottom:4px"><h3>Takipler · 7 gün</h3></div>${due.length ? `<div class="list">${due.map(taskRow).join('')}</div>` : '<div class="pad muted" style="padding-top:0">Yaklaşan takip yok.</div>'}</div>
      <div class="card"><div class="pad" style="padding-bottom:4px"><h3>Yaklaşan etkinlikler · 45 gün</h3></div>${ev.length ? `<div class="list">${ev.map(evRow).join('')}</div>` : '<div class="pad muted" style="padding-top:0">Yaklaşan etkinlik yok.</div>'}</div>
      <div class="card pad"><h3>Grup & etkinlik hunisi</h3><div class="bars">${OPP_STAGES.map(([k, l]) => { const li = D().opps.filter((o) => o.stage === k); return `<div class="bar"><span>${l}</span><div class="tr"><i class="${k === 'kazanildi' ? 'olive' : k === 'kaybedildi' ? 'red' : ''}" style="width:${(li.length / max) * 100}%"></i></div><span class="v">${li.length} · ${moneyMap(sumByCur(li, (o) => num(o.value)))}</span></div>`; }).join('')}</div></div>
      <div class="card"><div class="pad" style="padding-bottom:4px;display:flex;align-items:center"><h3 style="margin:0;flex:1">Misafir özel günleri · 21 gün</h3><button class="btn sm" data-act="nav" data-v="cel">${ic('cake')} Kutlamalar</button></div>${sp.length ? `<div class="list">${sp.map((x) => `<div class="row"><div class="av terra">${ic('cake')}</div><button class="t" style="border:0;background:none;text-align:left;padding:0" data-act="open" data-col="guests" data-id="${x.g.id}"><b>${esc(x.g.name)}</b><span>${esc(x.label)} · ${fmtDate(x.date)}</span></button><div class="r">${x.diff === 0 ? '<span class="badge terra">Bugün</span>' : x.diff + ' gün'}</div>${x.diff <= 1 ? `<button class="btn sm" data-act="cardOpen" data-g="${x.g.id}" data-k="${x.o.key}" data-d="${x.date}">Kart</button>` : ''}</div>`).join('')}</div>` : '<div class="pad muted" style="padding-top:0">Yaklaşan özel gün yok.</div>'}</div>
      <div class="card"><div class="pad" style="padding-bottom:4px"><h3>Dikkat</h3></div>${endC.length || cold.length ? `<div class="list">
        ${endC.map((a) => `<button class="row" data-act="open" data-col="accounts" data-id="${a.id}"><div class="av terra">${ic('warn')}</div><div class="t"><b>${esc(a.name)}</b><span>Kontrat ${fmtDate(a.contractEnd)} tarihinde bitiyor</span></div></button>`).join('')}
        ${cold.map((x) => `<button class="row" data-act="open" data-col="accounts" data-id="${x.a.id}"><div class="av">${esc(initials(x.a.name))}</div><div class="t"><b>${esc(x.a.name)}</b><span>${x.lc ? 'Son temas ' + fmtDate(x.lc) : 'Henüz temas kaydı yok'}</span></div><div class="r"><span class="badge gold">60+ gün</span></div></button>`).join('')}
        </div>` : '<div class="pad muted" style="padding-top:0">Biten kontrat ya da uzun süredir aranmayan aktif acente yok.</div>'}</div>
      <div class="card pad"><h3>Son aktiviteler</h3>${acts.length ? `<div class="tl">${acts.map((a) => actItem(a, true)).join('')}</div>` : '<div class="muted">Henüz aktivite girilmedi.</div>'}</div>
    </div>`;
  },
};

/* ================= ACENTELER ================= */
V.accounts = {
  title: () => 'Acenteler & Firmalar',
  head: () => `${searchBox('Ad, şehir, yetkili ara')}${printBtn('accounts')}<button class="btn" data-act="exportCol" data-col="accounts" title="Excel'e aktar">${ic('download')} Excel</button>${addBtn('newAccount', 'Yeni', 'accounts')}`,
  chips: () => chip('type', '', 'Tümü', D().accounts.length) + Object.entries(ACC_TYPES).map(([k, l]) => { const n = D().accounts.filter((a) => a.type === k).length; return n ? chip('type', k, l, n) : ''; }).join('') + '<span style="width:8px"></span>' + Object.entries(ACC_STATUS).map(([k, l]) => `<button class="chip ${S.f.status === k ? 'on' : ''}" data-act="filter" data-k="status" data-v="${S.f.status === k ? '' : k}">${l}</button>`).join(''),
  body: () => {
    const list = LIST.accounts();
    if (!D().accounts.length) return empty('Henüz acente ya da firma yok', 'Çalıştığınız acenteleri, tur operatörlerini ve kurumsal firmaları buraya ekleyin.', addBtn('newAccount', 'İlk kaydı ekle', 'accounts'));
    if (!list.length) return empty('Sonuç yok', 'Arama ya da filtreyi değiştirin.');
    return `<div class="card list">${list.map((a) => { const lc = lastContact(a.id); return `<button class="row" data-act="open" data-col="accounts" data-id="${a.id}"><div class="av">${esc(initials(a.name))}</div>
      <div class="t"><b>${esc(a.name)}</b><span>${esc([ACC_TYPES[a.type], a.city, (a.contacts || []).length ? (a.contacts[0].name + ((a.contacts.length > 1) ? ' +' + (a.contacts.length - 1) : '')) : ''].filter(Boolean).join(' · '))}</span></div>
      <div class="r"><span class="badge ${a.status === 'aktif' ? 'teal' : a.status === 'potansiyel' ? 'gold' : ''}">${ACC_STATUS[a.status] || ''}</span><br>${lc ? 'Son temas ' + fmtDate(lc) : ''}</div></button>`; }).join('')}</div>`;
  },
};

/* ================= MİSAFİRLER ================= */
const guestStats = (g) => { const st = g.stays || []; const nights = st.reduce((s, x) => s + (x.checkIn && x.checkOut ? Math.max(0, Math.round((new Date(x.checkOut) - new Date(x.checkIn)) / 864e5)) : 0), 0); const last = st.map((x) => x.checkIn).filter(Boolean).sort().pop() || ''; return { n: st.length, nights, last, spend: st.reduce((s, x) => s + num(x.amount), 0) }; };
const isVip = (g) => (g.tags || []).some((t) => t.toLocaleLowerCase('tr-TR') === 'vip');
V.guests = {
  title: () => 'Misafirler',
  head: () => `${searchBox('Ad, telefon, şehir ara')}${can.edit('guests') ? `<button class="btn" data-act="guestImport" title="Excel / CSV listesinden toplu aktar">${ic('upload')}<span class="hide-m"> Excel'den aktar</span></button>` : ''}${printBtn('guests')}<button class="btn" data-act="exportCol" data-col="guests" title="Excel'e aktar">${ic('download')} Excel</button>${addBtn('newGuest', 'Yeni', 'guests')}`,
  chips: () => chip('g', '', 'Tümü', D().guests.length) + chip('g', 'vip', 'VIP', D().guests.filter(isVip).length) + chip('g', 'repeat', 'Tekrar gelen', D().guests.filter((g) => (g.stays || []).length > 1).length) + chip('g', 'special', 'Özel günü yaklaşan', specialDays(30).length),
  body: () => {
    const list = LIST.guests();
    if (!D().guests.length) return empty('Henüz misafir kaydı yok', 'Misafirlerinizi tek tek ekleyin ya da otel programından aldığınız Excel / CSV listesini toplu aktarın; doğum günleri Kutlamalar ekranına kendiliğinden düşer.', addBtn('newGuest', 'İlk misafiri ekle', 'guests') + (can.edit('guests') ? ` <button class="btn" data-act="guestImport">${ic('upload')} Excel'den aktar</button>` : ''));
    if (!list.length) return empty('Sonuç yok', 'Arama ya da filtreyi değiştirin.');
    return `<div class="card list">${list.map((g) => { const s = guestStats(g); return `<button class="row" data-act="open" data-col="guests" data-id="${g.id}"><div class="av olive">${esc(initials(g.name))}</div>
      <div class="t"><b>${esc(g.name)} ${isVip(g) ? '<span class="badge gold">VIP</span>' : ''}${A._blBadge ? A._blBadge('guests', g) : ''}</b><span>${esc([g.city || g.country, g.phone].filter(Boolean).join(' · '))}</span></div>
      <div class="r"><b>${s.n} konaklama</b>${s.last ? 'Son: ' + fmtDate(s.last) : ''}</div></button>`; }).join('')}</div>`;
  },
};

/* ================= GRUP & ETKİNLİK ================= */
V.opps = {
  title: () => 'Grup & Etkinlik Talepleri',
  head: () => `${searchBox('Başlık, firma ara')}${printBtn('opps')}<button class="btn" data-act="exportCol" data-col="opps" title="Excel'e aktar">${ic('download')} Excel</button>${addBtn('newOpp', 'Yeni talep', 'opps')}`,
  chips: () => chip('kind', '', 'Tümü', D().opps.length) + Object.entries(OPP_KINDS).map(([k, l]) => chip('kind', k, l, D().opps.filter((o) => o.kind === k).length)).join(''),
  body: () => {
    if (!D().opps.length) return empty('Henüz talep yok', 'Grup konaklama, toplantı, yemek ve özel etkinlik taleplerini aşama aşama buradan takip edin.', addBtn('newOpp', 'İlk talebi ekle', 'opps'));
    const list = LIST.opps();
    const ed = can.edit('opps');
    return `<div class="kanban">${OPP_STAGES.map(([k, l]) => { const li = sortBy(list.filter((o) => o.stage === k), (o) => o.start || '9999'); return `<div class="col" data-stage="${k}"><h4>${l} <span>${li.length} · ${moneyMap(sumByCur(li, (o) => num(o.value)))}</span></h4>
      ${li.map((o) => { const acc = byId('accounts', o.accountId); return `<div class="kc" role="button" tabindex="0" ${ed ? 'draggable="true"' : ''} data-act="open" data-col="opps" data-id="${o.id}"><b>${esc(o.title)}</b><span>${esc([acc && acc.name, OPP_KINDS[o.kind]].filter(Boolean).join(' · '))}</span>
        <span>${esc([fmtRange(o.start, o.end), o.pax ? o.pax + ' kişi' : '', o.rooms ? o.rooms + ' oda' : ''].filter(Boolean).join(' · '))}</span>
        <div class="f"><b>${o.value ? money(o.value, o.currency) : ''}</b><span>${esc(userName(o.ownerId))}</span></div>
        ${k === 'teklif' ? `<div class="kact">${o.offerSentAt ? `<span class="badge olive">Gönderildi ${fmtDate(iso(new Date(o.offerSentAt)))}</span>` : ''}<button class="btn sm pri" data-act="offer" data-col="opps" data-id="${o.id}">${ic('note')} ${o.offerSentAt ? 'Teklifi aç' : 'Teklif hazırla'}</button></div>` : ''}</div>`; }).join('') || '<div class="muted" style="font-size:13px;padding:4px">—</div>'}</div>`; }).join('')}</div>
      ${ed ? '<p class="muted" style="font-size:13px">Bilgisayarda kartı sürükleyerek, telefonda kartı açıp aşama seçerek ilerletebilirsiniz. Kart <b>Teklif hazırla</b> sütununa gelince teklif ekranı açılır.</p>' : ''}`;
  },
};

/* ================= DÜĞÜN ================= */
export const wedConflicts = (w) => (w.date && w.stage !== 'kaybedildi' ? D().weddings.filter((x) => x.id !== w.id && x.date === w.date && x.stage !== 'kaybedildi' && (x.venue || '') === (w.venue || '')) : []);
const wedYears = () => Array.from(new Set(D().weddings.map((w) => (w.date || '').slice(0, 4)).filter(Boolean))).sort();
V.weddings = {
  title: () => 'Düğün Teklifleri',
  head: () => `${searchBox('Çift adı, telefon ara')}${printBtn('weddings')}<button class="btn" data-act="exportCol" data-col="weddings" title="Excel'e aktar">${ic('download')} Excel</button>${addBtn('newWedding', 'Yeni teklif', 'weddings')}`,
  chips: () => chip('ws', '', 'Tümü', D().weddings.length) + WED_STAGES.map(([k, l]) => chip('ws', k, l, D().weddings.filter((w) => w.stage === k).length)).join('') + (wedYears().length > 1 ? '<span style="width:8px"></span>' + chip('wy', '', 'Tüm yıllar') + wedYears().map((y) => chip('wy', y, y)).join('') : ''),
  body: () => {
    if (!D().weddings.length) return empty('Henüz düğün teklifi yok', 'Çiftin bilgilerini, tarihi, kişi başı fiyatı ve ek hizmetleri girin; teklif yazdırmaya hazır olsun.', addBtn('newWedding', 'İlk teklifi ekle', 'weddings'));
    const list = LIST.weddings();
    if (!list.length) return empty('Sonuç yok', 'Arama ya da filtreyi değiştirin.');
    const tot = {}; list.filter((w) => w.stage !== 'kaybedildi').forEach((w) => Object.entries(recTotals('weddings', w)).forEach(([k, v]) => { tot[k] = (tot[k] || 0) + v; }));
    return `<p class="muted" style="margin:0 0 10px">${list.length} teklif · kaybedilenler hariç toplam ${moneyMap(tot)}</p><div class="card list">${list.map((w) => `<button class="row" data-act="open" data-col="weddings" data-id="${w.id}">${dateBox(w.date)}
      <div class="t"><b>${esc(w.couple)}${A._blBadge ? A._blBadge('weddings', w) : ''}</b><span>${esc([w.venue, w.guests ? w.guests + ' davetli' : '', userName(w.ownerId)].filter(Boolean).join(' · '))}</span></div>
      <div class="r"><b>${moneyMap(recTotals('weddings', w))}</b>${badge(WED_STAGES, w.stage)}${w.stage === 'teklif' && w.offerSentAt ? ' <span class="badge olive">Gönderildi</span>' : ''}${wedConflicts(w).length ? '<br><span class="badge red">Tarih çakışıyor</span>' : ''}</div></button>`).join('')}</div>`;
  },
};

/* ================= GÖREVLER ================= */
V.tasks = {
  title: () => 'Görevler & Takipler',
  head: () => printBtn('tasks') + addBtn('newTask', 'Yeni görev', 'tasks'),
  chips: () => chip('t', '', 'Açık', D().tasks.filter((t) => !t.done).length) + chip('t', 'mine', 'Bana atanan', myOpen().length) + chip('t', 'late', 'Geciken', overdue().length) + chip('t', 'done', 'Tamamlanan'),
  body: () => {
    const f = S.f.t || '';
    const list = LIST.tasks();
    if (!list.length) return empty(f === 'done' ? 'Tamamlanan görev yok' : 'Açık görev yok', 'Aktivite girerken takip tarihi verirseniz görev kendiliğinden açılır.', addBtn('newTask', 'Görev ekle', 'tasks'));
    return `<div class="card list">${list.map(taskRow).join('')}</div>`;
  },
};

/* ================= TAKVİM ================= */
A.calMove = (el) => { const [y, m] = S.calMonth.split('-').map(Number); const d = new Date(y, m - 1 + Number(el.dataset.d), 1); S.calMonth = iso(d).slice(0, 7); renderView(); };
A.calToday = () => { S.calMonth = today().slice(0, 7); renderView(); };
V.cal = {
  title: () => { if (!S.calMonth) S.calMonth = today().slice(0, 7); const [y, m] = S.calMonth.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; },
  head: () => `<button class="btn" data-act="calMove" data-d="-1" aria-label="Önceki ay">${ic('left')}</button><button class="btn" data-act="calToday">Bugün</button><button class="btn" data-act="calMove" data-d="1" aria-label="Sonraki ay">${ic('right')}</button><button class="btn" data-act="printPage" data-title="Takvim" title="Yazdır / PDF">${ic('printer')}</button>`,
  body: () => {
    const [y, m] = S.calMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1, 12); const off = (first.getDay() + 6) % 7; const start = new Date(first); start.setDate(1 - off);
    const cells = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(iso(d)); }
    if (cells[35].slice(0, 7) !== S.calMonth) cells.length = 35;
    const evs = (day) => [
      ...D().weddings.filter((w) => w.date === day && w.stage !== 'kaybedildi').map((w) => `<button class="ev w" data-act="open" data-col="weddings" data-id="${w.id}">♥ ${esc(w.couple)}</button>`),
      ...D().opps.filter((o) => o.stage !== 'kaybedildi' && o.start && o.start <= day && (o.end || o.start) >= day).map((o) => `<button class="ev" data-act="open" data-col="opps" data-id="${o.id}">${esc(o.title)}</button>`),
      ...D().tasks.filter((t) => !t.done && t.due === day).map((t) => `<button class="ev t" data-act="editTask" data-id="${t.id}">✓ ${esc(t.title)}</button>`),
    ];
    return `<div class="card" style="overflow:hidden"><div class="cal">${['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => `<div class="dh">${d}</div>`).join('')}
      ${cells.map((c) => { const e = evs(c); return `<div class="d ${c.slice(0, 7) !== S.calMonth ? 'o' : ''} ${c === today() ? 'today' : ''}"><span class="num">${Number(c.slice(8))}</span>${e.slice(0, 3).join('')}${e.length > 3 ? `<span class="muted" style="font-size:11px">+${e.length - 3}</span>` : ''}</div>`; }).join('')}</div></div>
      <p class="muted" style="font-size:13px;margin-top:10px"><span class="badge terra">Düğün</span> <span class="badge teal">Grup & etkinlik</span> <span class="badge gold">Görev</span></p>`;
  },
};

/* ================= DETAY PANELİ ================= */
const dl = (pairs) => { const p = pairs.filter((x) => x[1] !== '' && x[1] != null && x[1] !== false); return p.length ? `<dl class="dl">${p.map(([k, v, raw]) => `<dt>${esc(k)}</dt><dd>${raw ? v : esc(v)}</dd>`).join('')}</dl>` : ''; };
const contactBtns = (phone, email) => `${phone ? `<a class="btn sm" href="tel:${esc(phone)}">${ic('phone')} Ara</a><a class="btn sm" href="https://wa.me/${waNum(phone)}" target="_blank" rel="noopener">${ic('wa')} WhatsApp</a>` : ''}${email ? `<a class="btn sm" href="mailto:${esc(email)}">${ic('mail')} E-posta</a>` : ''}`;
const stageSel = (col, r, list) => (can.edit(col) ? `<select class="inp" style="max-width:220px" data-change="setStage" data-col="${col}" data-id="${r.id}" aria-label="Aşama">${list.map(([k, l]) => `<option value="${k}" ${r.stage === k ? 'selected' : ''}>${l}</option>`).join('')}</select>` : badge(list, r.stage));
const relBlocks = (col, id) => {
  const ts = relTasks(col, id), as = related(col, id);
  return `<div class="card"><div class="pad" style="padding-bottom:4px;display:flex;align-items:center"><h3 style="margin:0;flex:1">Görevler</h3>${can.edit('tasks') ? `<button class="btn sm" data-act="addTask" data-col="${col}" data-id="${id}">${ic('plus')} Görev</button>` : ''}</div>${ts.length ? `<div class="list">${ts.map(taskRow).join('')}</div>` : '<div class="pad muted" style="padding-top:8px">Görev yok.</div>'}</div>
  <div class="card pad"><div style="display:flex;align-items:center;margin-bottom:6px"><h3 style="margin:0;flex:1">Aktivite geçmişi</h3>${can.edit('activities') ? `<button class="btn sm" data-act="addAct" data-col="${col}" data-id="${id}">${ic('plus')} Aktivite</button>` : ''}</div>${as.length ? `<div class="tl">${as.map((a) => actItem(a)).join('')}</div>` : '<div class="muted">Henüz aktivite yok.</div>'}</div>`;
};
export const billingText = (a) => [a.invTitle || a.name, a.taxOffice || a.taxNo ? `Vergi dairesi: ${a.taxOffice || '-'}  Vergi no: ${a.taxNo || '-'}` : '', a.invAddress, a.invEmail ? 'Fatura e-postası: ' + a.invEmail : '', a.mersis ? 'MERSİS: ' + a.mersis : '', a.iban ? 'IBAN: ' + a.iban : ''].filter(Boolean).join('\n');
const hasBilling = (a) => ['invTitle', 'taxOffice', 'taxNo', 'invAddress', 'invEmail', 'eInvoice', 'paymentTerms', 'iban', 'mersis'].some((k) => a[k]);
function billingCard(a) {
  return `<div class="card pad"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><h3 style="margin:0;flex:1">Fatura bilgileri</h3>${hasBilling(a) ? `<button class="btn sm" data-act="copyBilling" data-id="${a.id}">${ic('copy')} Kopyala</button>` : ''}${!hasBilling(a) && can.edit('accounts') ? `<button class="btn sm" data-act="edit" data-col="accounts" data-id="${a.id}">${ic('plus')} Ekle</button>` : ''}</div>
    ${hasBilling(a) ? dl([['Ticari ünvan', a.invTitle], ['Vergi dairesi', a.taxOffice], ['Vergi no', a.taxNo], ['Fatura adresi', a.invAddress], ['Fatura e-postası', a.invEmail], ['e-Fatura', EINV[a.eInvoice] || ''], ['Ödeme koşulu', a.paymentTerms], ['MERSİS', a.mersis], ['IBAN', a.iban]]) : '<span class="muted">Fatura bilgisi girilmemiş.</span>'}</div>`;
}
A.copyBilling = (el) => copyText(billingText(byId('accounts', el.dataset.id)));
export function priceTable(col, r) {
  const p = priceRows(col, r);
  if (!p.rows.length) return '<span class="muted">Fiyat kalemi girilmemiş. Düzenle\'den ekleyin.</span>';
  return `<table class="tb">${p.rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="n">${esc(b)}</td></tr>`).join('')}${p.foot.map(([a, b, k]) => (k === 't' ? `<tr><td><b>${esc(a)}</b></td><td class="n"><b>${esc(b)}</b></td></tr>` : `<tr><td class="muted">${esc(a)}</td><td class="n muted">${esc(b)}</td></tr>`)).join('')}</table>`;
}
const foot = (r) => `<p class="muted" style="font-size:12.5px;margin:0">Son güncelleme: ${fmtDate(iso(new Date(r.updatedAt || r.createdAt || Date.now())))}${r.updatedByName ? ' · ' + esc(r.updatedByName) : ''}</p>`;

const SHEETS = {
  accounts: (a) => {
    const ops = sortBy(D().opps.filter((o) => o.accountId === a.id), (o) => o.start || '', -1);
    return { title: a.name, body: `
      <div class="acts"><span class="badge teal">${esc(ACC_TYPES[a.type] || '')}</span><span class="badge ${a.status === 'aktif' ? 'olive' : 'gold'}">${esc(ACC_STATUS[a.status] || '')}</span></div>
      <div class="acts">${contactBtns(a.phone, a.email)}${can.edit('opps') ? `<button class="btn sm" data-act="addOppFor" data-id="${a.id}">${ic('plus')} Talep</button>` : ''}</div>
      <div class="card pad"><h3>Bilgiler</h3>${dl([['Konum', [a.city, a.country].filter(Boolean).join(', ')], ['Pazar', a.market], ['Telefon', a.phone], ['E-posta', a.email], ['Web', a.web], ['Sorumlu', userName(a.ownerId)], ['Komisyon', a.commission !== '' && a.commission != null ? '%' + a.commission : ''], ['Kontrat', fmtRange(a.contractStart, a.contractEnd)], ['Kontrat notu', a.contractNote], ['Notlar', a.notes]]) || '<span class="muted">Bilgi girilmemiş.</span>'}</div>
      ${billingCard(a)}
      ${A._filesCard ? A._filesCard('accounts', a.id) : ''}
      <div class="card"><div class="pad" style="padding-bottom:4px"><h3>Yetkili kişiler</h3></div>${(a.contacts || []).length ? `<div class="list">${a.contacts.map((c) => `<div class="row"><div class="av">${esc(initials(c.name))}</div><div class="t"><b>${esc(c.name)}</b><span>${esc([c.title, c.phone, c.email].filter(Boolean).join(' · '))}</span></div><div class="acts">${c.phone ? `<a class="btn sm" href="tel:${esc(c.phone)}" aria-label="Ara">${ic('phone')}</a><a class="btn sm" href="https://wa.me/${waNum(c.phone)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic('wa')}</a>` : ''}${c.email ? `<a class="btn sm" href="mailto:${esc(c.email)}" aria-label="E-posta">${ic('mail')}</a>` : ''}</div></div>`).join('')}</div>` : '<div class="pad muted" style="padding-top:0">Yetkili eklenmemiş.</div>'}</div>
      ${ops.length ? `<div class="card"><div class="pad" style="padding-bottom:4px"><h3>Grup & etkinlik talepleri</h3></div><div class="list">${ops.map((o) => `<button class="row" data-act="open" data-col="opps" data-id="${o.id}"><div class="t"><b>${esc(o.title)}</b><span>${esc(fmtRange(o.start, o.end))}</span></div><div class="r"><b>${o.value ? money(o.value, o.currency) : ''}</b>${badge(OPP_STAGES, o.stage)}</div></button>`).join('')}</div></div>` : ''}
      ${relBlocks('accounts', a.id)}${foot(a)}` };
  },
  guests: (g) => {
    const s = guestStats(g); const st = sortBy(g.stays || [], (x) => x.checkIn || '', -1);
    return { title: g.name, body: `
      <div class="acts">${isVip(g) ? '<span class="badge gold">VIP</span>' : ''}${s.n > 1 ? '<span class="badge olive">Tekrar gelen</span>' : ''}${(g.tags || []).filter((t) => t.toLocaleLowerCase('tr-TR') !== 'vip').map((t) => `<span class="badge">${esc(t)}</span>`).join('')}</div>
      <div class="acts">${contactBtns(g.phone, g.email)}</div>
      <div class="kpis" style="margin:0"><div class="kpi"><small>Konaklama</small><b>${s.n}</b></div><div class="kpi"><small>Gece</small><b>${s.nights}</b></div><div class="kpi"><small>Son giriş</small><b style="font-size:18px">${s.last ? fmtDate(s.last) : '—'}</b></div></div>
      <div class="card pad"><h3>Bilgiler</h3>${dl([['Konum', [g.city, g.country].filter(Boolean).join(', ')], ['Telefon', g.phone], ['E-posta', g.email], ['Doğum günü', g.birthday ? fmtDateLong(g.birthday) : ''], ['Yıl dönümü', g.anniversary ? fmtDateLong(g.anniversary) : ''], ['Tercihler', g.prefs], ['Notlar', g.notes]]) || '<span class="muted">Bilgi girilmemiş.</span>'}</div>
      <div class="card pad"><h3>Konaklama geçmişi</h3>${st.length ? `<div class="scroll-x"><table class="tb"><tr><th>Tarih</th><th>Tesis</th><th>Oda</th><th class="n">Tutar</th></tr>${st.map((x) => `<tr><td>${esc(fmtRange(x.checkIn, x.checkOut))}${x.note ? `<br><span class="muted">${esc(x.note)}</span>` : ''}</td><td>${esc(x.property || '')}</td><td>${esc(x.room || '')}</td><td class="n">${x.amount ? fmtNum(x.amount) : ''}</td></tr>`).join('')}</table></div>` : '<span class="muted">Konaklama eklenmemiş. Düzenle\'den ekleyebilirsiniz.</span>'}</div>
      ${A._guestOccCard ? A._guestOccCard(g) : ''}
      ${relBlocks('guests', g.id)}${foot(g)}` };
  },
  opps: (o) => {
    const acc = byId('accounts', o.accountId);
    return { title: o.title, body: `
      <div class="acts" style="align-items:center">${stageSel('opps', o, OPP_STAGES)}<span class="badge teal">${esc(OPP_KINDS[o.kind] || '')}</span></div>
      <div class="acts">${contactBtns(o.phone, acc && acc.email)}<button class="btn sm pri" data-act="offer" data-col="opps" data-id="${o.id}">${ic('note')} Teklif</button></div>
      <div class="card pad"><h3>Talep</h3>${dl([['Acente / firma', acc ? `<a href="#" data-act="open" data-col="accounts" data-id="${acc.id}">${esc(acc.name)}</a>` : '', true], ['İlgili kişi', o.contactName], ['Telefon', o.phone], ['Tesis', o.property], ['Tarih', fmtRange(o.start, o.end)], ['Kişi', o.pax], ['Oda', o.rooms], ['Kaynak', o.source], ['Sorumlu', userName(o.ownerId)], ['Teklif geçerlilik', fmtDate(o.validUntil)], ['Kayıp nedeni', o.stage === 'kaybedildi' ? o.lossReason : ''], ['Notlar', o.notes]])}</div>
      <div class="card pad"><h3>Fiyat</h3>${priceTable('opps', o)}</div>
      ${A._filesCard ? A._filesCard('opps', o.id) : ''}
      ${relBlocks('opps', o.id)}${foot(o)}` };
  },
  weddings: (w) => {
    const tot = wedTotal(w), paid = num(w.depositPaid), cf = wedConflicts(w);
    return { title: w.couple, body: `
      ${cf.length ? `<div class="banner" style="margin:0">${ic('warn')}<span>Aynı gün ve mekânda başka kayıt var: <b>${esc(cf.map((x) => x.couple).join(', '))}</b></span></div>` : ''}
      <div class="acts" style="align-items:center">${stageSel('weddings', w, WED_STAGES)}<span class="badge terra">${esc(w.eventType || 'Düğün')}</span></div>
      <div class="acts">${contactBtns(w.phone, w.email)}<button class="btn sm pri" data-act="offer" data-col="weddings" data-id="${w.id}">${ic('note')} Teklif</button></div>
      <div class="card pad"><h3>Organizasyon</h3>${dl([['Tarih', w.date ? fmtDateLong(w.date) : ''], ['Mekân', w.venue], ['Davetli', w.guests], ['Menü / paket', w.menu], ['Telefon', w.phone], ['E-posta', w.email], ['Kaynak', w.source], ['Sorumlu', userName(w.ownerId)], ['Geçerlilik', fmtDate(w.validUntil)], ['Kayıp nedeni', w.stage === 'kaybedildi' ? w.lossReason : ''], ['Notlar', w.notes]])}</div>
      <div class="card pad"><h3>Fiyat</h3>${priceTable('weddings', w)}
        ${num(w.deposit) || paid ? `<table class="tb" style="margin-top:8px">${num(w.deposit) ? `<tr><td>İstenen kapora</td><td class="n">${money(num(w.deposit), w.currency)}</td></tr>` : ''}${paid ? `<tr><td>Alınan kapora</td><td class="n">${money(paid, w.currency)}</td></tr><tr><td><b>Kalan</b> (${esc(w.currency || 'TRY')})</td><td class="n"><b>${money(Math.max(0, tot - paid), w.currency)}</b></td></tr>` : ''}</table>` : ''}</div>
      ${A._filesCard ? A._filesCard('weddings', w.id) : ''}
      ${relBlocks('weddings', w.id)}${foot(w)}` };
  },
};
export function renderSheet() {
  const root = $('#sheet'); const sc = $('.sheet', root); const top = sc ? sc.scrollTop : 0;
  if (!S.sheet) { root.innerHTML = ''; return; }
  const r = byId(S.sheet.col, S.sheet.id);
  if (!r) { root.innerHTML = ''; S.sheet = null; return; }
  const s = (SHEETS[S.sheet.col] || A._sheets[S.sheet.col])(r);
  const bl = A._blBanner && ['guests', 'weddings', 'opps'].includes(S.sheet.col) ? A._blBanner(S.sheet.col, r) : '';
  if (bl) s.body = bl + s.body;
  if (!bl && can.edit('blacklist') && ['guests', 'weddings'].includes(S.sheet.col)) s.body += `<div><button class="btn sm danger" data-act="blFromRec" data-col="${S.sheet.col}" data-id="${r.id}">${ic('ban')} Kara listeye ekle</button></div>`;
  root.innerHTML = `<div class="ov"><aside class="sheet"><div class="sh"><div style="flex:1;min-width:0"><div class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.08em">${COL_LABEL[S.sheet.col]}</div><h2>${esc(s.title)}</h2></div>
    <button class="btn sm" data-act="printRec" data-col="${S.sheet.col}" data-id="${r.id}" title="Yazdır / PDF" aria-label="Yazdır">${ic('printer')}</button>${can.edit(S.sheet.col) ? `<button class="btn sm" data-act="edit" data-col="${S.sheet.col}" data-id="${r.id}">${ic('pencil')} Düzenle</button>` : ''}<button class="x" data-act="closeSheet" aria-label="Kapat">${ic('x')}</button></div><div class="sb">${s.body}</div></aside></div>`;
  const n = $('.sheet', root); if (n) n.scrollTop = top;
}
export { guestStats, isVip, specialDays };
