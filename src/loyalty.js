// Pazarlama & sadakat: sadakat programı (seviyeler), RFM misafir segmentleri, ticari ileti izni (İYS / KVKK),
// segment oluşturucu, kampanyalar (e-posta / WhatsApp / SMS listesi) ve kampanya sonrası dönüş (konaklama, gelir)
import * as XLSX from 'xlsx';
import { S, A, V, $, $$, esc, ic, today, addDays, fmtDate, fmtNum, money, num, MONTHS, toast, can, byId, sortBy, openForm, closeModal, stamp, confirmBox, errText, waNum, trLower } from './core.js';
import { saveFile } from './print.js';
import { post, mailReady, mailHtml } from './mail.js';
import { blMatch } from './blacklist.js';
const blocked = (g) => blMatch({ name: g.name, phone: g.phone, email: g.email }).length > 0;

const D = () => S.data;
const CAMPS = () => D().campaigns || [];
const km = (v) => (Math.abs(v || 0) >= 1e6 ? `₺${(v / 1e6).toFixed(2).replace('.', ',')} mn` : money(Math.round(v || 0)));
const pc = (v) => (v == null || !Number.isFinite(v) ? '—' : `%${Math.round(v)}`);
export const CONSENT = { evet: 'İzin var', hayir: 'İzin yok (ret)', '': 'Bilinmiyor' };
// örnek program: seviye adları, koşullar ve ayrıcalıklar Program sekmesinden değiştirilir
export const DEF_PROG = {
  name: 'Ortunç Dostları',
  tiers: [
    { k: 'uye', name: 'Üye', stays: 1, nights: 0, spend: 0, perks: 'Doğum günü kutlaması, erken rezervasyon duyuruları' },
    { k: 'gumus', name: 'Gümüş', stays: 2, nights: 5, spend: 0, perks: 'Hoş geldin ikramı, müsaitliğe göre geç çıkış' },
    { k: 'altin', name: 'Altın', stays: 4, nights: 12, spend: 0, perks: 'Müsaitliğe göre oda yükseltme, doğrudan rezervasyonda özel fiyat' },
  ],
};
export const prog = () => ({ ...DEF_PROG, ...(S.settings.loyalty || {}) });
export const RFM = { champ: 'Şampiyon', loyal: 'Sadık', new: 'Yeni', risk: 'Riskte', lost: 'Kayıp', none: 'Konaklaması yok' };
const RFM_HINT = { champ: 'son 12 ayda geldi, 3+ konaklama', loyal: '2+ konaklama, son 18 ayda geldi', new: 'ilk kez son 12 ayda geldi', risk: '12–24 aydır gelmiyor', lost: '24 aydır gelmiyor', none: 'yalnızca kayıt / özel gün' };
const RFM_C = { champ: 'olive', loyal: 'teal', new: '', risk: 'gold', lost: 'red', none: '' };

/* ---------- misafir hesapları ---------- */
const nightsOf = (x) => (x.checkIn && x.checkOut ? Math.max(0, Math.round((new Date(x.checkOut) - new Date(x.checkIn)) / 864e5)) : 0);
const daysSince = (d) => Math.round((new Date(today()) - new Date(d)) / 864e5);
let MEMO = null;
export function gInfo(g) {
  if (!MEMO || MEMO.k !== D().guests || MEMO.p !== S.settings.loyalty || MEMO.t !== today()) MEMO = { k: D().guests, p: S.settings.loyalty, t: today(), m: new Map() };
  const c = MEMO.m.get(g.id); if (c && c.g === g) return c.v;
  const t = today(); const past = (g.stays || []).filter((x) => x.checkIn && x.checkIn <= t); const fut = (g.stays || []).filter((x) => x.checkIn && x.checkIn > t);
  const stays = past.length, nights = past.reduce((s, x) => s + nightsOf(x), 0), spend = past.reduce((s, x) => s + num(x.amount), 0);
  const last = past.map((x) => x.checkIn).sort().pop() || '', first = past.map((x) => x.checkIn).sort()[0] || '';
  const P = prog(); const ok = (tr) => stays >= num(tr.stays) && num(tr.stays) > 0 || (num(tr.nights) > 0 && nights >= num(tr.nights)) || (num(tr.spend) > 0 && spend >= num(tr.spend));
  let tier = null; P.tiers.forEach((tr) => { if (ok(tr)) tier = tr; });
  if (g.tierOverride) tier = P.tiers.find((x) => x.k === g.tierOverride) || tier;
  const ti = tier ? P.tiers.indexOf(tier) : -1; const next = P.tiers[ti + 1] || null;
  const R = last ? daysSince(last) : null;
  const rfm = !stays ? 'none' : R > 730 ? 'lost' : stays >= 3 && R <= 365 ? 'champ' : stays >= 2 && R <= 540 ? 'loyal' : stays === 1 && R <= 365 ? 'new' : 'risk';
  const need = next ? [num(next.stays) > 0 ? `${Math.max(0, num(next.stays) - stays)} konaklama` : '', num(next.nights) > 0 ? `${Math.max(0, num(next.nights) - nights)} gece` : '', num(next.spend) > 0 ? `${km(Math.max(0, num(next.spend) - spend))} harcama` : ''].filter(Boolean).join(' ya da ') : '';
  const v = { stays, nights, spend, last, first, upcoming: fut.map((x) => x.checkIn).sort()[0] || '', tier, next, need, rfm, R, months: new Set(past.map((x) => Number(x.checkIn.slice(5, 7)))), props: new Set(past.map((x) => x.property).filter(Boolean)) };
  MEMO.m.set(g.id, { g, v }); return v;
}
const isVip = (g) => (g.tags || []).some((x) => trLower(x) === 'vip');

