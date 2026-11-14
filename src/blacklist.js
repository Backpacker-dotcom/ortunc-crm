// Kara liste: kişi kaydı, arama, ve misafir / düğün / talep kayıtlarında otomatik uyarı
import { S, A, V, $, esc, ic, today, fmtDate, iso, sortBy, toast, stamp, can, openForm, trLower, digits, waNum, byId, recTitle } from './core.js';

export const BL_REASONS = { odeme: 'Ödeme yapmadı / borç', hasar: 'Odaya / tesise zarar', davranis: 'Uygunsuz davranış', sahte: 'Sahte rezervasyon / no-show', guvenlik: 'Güvenlik sorunu', diger: 'Diğer' };
const normName = (s) => trLower(s).replace(/\s+/g, ' ').trim();
const normPhone = (s) => digits(s).slice(-10);

// Bir kişinin (ad, telefon, e-posta) kara listede olup olmadığı. phone/email eşleşmesi kesin, sadece ad eşleşmesi "olası".
export function blMatch({ name, phone, email } = {}) {
  const n = normName(name), p = normPhone(phone), e = trLower(email).trim();
  const out = [];
  (S.data.blacklist || []).forEach((b) => {
    const why = [];
    if (p.length >= 7 && normPhone(b.phone) === p) why.push('telefon');
    if (e && trLower(b.email).trim() === e) why.push('e-posta');
    if (n && normName(b.name) === n) why.push('ad soyad');
    if (why.length) out.push({ b, why, strong: why.some((w) => w !== 'ad soyad') });
  });
  return out;
}
const personOf = (col, r) => (col === 'guests' ? { name: r.name, phone: r.phone, email: r.email }
  : col === 'weddings' ? { name: r.couple, phone: r.phone, email: r.email }
    : col === 'opps' ? { name: r.contactName, phone: r.phone, email: '' } : { name: '', phone: '', email: '' });
export function blBanner(col, r) {
  const m = blMatch(personOf(col, r)); if (!m.length) return '';
  return `<div class="banner" style="margin:0;background:var(--danger-soft);border-color:#e6c5bf;color:var(--danger)">${ic('ban')}<span><b>${m.some((x) => x.strong) ? 'KARA LİSTEDE' : 'Kara listede olabilir'}</b> · ${m.map((x) => `${esc(x.b.name)} (${esc(BL_REASONS[x.b.reason] || 'Diğer')}; eşleşen: ${x.why.join(', ')})`).join(' — ')}</span><button class="btn sm" data-act="open" data-col="blacklist" data-id="${m[0].b.id}">Kaydı gör</button></div>`;
}
export const blBadge = (col, r) => (blMatch(personOf(col, r)).length ? ' <span class="badge red">Kara liste</span>' : '');

/* ---------- ekran ---------- */
S.blq = '';
const listFiltered = () => {
  const q = S.blq.trim(); const qn = normName(q), qp = normPhone(q);
  return sortBy((S.data.blacklist || []).filter((b) => !q || normName(b.name).includes(qn) || (qp.length >= 3 && normPhone(b.phone).includes(qp)) || trLower(b.email).includes(trLower(q).trim())
    || trLower(b.detail).includes(qn)), (b) => -(b.createdAt || 0));
};
A._blList = listFiltered;
V.black = {
  title: () => 'Kara Liste',
  head: () => `<button class="btn" data-act="printList" data-k="blacklist" title="Yazdır / PDF">${ic('printer')}<span class="hide-m"> Yazdır</span></button><button class="btn" data-act="exportCol" data-col="blacklist">${ic('download')}<span class="hide-m"> Excel</span></button>${can.edit('guests') ? `<button class="btn pri" data-act="blNew">${ic('plus')} Kara listeye ekle</button>` : ''}`,
  body: () => {
    const all = S.data.blacklist || []; const l = listFiltered();
    const searchBar = `<form class="card pad" id="blForm" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
      <label class="search" style="max-width:none;flex:1;min-width:220px">${ic('search')}<input id="blQ" type="search" value="${esc(S.blq)}" placeholder="Ad soyad, telefon ya da e-posta yazın" aria-label="Kara listede ara" autocomplete="off"></label>
      <button class="btn pri" type="submit">${ic('search')} Ara</button>${S.blq ? '<button class="btn" type="button" data-act="blClear">Temizle</button>' : ''}</form>`;
    let res;
    if (S.blq) {
      res = l.length ? `<div class="banner" style="background:var(--danger-soft);border-color:#e6c5bf;color:var(--danger)">${ic('ban')}<b>${l.length} kayıt kara listede bulundu.</b></div>`
        : `<div class="banner" style="background:var(--olive-soft);border-color:#d6dcbf;color:#56622F">${ic('check')}<span><b>"${esc(S.blq)}" kara listede yok.</b></span></div>`;
    } else res = '';
    const row = (b) => `<div class="row" role="button" tabindex="0" data-act="open" data-col="blacklist" data-id="${b.id}" style="cursor:pointer"><div class="av" style="background:var(--danger-soft);color:var(--danger)">${ic('ban')}</div>
      <div class="t"><b>${esc(b.name)}</b><span>${esc([b.phone, b.email].filter(Boolean).join(' · '))}</span><span>${esc(BL_REASONS[b.reason] || '')}${b.detail ? ' — ' + esc(b.detail) : ''}</span></div>
      <div class="r hide-m">${fmtDate(b.date)}<br>${esc(b.addedByName || '')}</div>
      ${b.phone ? `<a class="btn sm" href="tel:${esc(b.phone)}" title="Ara">${ic('phone')}<span class="hide-m"> Ara</span></a>` : ''}</div>`;
    return searchBar + res + (all.length ? (l.length ? `<div class="card list">${l.map(row).join('')}</div>` : '') : `<div class="card empty"><b>Kara liste boş</b>Sorun yaşanan misafirleri sebebiyle birlikte ekleyin; aynı kişi tekrar geldiğinde kaydında uyarı çıkar.</div>`)
      + '<p class="muted" style="font-size:12.5px;margin-top:12px">Kara listeye yalnızca yaşanmış olayları, nesnel ve kısa biçimde yazın; kişisel yorum eklemeyin. Kaydı yalnızca yönetici silebilir.</p>';
  },
};
A.blClear = () => { S.blq = ''; A._renderView(); };
document.addEventListener('submit', (ev) => { if (ev.target.id === 'blForm') { ev.preventDefault(); S.blq = $('#blQ').value.trim(); A._renderView(); setTimeout(() => { const i = $('#blQ'); if (i && window.innerWidth > 900) i.focus(); }, 30); } });

/* ---------- form ---------- */
export function blForm(rec, preset = {}) {
  openForm({
    title: rec ? 'Kara liste kaydını düzenle' : 'Kara listeye ekle',
    data: rec || { reason: 'odeme', date: today(), ...preset },
    fields: [
      { k: 'name', label: 'Ad Soyad', req: true },
      { k: 'phone', label: 'Telefon', type: 'tel', half: true },
      { k: 'email', label: 'E-posta', type: 'email', half: true },
      { k: 'reason', label: 'Sebep', type: 'select', opts: Object.entries(BL_REASONS), req: true, half: true },
      { k: 'date', label: 'Olay tarihi', type: 'date', half: true },
      { k: 'detail', label: 'Ne oldu?', type: 'textarea', req: true, ph: 'Kısa ve nesnel: ör. 3 gece konakladı, ödeme yapmadan ayrıldı; tutar ₺12.000.' },
      { k: 'room', label: 'Oda / rezervasyon no', half: true },
      { k: 'amount', label: 'Varsa alacak tutarı', type: 'number', half: true },
    ],
    onSave: async (v) => {
      if (!v.phone && !v.email) { const e = new Error(); e.userMsg = 'Doğru eşleşme için telefon ya da e-postadan en az biri gerekli.'; throw e; }
      const id = await S.store.save('blacklist', stamp({ ...(rec || {}), ...v, addedBy: (rec && rec.addedBy) || S.user.uid, addedByName: (rec && rec.addedByName) || S.user.name }));
      toast(rec ? 'Kaydedildi' : 'Kara listeye eklendi');
      if (!rec) A.open({ dataset: { col: 'blacklist', id } });
    },
    onDelete: rec && can.admin() ? async () => { await S.store.remove('blacklist', rec.id); S.sheet = null; toast('Silindi'); A._refresh(); } : null,
  });
}
A.blNew = () => blForm();
A.blFromRec = (el) => { const r = byId(el.dataset.col, el.dataset.id); if (!r) return; const p = personOf(el.dataset.col, r); blForm(null, { name: p.name || recTitle(el.dataset.col, r), phone: p.phone || '', email: p.email || '' }); };
A.blEdit = (el) => { const r = byId('blacklist', el.dataset.id); if (r) blForm(r); };

/* ---------- detay paneli ---------- */
export function blSheet(b) {
  return {
    title: b.name,
    body: `<div class="banner" style="margin:0;background:var(--danger-soft);border-color:#e6c5bf;color:var(--danger)">${ic('ban')}<b>${esc(BL_REASONS[b.reason] || 'Kara liste')}</b></div>
      <div class="acts">${b.phone ? `<a class="btn sm" href="tel:${esc(b.phone)}">${ic('phone')} Ara</a><a class="btn sm" href="https://wa.me/${waNum(b.phone)}" target="_blank" rel="noopener">${ic('wa')} WhatsApp</a>` : ''}${b.email ? `<a class="btn sm" href="mailto:${esc(b.email)}">${ic('mail')} E-posta</a>` : ''}</div>
      <div class="card pad"><h3>Bilgiler</h3><dl class="dl">${[['Telefon', b.phone], ['E-posta', b.email], ['Sebep', BL_REASONS[b.reason]], ['Olay tarihi', fmtDate(b.date)], ['Oda / rez. no', b.room], ['Alacak', b.amount ? new Intl.NumberFormat('tr-TR').format(b.amount) : ''], ['Ne oldu?', b.detail], ['Ekleyen', `${b.addedByName || ''} · ${fmtDate(iso(new Date(b.createdAt || Date.now())))}`]].filter((x) => x[1]).map(([k, v]) => `<dt>${esc(k)}</dt><dd style="white-space:pre-wrap">${esc(v)}</dd>`).join('')}</dl></div>
      ${(() => { const ms = [...S.data.guests.map((g) => ['guests', g]), ...S.data.weddings.map((w) => ['weddings', w]), ...S.data.opps.map((o) => ['opps', o])].filter(([c, r]) => blMatch(personOf(c, r)).some((m) => m.b.id === b.id));
        return ms.length ? `<div class="card"><div class="pad" style="padding-bottom:4px"><h3>Sistemdeki eşleşen kayıtlar</h3></div><div class="list">${ms.map(([c, r]) => `<button class="row" data-act="open" data-col="${c}" data-id="${r.id}"><div class="t"><b>${esc(recTitle(c, r))}</b><span>${esc({ guests: 'Misafir', weddings: 'Düğün', opps: 'Grup & etkinlik' }[c])}</span></div></button>`).join('')}</div></div>` : ''; })()}`,
  };
}