/* ---------- segmentler ---------- */
export const PRESETS = [
  ['all', 'Tüm misafirler', {}],
  ['champ', 'Şampiyonlar (son 12 ay, 3+ konaklama)', { rfm: 'champ' }],
  ['loyal', 'Sadık misafirler', { rfm: 'loyal' }],
  ['risk', 'Riskte: 12–24 aydır gelmeyen', { rfm: 'risk' }],
  ['lost', 'Kayıp: 24 aydır gelmeyen', { rfm: 'lost' }],
  ['once', 'Bir kez gelip dönmeyen', { maxStays: 1, minStays: 1, notSince: 6 }],
  ['summer', 'Yazın (Haziran–Ağustos) gelenler', { months: '6,7,8' }],
  ['winter', 'Kış aylarında gelenler', { months: '11,12,1,2,3' }],
  ['foreign', 'Yurt dışı misafirler', { foreign: '1' }],
  ['vip', 'VIP', { vip: '1' }],
  ['bday', 'Doğum günü önümüzdeki 30 gün', { bday: '30' }],
];
const FKEYS = ['tier', 'rfm', 'minStays', 'maxStays', 'notSince', 'since', 'months', 'country', 'city', 'tag', 'prop', 'foreign', 'vip', 'bday', 'consent', 'channel', 'noUpcoming'];
S.loy = S.loy || { tab: 'sum', f: { consent: '', channel: '' }, preset: 'all', camp: null };
const mdNext = (date, n) => { if (!date) return false; const md = String(date).slice(5, 10); for (let i = 0; i <= n; i++) if (addDays(today(), i).slice(5, 10) === md) return true; return false; };
export function segment(f) {
  const t = today(); const ms = f.months ? String(f.months).split(/[,\s]+/).map(Number).filter(Boolean) : null;
  return D().guests.filter((g) => {
    if (blocked(g)) return false;
    const x = gInfo(g);
    if (f.tier && (f.tier === '-' ? x.tier : !x.tier || x.tier.k !== f.tier)) return false;
    if (f.rfm && x.rfm !== f.rfm) return false;
    if (f.minStays !== '' && f.minStays != null && x.stays < num(f.minStays)) return false;
    if (f.maxStays !== '' && f.maxStays != null && x.stays > num(f.maxStays)) return false;
    if (num(f.notSince) && (!x.last || x.last > addDays(t, -Math.round(num(f.notSince) * 30.4)))) return false;
    if (num(f.since) && (!x.last || x.last < addDays(t, -Math.round(num(f.since) * 30.4)))) return false;
    if (ms && !ms.some((m) => x.months.has(m))) return false;
    if (f.country && !trLower(g.country).includes(trLower(f.country))) return false;
    if (f.city && !trLower(g.city).includes(trLower(f.city))) return false;
    if (f.tag && !(g.tags || []).some((y) => trLower(y).includes(trLower(f.tag)))) return false;
    if (f.prop && !x.props.has(f.prop)) return false;
    if (f.foreign && (!g.country || /türkiye|turkiye|turkey|^tr$/i.test(g.country))) return false;
    if (f.vip && !isVip(g)) return false;
    if (f.bday && !mdNext(g.birthday, num(f.bday))) return false;
    if (f.consent === 'evet' && g.mkt !== 'evet') return false;
    if (f.consent === 'hayir-degil' && g.mkt === 'hayir') return false;
    if (f.channel === 'email' && !g.email) return false;
    if (f.channel === 'phone' && !g.phone) return false;
    if (f.noUpcoming && x.upcoming) return false;
    return true;
  });
}
const curF = () => { const p = PRESETS.find((x) => x[0] === S.loy.preset); return { ...(p ? p[2] : {}), ...S.loy.f }; };

/* ---------- metin doldurma ---------- */
function fillC(text, g, c) {
  const x = gInfo(g); const parts = String(g.name || '').trim().split(/\s+/);
  const map = { ad: parts[0] || '', soyad: parts.slice(1).join(' '), ad_soyad: g.name || '', seviye: x.tier ? x.tier.name : '', program: prog().name, son_konaklama: x.last ? fmtDate(x.last) : '', konaklama_sayısı: String(x.stays), kod: c.code || '', geçerlilik: c.validTo ? fmtDate(c.validTo) : '', otel: S.settings.hotelName || '' };
  return String(text || '').replace(/\{([^{}\n]{1,30})\}/g, (m, k) => { const key = trLower(k.trim()).replace(/\s+/g, '_'); return key in map ? map[key] : m; });
}
const CTAGS = [['ad', 'Adı'], ['ad_soyad', 'Adı soyadı'], ['seviye', 'Sadakat seviyesi'], ['program', 'Program adı'], ['son_konaklama', 'Son konaklama'], ['konaklama_sayısı', 'Konaklama sayısı'], ['kod', 'Kampanya kodu'], ['geçerlilik', 'Son geçerlilik'], ['otel', 'Otel adı']];
const recips = (c) => { const l = segment({ ...(c.filter || {}), consent: 'evet' }); return c.channel === 'email' ? l.filter((g) => g.email) : l.filter((g) => g.phone); };

/* ---------- kampanya sonucu: gönderimden sonraki X gün içinde başlayan konaklamalar ---------- */
export function campResult(c) {
  const sent = (c.sent || []).filter((x) => x.ok !== false); const from = c.sentAt ? new Date(c.sentAt).toISOString().slice(0, 10) : null;
  if (!from) return { sent: 0, conv: 0, rev: 0, nights: 0, list: [] };
  const to = addDays(from, num(c.window) || 90); const ids = new Set(sent.map((x) => x.gid)); const list = [];
  D().guests.forEach((g) => { if (!ids.has(g.id)) return; const st = (g.stays || []).filter((s) => s.checkIn && s.checkIn >= from && s.checkIn <= to); if (st.length) list.push({ g, st, rev: st.reduce((a, s) => a + num(s.amount), 0), n: st.reduce((a, s) => a + nightsOf(s), 0) }); });
  return { sent: sent.length, conv: list.length, rev: list.reduce((a, x) => a + x.rev, 0), nights: list.reduce((a, x) => a + x.n, 0), list, from, to };
}

/* ---------- kampanya formu ---------- */
const CH = { email: 'E-posta', whatsapp: 'WhatsApp (tek tek)', sms: 'SMS listesi (dışa aktar)' };
const C_ST = { taslak: 'Taslak', gonderildi: 'Gönderildi' };
export function campForm(rec, preset = {}) {
  const segs = PRESETS.map(([k, l]) => [k, l]);
  openForm({
    title: rec ? 'Kampanyayı düzenle' : 'Yeni kampanya', wide: true,
    data: rec ? { ...rec, preset: rec.preset || 'custom' } : { channel: 'email', theme: 'zarif', window: 90, validFrom: today(), preset: S.loy.preset, subject: '{program} üyelerine özel', text: `# Sizi yeniden ağırlamak isteriz\n\nSevgili {ad},\n\n{program} üyemiz olarak sizi {otel}'de yeniden ağırlamaktan mutluluk duyarız. Doğrudan rezervasyonlarınızda **{kod}** koduyla size özel fiyatımızdan yararlanabilirsiniz.\n\nKampanya {geçerlilik} tarihine kadar geçerlidir.\n\nSevgilerimizle,\n{otel}`, ...preset },
    intro: `<p class="muted" style="margin:0 0 8px">Yalnızca <b>ticari ileti izni olan</b> misafirlere gönderilir (İYS / KVKK). Metinde etiketler kullanabilirsiniz: ${CTAGS.map(([k, l]) => `<code title="${esc(l)}">{${esc(k)}}</code>`).join(' ')}. <b>**kalın**</b> yazı ve ilk satırda <code># başlık</code> desteklenir.</p>`,
    fields: [
      { k: 'name', label: 'Kampanya adı', req: true, ph: 'ör. 2027 erken rezervasyon · sadık misafirler' },
      { k: 'channel', label: 'Kanal', type: 'select', opts: Object.entries(CH), req: true, half: true },
      { k: 'preset', label: 'Hedef kitle', type: 'select', opts: [...segs, ...(rec || S.loy.preset === 'custom' ? [['custom', 'Segment ekranındaki filtre']] : [])], req: true, half: true, hint: 'Segment ekranında filtre kurup oradan "Bu segmente kampanya" ile de açabilirsiniz.' },
      { k: 'code', label: 'Kampanya / indirim kodu', half: true, ph: 'ör. DOST27' },
      { k: 'offer', label: 'Teklif (iç not)', half: true, ph: 'ör. Doğrudan rezervasyonda %10' },
      { k: 'validFrom', label: 'Başlangıç', type: 'date', half: true },
      { k: 'validTo', label: 'Son geçerlilik', type: 'date', half: true },
      { k: 'subject', label: 'E-posta konusu', ph: 'E-posta kanalında kullanılır' },
      { k: 'text', label: 'Mesaj', type: 'textarea', req: true },
      { k: 'theme', label: 'E-posta tasarımı', type: 'select', opts: [['zarif', 'Zarif (yeşil–altın)'], ['sicak', 'Sıcak (kiremit)'], ['pastel', 'Pastel (pembe)'], ['sade', 'Sade']], half: true },
      { k: 'window', label: 'Sonuç takibi (gün)', type: 'number', half: true, hint: 'Gönderimden sonra bu süre içinde başlayan konaklamalar kampanyaya yazılır.' },
    ],
    saveLabel: rec ? 'Kaydet' : 'Oluştur',
    onSave: async (v) => {
      const filter = v.preset === 'custom' ? (rec && rec.preset === 'custom' && rec.filter) || { ...S.loy.f, ...(PRESETS.find((x) => x[0] === S.loy.preset) || [, , {}])[2] } : (PRESETS.find((x) => x[0] === v.preset) || [, , {}])[2];
      const out = { ...(rec || { status: 'taslak', sent: [] }), ...v, filter, window: num(v.window) || 90 };
      const id = await S.store.save('campaigns', stamp(out)); toast('Kaydedildi'); S.loy.tab = 'camp'; setTimeout(() => openCamp(id), 0);
    },
    onDelete: rec && (can.admin() || rec.createdBy === S.user.uid) ? async () => { await S.store.remove('campaigns', rec.id); toast('Silindi'); } : null,
  });
}
A.campNew = () => campForm(null);
A.campFromSeg = () => campForm(null, { preset: S.loy.preset === 'all' && !Object.values(S.loy.f).some(Boolean) ? 'all' : Object.values(S.loy.f).some(Boolean) ? 'custom' : S.loy.preset });
A.campEdit = (el) => { const c = byId('campaigns', el.dataset.id); if (c) campForm(c); };

/* ---------- kampanya ekranı ---------- */
export function openCamp(id) {
  const c = byId('campaigns', id); if (!c) return;
  const rs = recips(c); const sentIds = new Set((c.sent || []).filter((x) => x.ok !== false).map((x) => x.gid)); const todo = rs.filter((g) => !sentIds.has(g.id));
  const all = segment(c.filter || {}); const noCons = all.filter((g) => g.mkt !== 'evet').length;
  const r = campResult(c); const ed = can.edit('opps');
  const sample = rs[0] || all[0];
  const prev = sample ? fillC(c.text, sample, c) : c.text;
  $('#modal').innerHTML = `<div class="ov center"><div class="modal" style="width:min(980px,100%)"><div class="mh"><h2>${esc(c.name)}</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb">
      <div class="acts" style="margin-bottom:10px"><span class="badge teal">${esc(CH[c.channel])}</span><span class="badge ${c.status === 'gonderildi' ? 'olive' : 'gold'}">${esc(C_ST[c.status] || 'Taslak')}</span>${c.code ? `<span class="badge">${esc(c.code)}</span>` : ''}<span style="flex:1"></span>${ed ? `<button class="btn sm" data-act="campEdit" data-id="${c.id}">${ic('pencil')} Düzenle</button>` : ''}<button class="btn sm" data-act="campXls" data-id="${c.id}">${ic('table')} Alıcı listesi</button></div>
      <div class="kband">
        <div class="kb"><small>Hedef kitle</small><b>${fmtNum(all.length)}</b><em>${esc((PRESETS.find((x) => x[0] === c.preset) || [, 'Özel filtre'])[1])}</em></div>
        <div class="kb"><small>Gönderilebilir</small><b>${fmtNum(rs.length)}</b><em>izinli ve ${c.channel === 'email' ? 'e-postası' : 'telefonu'} olan · ${fmtNum(noCons)} izinsiz hariç</em></div>
        <div class="kb"><small>Gönderilen</small><b>${fmtNum(r.sent)}</b><em>${c.sentAt ? 'ilk gönderim ' + esc(fmtDate(new Date(c.sentAt).toISOString().slice(0, 10))) : 'henüz gönderilmedi'}</em></div>
        <div class="kb"><small>Dönüş · ${num(c.window) || 90} gün</small><b>${fmtNum(r.conv)}</b><em>${pc(r.sent ? (r.conv / r.sent) * 100 : null)} · ${fmtNum(r.nights)} gece</em></div>
        <div class="kb"><small>Kampanya sonrası konaklama geliri</small><b>${km(r.rev)}</b><em>misafir kartındaki konaklama tutarlarından</em></div>
      </div>
      <div class="grid g2">
        <div class="card pad"><h3>Önizleme${sample ? ` · ${esc(sample.name)}` : ''}</h3>${c.channel === 'email' ? `<div class="muted" style="font-size:12.5px;margin-bottom:6px">Konu: <b>${esc(sample ? fillC(c.subject, sample, c) : c.subject)}</b></div><div style="max-height:420px;overflow:auto;border:1px solid var(--line);border-radius:8px">${mailHtml({ theme: c.theme }, prev)}</div>` : `<div style="white-space:pre-wrap;background:#E7F5E9;border-radius:10px;padding:10px 12px;font-size:14px">${esc(prev.replace(/^#\s+/, '').replace(/\*\*(.+?)\*\*/g, c.channel === 'whatsapp' ? '*$1*' : '$1'))}</div>`}</div>
        <div class="card pad"><h3>Gönderim</h3>
          ${c.channel === 'email' ? `${mailReady() ? `<p style="margin-top:0">${fmtNum(todo.length)} misafire henüz gönderilmedi. E-postalar otelin Google hesabından 50'şerli gruplar hâlinde gider (Google günlük gönderim sınırı uygulanır).</p>${ed && todo.length ? `<button class="btn pri" data-act="campSend" data-id="${c.id}">${ic('mail')} ${fmtNum(Math.min(50, todo.length))} kişiye gönder</button>` : ''}` : `<p style="margin-top:0">Otomatik e-posta gönderimi kurulmamış (Ayarlar → E-posta gönderimi). Alıcı listesini indirip e-posta programınızdan gönderebilirsiniz; gönderdikten sonra "Gönderildi olarak işaretle" deyin ki sonuçlar izlensin.</p>${ed && todo.length ? `<button class="btn" data-act="campMark" data-id="${c.id}">${ic('check')} Listeyi gönderildi olarak işaretle</button>` : ''}`}`
          : c.channel === 'whatsapp' ? `<p style="margin-top:0">Her misafir için WhatsApp kendi adına hazırlanmış mesajla açılır; gönderdiklerinizi işaretleyin.</p><div class="list" style="max-height:340px;overflow:auto">${rs.slice(0, 300).map((g) => `<div class="row"><div class="t"><b>${esc(g.name)}</b><span>${esc(g.phone)}${sentIds.has(g.id) ? ' · gönderildi' : ''}</span></div>${ed ? `<a class="btn sm ${sentIds.has(g.id) ? '' : 'pri'}" href="https://wa.me/${waNum(g.phone)}?text=${encodeURIComponent(fillC(c.text, g, c).replace(/^#\s+/, '').replace(/\*\*(.+?)\*\*/g, '*$1*'))}" target="_blank" rel="noopener" data-act="campWa" data-id="${c.id}" data-g="${g.id}">${ic('wa')} ${sentIds.has(g.id) ? 'Tekrar' : 'Gönder'}</a>` : ''}</div>`).join('')}</div>`
          : `<p style="margin-top:0">SMS için alıcı listesi (telefon + kişiye özel mesaj) Excel olarak iner; SMS firmanızın paneline yükleyin. Gönderdikten sonra işaretleyin.</p><button class="btn" data-act="campXls" data-id="${c.id}">${ic('download')} SMS listesi</button> ${ed && todo.length ? `<button class="btn" data-act="campMark" data-id="${c.id}">${ic('check')} Gönderildi olarak işaretle</button>` : ''}`}
          ${r.list.length ? `<h3 style="margin-top:16px">Kampanya sonrası gelenler</h3><table class="tb"><tr><th>Misafir</th><th>Giriş</th><th class="n">Gece</th><th class="n">Tutar</th></tr>${r.list.map((x) => `<tr><td>${esc(x.g.name)}</td><td>${esc(fmtDate(x.st[0].checkIn))}</td><td class="n">${x.n}</td><td class="n">${x.rev ? km(x.rev) : '—'}</td></tr>`).join('')}</table>` : ''}
        </div></div>
    </div></div></div>`;
}
A.campOpen = (el) => openCamp(el.dataset.id);
const markSent = async (c, gids, results) => {
  const now = Date.now(); const sent = [...(c.sent || [])];
  gids.forEach((gid) => { const r = results && results.find((x) => x.gid === gid); sent.push({ gid, at: now, ok: r ? r.ok : true }); });
  await S.store.save('campaigns', stamp({ ...c, sent, status: 'gonderildi', sentAt: c.sentAt || now }));
};
A.campSend = (el) => {
  const c = byId('campaigns', el.dataset.id); if (!c) return;
  const sentIds = new Set((c.sent || []).filter((x) => x.ok !== false).map((x) => x.gid)); const batch = recips(c).filter((g) => !sentIds.has(g.id)).slice(0, 50);
  confirmBox(`"${c.subject}" konulu e-posta ${batch.length} misafire gönderilsin mi?`, 'Gönder', async () => {
    toast('Gönderiliyor…');
    try {
      const msgs = batch.map((g) => { const txt = fillC(c.text, g, c); return { to: g.email, subject: fillC(c.subject, g, c), text: txt.replace(/^#\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1'), html: mailHtml({ theme: c.theme }, txt) }; });
      const j = await post({ action: 'send', messages: msgs });
      const res = batch.map((g) => ({ gid: g.id, ok: !!(j.results || []).find((x) => x.to === g.email && x.ok) }));
      await markSent(c, batch.map((g) => g.id), res);
      toast(`${res.filter((x) => x.ok).length} e-posta gönderildi${res.some((x) => !x.ok) ? `, ${res.filter((x) => !x.ok).length} gönderilemedi` : ''}. Kalan günlük hak: ${j.quota ?? '?'}`);
      setTimeout(() => openCamp(c.id), 50);
    } catch (e) { toast(errText(e)); }
  }, false);
};
A.campMark = (el) => { const c = byId('campaigns', el.dataset.id); if (!c) return; const sentIds = new Set((c.sent || []).map((x) => x.gid)); const l = recips(c).filter((g) => !sentIds.has(g.id)); confirmBox(`${l.length} misafir bu kampanya gönderilmiş olarak işaretlenecek.`, 'İşaretle', async () => { await markSent(c, l.map((g) => g.id)); toast('İşaretlendi'); setTimeout(() => openCamp(c.id), 50); }); };
A.campWa = (el) => { const c = byId('campaigns', el.dataset.id); if (!c || (c.sent || []).some((x) => x.gid === el.dataset.g)) return; markSent(c, [el.dataset.g]).then(() => setTimeout(() => openCamp(c.id), 300)); };
A.campXls = (el) => {
  const c = byId('campaigns', el.dataset.id); if (!c) return; const rs = recips(c);
  const rows = [['Ad soyad', c.channel === 'email' ? 'E-posta' : 'Telefon', 'Sadakat seviyesi', 'Segment', 'Son konaklama', 'Konaklama', 'Kişiye özel mesaj'], ...rs.map((g) => { const x = gInfo(g); return [g.name, c.channel === 'email' ? g.email : g.phone, x.tier ? x.tier.name : '', RFM[x.rfm], x.last, x.stays, fillC(c.text, g, c).replace(/^#\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1')]; })];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Alıcılar');
  saveFile(`Kampanya-${c.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
};

/* ---------- program ayarları ---------- */
A.progEdit = () => {
  if (!can.admin()) return; const P = prog();
  openForm({ title: 'Sadakat programı', wide: true, data: { name: P.name, tiers: P.tiers.map((x) => ({ ...x, spend: x.spend || '', nights: x.nights || '' })) },
    intro: '<p class="muted" style="margin:0 0 8px">Seviyeleri küçükten büyüğe sıralayın. Misafir; konaklama sayısı, gece ya da harcama koşullarından <b>birini</b> sağlayınca o seviyeye çıkar (0 = kullanılmıyor). Konaklamalar misafir kartındaki geçmişten sayılır.</p>',
    fields: [{ k: 'name', label: 'Program adı', req: true }, { k: 'tiers', label: 'Seviyeler', type: 'rows', addLabel: 'Seviye ekle', heads: ['Seviye', 'Konaklama', 'Gece', 'Harcama ₺', 'Ayrıcalıklar'], sub: [{ k: 'name', ph: 'ör. Altın' }, { k: 'stays', type: 'number', ph: '0' }, { k: 'nights', type: 'number', ph: '0' }, { k: 'spend', type: 'number', ph: '0' }, { k: 'perks', ph: 'ör. oda yükseltme' }] }],
    onSave: async (v) => {
      const tiers = v.tiers.filter((x) => x.name).map((x, i) => ({ k: (P.tiers[i] && P.tiers[i].k) || 't' + Date.now().toString(36) + i, name: x.name, stays: num(x.stays), nights: num(x.nights), spend: num(x.spend), perks: x.perks }));
      if (!tiers.length) throw { userMsg: 'En az bir seviye olmalı.' };
      const { id, ...rest } = S.settings; await S.store.save('settings', { ...rest, id: 'main', loyalty: { name: v.name, tiers } }); toast('Program kaydedildi');
    } });
};

/* ---------- misafir kartı ---------- */
A._loyaltyCard = (g) => {
  const x = gInfo(g); const P = prog();
  return `<div class="card pad"><h3>${esc(P.name)}</h3><div class="acts" style="align-items:center;margin-bottom:6px">${x.tier ? `<span class="badge gold">${esc(x.tier.name)}</span>` : '<span class="badge">Üye değil</span>'}<span class="badge ${RFM_C[x.rfm]}" title="${esc(RFM_HINT[x.rfm])}">${esc(RFM[x.rfm])}</span><span class="badge ${g.mkt === 'evet' ? 'olive' : g.mkt === 'hayir' ? 'red' : ''}">Ticari ileti: ${esc(CONSENT[g.mkt || ''])}</span></div>
    <div class="muted" style="font-size:13px">${fmtNum(x.stays)} konaklama · ${fmtNum(x.nights)} gece${x.spend ? ' · ' + km(x.spend) : ''}${x.next ? ` · <b>${esc(x.next.name)}</b> için ${esc(x.need)} kaldı` : ''}${x.tier && x.tier.perks ? `<br>Ayrıcalıklar: ${esc(x.tier.perks)}` : ''}</div>
    ${can.edit('guests') ? `<div class="acts" style="margin-top:8px"><button class="btn sm" data-act="consentEdit" data-id="${g.id}">${ic('check')} İzin ve seviye</button></div>` : ''}
    ${CAMPS().some((c) => (c.sent || []).some((s) => s.gid === g.id)) ? `<div class="muted" style="font-size:12.5px;margin-top:6px">Kampanyalar: ${CAMPS().filter((c) => (c.sent || []).some((s) => s.gid === g.id)).map((c) => esc(c.name)).join(', ')}</div>` : ''}</div>`;
};
A.consentEdit = (el) => {
  const g = byId('guests', el.dataset.id); if (!g) return;
  openForm({ title: `İzin ve seviye · ${g.name}`, data: { mkt: g.mkt || '', mktAt: g.mktAt || today(), mktSrc: g.mktSrc || '', tierOverride: g.tierOverride || '' },
    fields: [{ k: 'mkt', label: 'Ticari elektronik ileti izni', type: 'select', opts: Object.entries(CONSENT), hint: 'İYS\'ye kayıtlı onay ya da misafirin yazılı izni olmadan kampanya gönderilmez.' }, { k: 'mktAt', label: 'İzin / ret tarihi', type: 'date', half: true }, { k: 'mktSrc', label: 'Kaynak', half: true, ph: 'ör. check-in formu, web sitesi, İYS' },
      { k: 'tierOverride', label: 'Seviye (elle)', type: 'select', opts: [['', 'Otomatik (konaklamalara göre)'], ...prog().tiers.map((x) => [x.k, x.name])] }],
    onSave: async (v) => { await S.store.save('guests', stamp({ ...g, ...v })); toast('Kaydedildi'); } });
};

/* ---------- ana görünüm ---------- */
A.loySet = (el) => { S.loy[el.dataset.f] = el.dataset.v; if (el.dataset.f === 'preset') S.loy.f = { consent: S.loy.f.consent || '', channel: S.loy.f.channel || '' }; A._renderView(); };
A.loyF = (el) => { const k = el.dataset.k; S.loy.f[k] = el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value; A._renderView(); };
A.loyClear = () => { S.loy.f = { consent: '', channel: '' }; S.loy.preset = 'all'; A._renderView(); };
const segL = (f, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${S.loy[f] === v ? 'on' : ''}" data-act="loySet" data-f="${f}" data-v="${v}">${l}</button>`).join('')}</div>`;
A.segXls = () => {
  const l = segment(curF()); if (!l.length) return toast('Segment boş.');
  const rows = [['Ad soyad', 'E-posta', 'Telefon', 'Ülke', 'Şehir', 'Sadakat seviyesi', 'Segment', 'Konaklama', 'Gece', 'Harcama', 'İlk konaklama', 'Son konaklama', 'Gelecek konaklama', 'Ticari ileti izni', 'Etiketler'],
    ...l.map((g) => { const x = gInfo(g); return [g.name, g.email || '', g.phone || '', g.country || '', g.city || '', x.tier ? x.tier.name : '', RFM[x.rfm], x.stays, x.nights, x.spend, x.first, x.last, x.upcoming, CONSENT[g.mkt || ''], (g.tags || []).join(', ')]; })];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Segment');
  saveFile(`Misafir-segmenti-${today()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
};
V.loyalty = {
  title: () => 'Pazarlama & sadakat',
  head: () => `${can.edit('opps') ? `<button class="btn pri" data-act="campNew">${ic('plus')}<span class="hide-m"> Kampanya</span></button>` : ''}<button class="btn" data-act="segXls">${ic('table')}<span class="hide-m"> Segment Excel</span></button>`,
  body: () => {
    const L = S.loy; const P = prog(); const gs = D().guests.filter((g) => !blocked(g)); const inf = gs.map((g) => [g, gInfo(g)]);
    const tabs = `<div class="perfbar">${segL('tab', [['sum', 'Özet'], ['seg', 'Misafir segmentleri'], ['camp', 'Kampanyalar'], ['prog', 'Sadakat programı']])}</div>`;
    const stayers = inf.filter(([, x]) => x.stays); const rep = stayers.filter(([, x]) => x.stays > 1);
    const cons = gs.filter((g) => g.mkt === 'evet').length, ref = gs.filter((g) => g.mkt === 'hayir').length;
    const kband = `<div class="kband">
      <div class="kb"><small>Misafir</small><b>${fmtNum(gs.length)}</b><em>${fmtNum(stayers.length)} konaklaması kayıtlı</em></div>
      <div class="kb"><small>Tekrar gelme oranı</small><b>${pc(stayers.length ? (rep.length / stayers.length) * 100 : null)}</b><em>${fmtNum(rep.length)} misafir 2+ kez geldi</em></div>
      <div class="kb"><small>${esc(P.name)} üyesi</small><b>${fmtNum(inf.filter(([, x]) => x.tier).length)}</b><em>${P.tiers.map((t) => `${esc(t.name)} ${fmtNum(inf.filter(([, x]) => x.tier && x.tier.k === t.k).length)}`).join(' · ')}</em></div>
      <div class="kb ${cons ? '' : 'warn'}"><small>Ticari ileti izni</small><b>${fmtNum(cons)}</b><em>${pc(gs.length ? (cons / gs.length) * 100 : null)} · ${fmtNum(ref)} ret · ${fmtNum(gs.length - cons - ref)} bilinmiyor</em></div>
      <div class="kb"><small>Riskte + kayıp</small><b>${fmtNum(inf.filter(([, x]) => x.rfm === 'risk' || x.rfm === 'lost').length)}</b><em>geri kazanma kampanyası adayı</em></div>
      <div class="kb"><small>Kampanya</small><b>${CAMPS().length}</b><em>${km(CAMPS().reduce((s, c) => s + campResult(c).rev, 0))} kampanya sonrası gelir</em></div></div>`;
    let body = '';
    if (L.tab === 'sum') {
      const rk = Object.keys(RFM); const max = Math.max(1, ...rk.map((k) => inf.filter(([, x]) => x.rfm === k).length));
      const ctry = {}; inf.filter(([, x]) => x.stays).forEach(([g]) => { const k = g.country || 'Belirtilmemiş'; ctry[k] = (ctry[k] || 0) + 1; }); const cl = sortBy(Object.entries(ctry), (e) => e[1], -1).slice(0, 8); const cmax = Math.max(1, ...cl.map((e) => e[1]));
      const mon = Array(12).fill(0); inf.forEach(([g]) => (g.stays || []).forEach((s) => { if (s.checkIn && s.checkIn <= today()) mon[Number(s.checkIn.slice(5, 7)) - 1]++; })); const mmax = Math.max(1, ...mon);
      const near = sortBy(inf.filter(([, x]) => x.next && x.tier), ([, x]) => x.need.length).slice(0, 8);
      body = `<div class="grid g2">
        <div class="card pad"><h3>Misafir segmentleri (RFM)</h3><p class="muted" style="margin:0 0 8px;font-size:12.5px">Son konaklama tarihi ve konaklama sayısına göre. Bir segmente dokunup listeyi açın.</p><div class="bars">${rk.map((k) => { const n = inf.filter(([, x]) => x.rfm === k).length; return `<button class="bar" style="background:none;border:0;width:100%;cursor:pointer;text-align:left" data-act="loyRfm" data-k="${k}"><span title="${esc(RFM_HINT[k])}">${esc(RFM[k])}</span><div class="tr"><i class="${k === 'champ' || k === 'loyal' ? 'olive' : k === 'lost' ? 'red' : ''}" style="width:${(n / max) * 100}%"></i></div><b>${fmtNum(n)}</b></button>`; }).join('')}</div></div>
        <div class="card pad"><h3>Sadakat seviyeleri</h3><table class="tb"><tr><th>Seviye</th><th>Koşul (biri yeter)</th><th class="n">Misafir</th></tr>${P.tiers.map((t) => `<tr><td><b>${esc(t.name)}</b><div class="sub">${esc(t.perks || '')}</div></td><td class="sub">${[t.stays ? `${t.stays}+ konaklama` : '', t.nights ? `${t.nights}+ gece` : '', t.spend ? `${km(t.spend)}+ harcama` : ''].filter(Boolean).join(' · ')}</td><td class="n">${fmtNum(inf.filter(([, x]) => x.tier && x.tier.k === t.k).length)}</td></tr>`).join('')}</table>
          ${near.length ? `<h3 style="margin-top:14px">Bir üst seviyeye yakın</h3><div class="list">${near.map(([g, x]) => `<button class="row" data-act="open" data-col="guests" data-id="${g.id}"><div class="t"><b>${esc(g.name)}</b><span>${esc(x.tier.name)} → ${esc(x.next.name)}: ${esc(x.need)} kaldı</span></div></button>`).join('')}</div>` : ''}</div>
        <div class="card pad"><h3>Konaklama ayları</h3><div class="bars">${mon.map((n, i) => `<div class="bar"><span>${MONTHS[i]}</span><div class="tr"><i style="width:${(n / mmax) * 100}%"></i></div><b>${fmtNum(n)}</b></div>`).join('')}</div></div>
        <div class="card pad"><h3>Misafirlerin ülkesi</h3>${cl.length ? `<div class="bars">${cl.map(([k, n]) => `<div class="bar"><span>${esc(k)}</span><div class="tr"><i style="width:${(n / cmax) * 100}%"></i></div><b>${fmtNum(n)}</b></div>`).join('')}</div>` : '<span class="muted">Konaklama kaydı yok.</span>'}</div></div>`;
    } else if (L.tab === 'seg') {
      const f = curF(); const l = segment(f); const F = L.f;
      const inp = (k, ph, w = 110, type = 'text') => `<input class="inp" style="width:${w}px" type="${type}" data-change="loyF" data-k="${k}" value="${esc(F[k] ?? '')}" placeholder="${esc(ph)}">`;
      const sel = (k, opts) => `<select class="inp" style="width:auto" data-change="loyF" data-k="${k}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(F[k] ?? '') === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      body = `<div class="card pad" style="margin-bottom:14px"><div class="dayhead"><b>Hazır segment</b><select class="inp" style="width:auto" data-change="loyPreset">${PRESETS.map(([k, t]) => `<option value="${k}" ${L.preset === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select><span class="sp"></span><button class="btn sm" data-act="loyClear">Temizle</button>${can.edit('opps') ? `<button class="btn sm pri" data-act="campFromSeg">${ic('mail')} Bu segmente kampanya</button>` : ''}</div>
        <div class="dayhead" style="font-size:13px">${sel('tier', [['', 'Her seviye'], ['-', 'Üye olmayan'], ...P.tiers.map((t) => [t.k, t.name])])}${sel('rfm', [['', 'Her segment'], ...Object.entries(RFM)])}
          ${inp('minStays', 'en az konaklama', 120, 'number')}${inp('maxStays', 'en çok konaklama', 125, 'number')}${inp('notSince', 'X aydır gelmeyen', 130, 'number')}${inp('since', 'son X ayda gelen', 125, 'number')}
          ${inp('months', 'aylar ör. 6,7,8', 120)}${inp('country', 'ülke', 100)}${inp('city', 'şehir', 100)}${inp('tag', 'etiket', 90)}
          ${sel('prop', [['', 'Her tesis'], ...(S.settings.properties || []).map((p) => [p, p])])}${inp('bday', 'doğum günü X gün içinde', 170, 'number')}
          ${sel('consent', [['', 'İzin fark etmez'], ['evet', 'Yalnızca izinli'], ['hayir-degil', 'Reddetmeyenler']])}${sel('channel', [['', 'İletişim fark etmez'], ['email', 'E-postası olan'], ['phone', 'Telefonu olan']])}
          <label style="display:flex;gap:5px;align-items:center"><input type="checkbox" data-change="loyF" data-k="noUpcoming" ${F.noUpcoming ? 'checked' : ''}> gelecek rezervasyonu olmayan</label><label style="display:flex;gap:5px;align-items:center"><input type="checkbox" data-change="loyF" data-k="foreign" ${f.foreign ? 'checked' : ''}> yurt dışı</label><label style="display:flex;gap:5px;align-items:center"><input type="checkbox" data-change="loyF" data-k="vip" ${f.vip ? 'checked' : ''}> VIP</label></div>
        <div class="muted" style="font-size:13px"><b>${fmtNum(l.length)}</b> misafir · ${fmtNum(l.filter((g) => g.mkt === 'evet').length)} izinli · ${fmtNum(l.filter((g) => g.email).length)} e-posta · ${fmtNum(l.filter((g) => g.phone).length)} telefon</div></div>
        ${l.length ? `<div class="card"><div class="scroll-x"><table class="tb perf-t"><tr><th>Misafir</th><th>Seviye</th><th>Segment</th><th class="n">Konaklama</th><th class="n">Gece</th><th class="n">Harcama</th><th>Son konaklama</th><th>İletişim</th><th>İzin</th></tr>${l.slice(0, 400).map((g) => { const x = gInfo(g); return `<tr style="cursor:pointer" data-act="open" data-col="guests" data-id="${g.id}"><td><b>${esc(g.name)}</b><div class="sub">${esc([g.city, g.country].filter(Boolean).join(', '))}</div></td><td>${x.tier ? esc(x.tier.name) : '—'}</td><td><span class="badge ${RFM_C[x.rfm]}">${esc(RFM[x.rfm])}</span></td><td class="n">${x.stays}</td><td class="n">${x.nights}</td><td class="n">${x.spend ? km(x.spend) : '—'}</td><td>${x.last ? esc(fmtDate(x.last)) : '—'}${x.upcoming ? `<div class="sub">gelecek: ${esc(fmtDate(x.upcoming))}</div>` : ''}</td><td class="sub">${g.email ? 'e-posta ' : ''}${g.phone ? 'tel' : ''}</td><td><span class="badge ${g.mkt === 'evet' ? 'olive' : g.mkt === 'hayir' ? 'red' : ''}">${g.mkt === 'evet' ? 'Var' : g.mkt === 'hayir' ? 'Ret' : '?'}</span></td></tr>`; }).join('')}</table></div>${l.length > 400 ? `<div class="pad muted">İlk 400 gösteriliyor; tamamı Excel'de.</div>` : ''}</div>` : '<div class="card empty">Bu filtreye uyan misafir yok.</div>'}`;
    } else if (L.tab === 'camp') {
      const cs = sortBy(CAMPS(), (c) => c.createdAt || 0, -1);
      body = cs.length ? `<div class="card"><div class="scroll-x"><table class="tb perf-t"><tr><th>Kampanya</th><th>Kanal</th><th>Durum</th><th class="n">Hedef</th><th class="n">Gönderilen</th><th class="n">Dönüş</th><th class="n">Gelir</th><th>Geçerlilik</th></tr>${cs.map((c) => { const r = campResult(c); return `<tr style="cursor:pointer" data-act="campOpen" data-id="${c.id}"><td><b>${esc(c.name)}</b><div class="sub">${esc(c.offer || '')}${c.code ? ' · ' + esc(c.code) : ''}</div></td><td>${esc(CH[c.channel])}</td><td><span class="badge ${c.status === 'gonderildi' ? 'olive' : 'gold'}">${esc(C_ST[c.status] || 'Taslak')}</span></td><td class="n">${fmtNum(segment(c.filter || {}).length)}</td><td class="n">${fmtNum(r.sent)}</td><td class="n">${fmtNum(r.conv)} <span class="sub">${pc(r.sent ? (r.conv / r.sent) * 100 : null)}</span></td><td class="n">${km(r.rev)}</td><td class="sub">${esc([fmtDate(c.validFrom), fmtDate(c.validTo)].filter(Boolean).join(' – '))}</td></tr>`; }).join('')}</table></div></div>`
        : `<div class="card empty"><b>Henüz kampanya yok</b>Segment seçin, mesajı yazın; izinli misafirlere e-posta ya da WhatsApp ile gönderin. Gönderimden sonraki konaklamalar kampanyanın sonucuna yazılır.${can.edit('opps') ? `<div class="acts" style="justify-content:center;margin-top:10px"><button class="btn pri" data-act="campNew">${ic('plus')} Kampanya</button></div>` : ''}</div>`;
    } else {
      body = `<div class="card pad"><div style="display:flex;align-items:center;gap:10px"><h3 style="margin:0;flex:1">${esc(P.name)}</h3>${can.admin() ? `<button class="btn sm pri" data-act="progEdit">${ic('pencil')} Programı düzenle</button>` : ''}</div>
        ${S.settings.loyalty ? '' : '<p class="muted" style="font-size:12.5px">Şu an örnek seviyeler ve ayrıcalıklar görünüyor; kendi programınıza göre düzenleyin.</p>'}
        <table class="tb" style="margin-top:8px"><tr><th>Seviye</th><th class="n">Konaklama</th><th class="n">Gece</th><th class="n">Harcama</th><th>Ayrıcalıklar</th><th class="n">Misafir</th></tr>${P.tiers.map((t) => `<tr><td><b>${esc(t.name)}</b></td><td class="n">${t.stays || '—'}</td><td class="n">${t.nights || '—'}</td><td class="n">${t.spend ? km(t.spend) : '—'}</td><td>${esc(t.perks || '')}</td><td class="n">${fmtNum(inf.filter(([, x]) => x.tier && x.tier.k === t.k).length)}</td></tr>`).join('')}</table>
        <p class="muted" style="font-size:12.5px;margin-bottom:0">Seviye, misafir kartındaki konaklama geçmişinden (giriş tarihi bugünden önce olanlar) hesaplanır; koşullardan biri yeterlidir. Misafir kartında "İzin ve seviye" ile seviye elle de verilebilir. Kampanyalar yalnızca ticari ileti izni "Var" olan misafirlere gider.</p></div>`;
    }
    return `<div class="perf">${tabs}${kband}${body}</div>`;
  },
};
A.loyPreset = (el) => { S.loy.preset = el.value; S.loy.f = { consent: S.loy.f.consent || '', channel: S.loy.f.channel || '' }; A._renderView(); };
A.loyRfm = (el) => { S.loy.tab = 'seg'; S.loy.preset = 'all'; S.loy.f = { consent: '', channel: '', rfm: el.dataset.k }; A._renderView(); };
