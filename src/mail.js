// Kutlama e-postaları: otelin Google hesabındaki küçük bir Apps Script üzerinden gönderilir (ücretsiz).
// Kurulum yapılmamışsa "e-posta uygulamasında aç" (mailto) ile gönderilir.
import { S, A, $, esc, ic, today, fmtDate, iso, toast, errText, stamp, can, copyText, confirmBox, closeModal, occasionsOn, byId } from './core.js';
import { findEv, resolved, evKey, fillCard, plain, cardTemplates, defaultFor } from './cards.js';

const cfg = () => S.settings.mail || {};
export const mailReady = () => !!(cfg().url && cfg().token);
const COLORS = {
  zarif: { bg: '#fdfbf6', ink: '#26332f', head: '#1e5e5a', acc: '#b08d3c' },
  sicak: { bg: '#fbf3ec', ink: '#3a2a22', head: '#a24a26', acc: '#c4633a' },
  pastel: { bg: '#fff7f6', ink: '#3c3036', head: '#b0566d', acc: '#d39aa8' },
  sade: { bg: '#ffffff', ink: '#1b1b1b', head: '#111111', acc: '#1b1b1b' },
};
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/……/g, '');

/* ---------- e-posta içeriği ---------- */
export function mailHtml(tpl, text) {
  const c = COLORS[tpl.theme] || COLORS.zarif; const st = S.settings;
  const lines = String(text).replace(/\r/g, '').split('\n');
  let title = ''; if (lines.length && /^#\s+/.test(lines[0].trim())) title = lines.shift().trim().replace(/^#\s+/, '');
  const paras = []; let cur = []; lines.forEach((l) => { if (!l.trim()) { if (cur.length) paras.push(cur); cur = []; } else cur.push(l); }); if (cur.length) paras.push(cur);
  return `<div style="background:#f3efe8;padding:28px 12px;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:${c.bg};border:2px solid ${c.acc}"><tr><td style="padding:9px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${c.acc}"><tr><td style="padding:38px 30px 30px;text-align:center;color:${c.ink}">
<div style="color:${c.acc};font-size:16px;letter-spacing:10px">&#10022; &#10022; &#10022;</div>
${title ? `<h1 style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:normal;color:${c.head};font-size:34px;line-height:1.15;margin:16px 0 20px">${rich(title)}</h1>` : '<div style="height:18px"></div>'}
${paras.map((p) => `<p style="font-size:16px;line-height:1.65;margin:0 0 15px">${p.map(rich).join('<br>')}</p>`).join('')}
<div style="margin-top:26px;font:bold 11px Arial,sans-serif;letter-spacing:4px;text-transform:uppercase;color:${c.acc}">${esc(st.hotelName)}</div>
</td></tr></table></td></tr></table>
${[st.address, st.phone, st.email].filter(Boolean).length ? `<p style="text-align:center;font:12px/1.5 Arial,sans-serif;color:#8a8a8a;margin:14px 0 0">${[st.address, st.phone, st.email].filter(Boolean).map(esc).join(' &middot; ')}</p>` : ''}</div>`;
}
function messageFor(ev, override) {
  const r = resolved(ev);
  const tpl = override && override.tplId ? (cardTemplates().find((t) => t.id === override.tplId) || r.tpl) : r.tpl;
  const text = override && override.text != null ? fillCard(override.text, ev).text : r.text;
  const subject = fillCard(tpl.subject || defaultFor(ev.type).subject || ev.label, ev).text.replace(/……/g, '').replace(/\s+/g, ' ').trim();
  return { to: ev.g.email, subject, text: plain(text).replace(/……/g, ''), html: mailHtml(tpl, text), missing: fillCard(text, ev).missing };
}

/* ---------- gönderim ---------- */
export async function post(payload) {
  const c = cfg();
  const res = await fetch(c.url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: c.token, fromName: c.fromName || S.settings.hotelName, replyTo: c.replyTo || S.settings.email || '', ...payload }) });
  const txt = await res.text(); let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('Gönderim servisi beklenmedik yanıt verdi. Script "Herkes" erişimiyle dağıtıldı mı?'); }
  if (!j.ok) throw new Error(j.error === 'yetki' ? 'Gönderim anahtarı uyuşmuyor; script kodunu Ayarlar\'daki güncel haliyle yeniden dağıtın.' : (j.error || 'Gönderilemedi'));
  return j;
}
async function logMail(evs, results) {
  for (const ev of evs) {
    const ok = (results || []).find((x) => x.to === ev.g.email && x.ok); if (results && !ok) continue;
    const g = byId('guests', ev.g.id); if (!g) continue;
    try { await S.store.save('guests', stamp({ ...g, mailLog: { ...(g.mailLog || {}), [evKey(ev)]: { at: Date.now(), by: S.user.name, to: ev.g.email } } })); } catch (e) { /* önemli değil */ }
  }
}
function mailto(m) {
  const a = document.createElement('a'); a.href = `mailto:${encodeURIComponent(m.to)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.text)}`; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- kart penceresi ve satırlar ---------- */
A._mailBtn = (ev) => (ev.g.email ? `<button class="btn" data-act="cardMail">${ic('mail')} E-posta gönder</button>` : `<button class="btn" disabled title="Misafirin e-posta adresi yok">${ic('mail')} E-posta yok</button>`);
A._mailState = (ev) => { const l = (ev.g.mailLog || {})[evKey(ev)]; return l ? ` <span class="badge olive" title="${esc(l.to || '')}">E-posta gönderildi</span>` : ev.g.email ? ' <span class="badge gold">E-posta bekliyor</span>' : ''; };
A._mailAllBtn = () => { const n = occasionsOn(S.celDay).filter((e) => e.g.email && !(e.g.mailLog || {})[evKey(e)]).length; return n && can.edit('guests') ? `<button class="btn" data-act="mailAll">${ic('mail')}<span class="hide-m"> E-postaları gönder</span> (${n})</button>` : ''; };

A.cardMail = () => {
  const cc = A._cardCtx(); const ev = findEv(cc.gid, cc.key, cc.day);
  const m = messageFor(ev, { tplId: cc.tplId, text: cc.text });
  if (!mailReady()) {
    $('#modal2').innerHTML = `<div class="ov center"><div class="modal sm"><div class="mh"><h2>E-posta</h2></div><div class="mb"><p style="margin-top:0">Otomatik gönderim henüz kurulmadı (Ayarlar → E-posta gönderimi). Şimdilik e-posta uygulamanızda düz metin olarak açabilirsiniz; kart tasarımı yalnızca otomatik gönderimde gider.</p><p class="muted" style="margin:0">Alıcı: ${esc(m.to)}<br>Konu: ${esc(m.subject)}</p></div>
      <div class="mf"><button class="btn" id="m2no">Vazgeç</button><button class="btn pri" id="m2yes">E-posta uygulamasında aç</button></div></div></div>`;
    $('#m2no').onclick = () => { $('#modal2').innerHTML = ''; };
    $('#m2yes').onclick = () => { $('#modal2').innerHTML = ''; mailto(m); logMail([ev]); };
    return;
  }
  confirmBox(`${m.to} adresine "${m.subject}" konulu kutlama e-postası gönderilsin mi?`, 'Gönder', async () => {
    toast('Gönderiliyor…');
    const j = await post({ action: 'send', messages: [{ to: m.to, subject: m.subject, text: m.text, html: m.html }] });
    const r = (j.results || [])[0];
    if (r && r.ok) { toast('E-posta gönderildi'); await logMail([ev]); setTimeout(() => A._renderCard && A._renderCard(), 60); } else toast('Gönderilemedi: ' + ((r && r.error) || ''));
  }, false);
};

A.mailAll = () => {
  const evs = occasionsOn(S.celDay).filter((e) => e.g.email && !(e.g.mailLog || {})[evKey(e)]);
  if (!evs.length) return;
  const msgs = evs.map((ev) => ({ ev, m: messageFor(ev, (ev.g.cardTexts || {})[evKey(ev)]) }));
  $('#modal').innerHTML = `<div class="ov center"><div class="modal"><div class="mh"><h2>Kutlama e-postaları · ${fmtDate(S.celDay)}</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb">${mailReady() ? '' : `<div class="banner" style="margin-bottom:10px">${ic('warn')}<span>Otomatik gönderim kurulmadı. Her e-posta tek tek e-posta uygulamanızda açılır. Kurulum: Ayarlar → E-posta gönderimi.</span></div>`}
      <p class="muted" style="margin-top:0">Gönderilecekleri işaretleyin. Her misafire kendi kartının metni ve tasarımı gider.</p>
      <div class="list card" style="box-shadow:none">${msgs.map(({ ev, m }, i) => `<label class="row" style="cursor:pointer"><input type="checkbox" data-mi="${i}" checked style="width:20px;height:20px"><div class="t"><b>${esc(ev.g.name)}</b><span>${esc(m.to)} · ${esc(m.subject)}</span>${m.missing.length ? '<span style="color:var(--danger)">Eksik bilgi var; boş yerler e-postada görünmez</span>' : ''}</div></label>`).join('')}</div>
    </div><div class="mf"><button class="btn" data-act="closeModal">Vazgeç</button><button class="btn pri" id="mailGo">${ic('mail')} Gönder</button></div></div></div>`;
  $('#mailGo').onclick = async (e) => {
    const sel = Array.from(document.querySelectorAll('[data-mi]')).filter((x) => x.checked).map((x) => msgs[Number(x.dataset.mi)]);
    if (!sel.length) return toast('Hiçbiri seçilmedi.');
    if (!mailReady()) { closeModal(); sel.forEach(({ m }, i) => setTimeout(() => mailto(m), i * 700)); logMail(sel.map((x) => x.ev)); return; }
    e.target.disabled = true; e.target.textContent = 'Gönderiliyor…';
    try {
      const j = await post({ action: 'send', messages: sel.map(({ m }) => ({ to: m.to, subject: m.subject, text: m.text, html: m.html })) });
      const ok = (j.results || []).filter((r) => r.ok).length, bad = (j.results || []).filter((r) => !r.ok);
      await logMail(sel.map((x) => x.ev), j.results);
      closeModal();
      toast(`${ok} e-posta gönderildi${bad.length ? `, ${bad.length} gönderilemedi (${bad.map((b) => b.to).join(', ')})` : ''}. Kalan günlük hak: ${j.quota ?? '?'}`);
    } catch (err) { toast(errText(err)); e.target.disabled = false; e.target.textContent = 'Tekrar dene'; }
  };
};

/* ---------- Ayarlar: kurulum ---------- */
const scriptCode = (token) => `// Ortunç CRM — kutlama e-postası gönderici
// Bu kod yalnızca doğru anahtarla gelen istekleri gönderir.
const ANAHTAR = '${token}';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== ANAHTAR) return yanit({ ok: false, error: 'yetki' });
    if (d.action === 'ping') {
      return yanit({ ok: true, email: Session.getEffectiveUser().getEmail(), quota: MailApp.getRemainingDailyQuota() });
    }
    const sonuc = [];
    (d.messages || []).slice(0, 50).forEach(function (m) {
      try {
        if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(m.to)) throw new Error('geçersiz adres');
        const o = { to: m.to, subject: m.subject, body: m.text, htmlBody: m.html, name: d.fromName || '' };
        if (d.replyTo) o.replyTo = d.replyTo;
        MailApp.sendEmail(o);
        sonuc.push({ to: m.to, ok: true });
      } catch (err) { sonuc.push({ to: m.to, ok: false, error: String(err && err.message || err) }); }
    });
    return yanit({ ok: true, results: sonuc, quota: MailApp.getRemainingDailyQuota() });
  } catch (err) { return yanit({ ok: false, error: String(err && err.message || err) }); }
}

function yanit(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
`;
export function mailSettingsCard() {
  const c = cfg(); const adm = can.admin();
  return `<div class="card pad" style="grid-column:1/-1"><h3>E-posta gönderimi (kutlama e-postaları)</h3>
    ${mailReady() ? `<p style="margin-top:0"><span class="badge olive">Kurulu</span> Gönderen adı: <b>${esc(c.fromName || S.settings.hotelName)}</b>${c.replyTo || S.settings.email ? ` · Yanıtlar: <b>${esc(c.replyTo || S.settings.email)}</b>` : ''}${c.account ? ` · Hesap: <b>${esc(c.account)}</b>` : ''}</p>`
      : '<p style="margin-top:0" class="muted">Kurulmadı. Kurulana kadar kutlama e-postaları e-posta uygulamanızda düz metin olarak açılır.</p>'}
    <div class="acts">${adm ? `<button class="btn ${mailReady() ? '' : 'pri'}" data-act="mailSetup">${ic('settings')} ${mailReady() ? 'Ayarları düzenle' : 'Kurulumu başlat'}</button>` : ''}${mailReady() ? `<button class="btn" data-act="mailPing">Bağlantıyı dene</button><button class="btn" data-act="mailTest">Kendime deneme e-postası</button>` : ''}</div></div>`;
}
const newToken = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join(''); };
A.mailSetup = async () => {
  let c = { ...cfg() };
  if (!c.token) { c.token = newToken(); const { id, ...rest } = S.settings; await S.store.save('settings', { ...rest, id: 'main', mail: c }); }
  const code = scriptCode(c.token);
  $('#modal').innerHTML = `<div class="ov center"><div class="modal" style="width:min(860px,100%)"><div class="mh"><h2>E-posta gönderimi kurulumu</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb">
      <p style="margin-top:0">E-postalar, aşağıdaki küçük kodu yükleyeceğiniz <b>Google hesabından</b> gönderilir (ücretsiz; Gmail hesabı günde ~100, Google Workspace ~1.500 e-posta). Bir kez yapılır:</p>
      <ol style="margin:0 0 12px;padding-left:20px;line-height:1.7">
        <li>Göndermek istediğiniz Google hesabıyla <b>script.google.com</b> adresini açın → <b>Yeni proje</b>.</li>
        <li>Editördeki her şeyi silin, aşağıdaki kodu yapıştırın, proje adını "Ortunç CRM E-posta" yapıp kaydedin.</li>
        <li><b>Dağıt → Yeni dağıtım</b> → tür: <b>Web uygulaması</b> · Çalıştıran: <b>Ben</b> · Erişim: <b>Herkes</b> → Dağıt → izinleri onaylayın.</li>
        <li>Çıkan <b>Web uygulaması URL</b>'sini aşağıya yapıştırıp kaydedin, sonra "Bağlantıyı dene"ye basın.</li>
      </ol>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><b style="font-size:13px">Kod (anahtar içinde hazır)</b><button class="btn sm" data-act="mailCopyCode">${ic('copy')} Kodu kopyala</button></div>
      <pre class="code" style="max-height:200px">${esc(code)}</pre>
      <div class="form" style="margin-top:12px">
        <div class="fld"><label for="mUrl">Web uygulaması URL</label><input id="mUrl" class="inp" value="${esc(c.url || '')}" placeholder="https://script.google.com/macros/s/…/exec"></div>
        <div class="fld half"><label for="mName">Gönderen adı</label><input id="mName" class="inp" value="${esc(c.fromName || S.settings.hotelName)}"></div>
        <div class="fld half"><label for="mReply">Yanıtlar şu adrese gitsin</label><input id="mReply" class="inp" type="email" value="${esc(c.replyTo || S.settings.email || '')}" placeholder="ör. info@ortuncotel.com"></div>
      </div>
      <p class="muted" style="font-size:12.5px;margin:10px 0 0">Anahtar yalnızca bu sistemin kullanıcılarınca görülebilir. Yeni anahtar üretirseniz kodu script'e yeniden yapıştırıp yeni sürüm dağıtmanız gerekir.</p>
    </div>
    <div class="mf"><button class="btn danger sp" data-act="mailNewToken">Yeni anahtar üret</button><button class="btn" data-act="closeModal">Vazgeç</button><button class="btn pri" data-act="mailSave">Kaydet</button></div></div></div>`;
};
A.mailCopyCode = () => copyText(scriptCode(cfg().token));
A.mailNewToken = () => confirmBox('Yeni anahtar üretilecek; eski script çalışmaz hale gelir ve kodu yeniden yapıştırmanız gerekir.', 'Yeni anahtar', async () => {
  const { id, ...rest } = S.settings; await S.store.save('settings', { ...rest, id: 'main', mail: { ...cfg(), token: newToken() } }); setTimeout(A.mailSetup, 100);
});
A.mailSave = async (el) => {
  const url = $('#mUrl').value.trim();
  if (url && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) { toast('URL "https://script.google.com/macros/s/…/exec" biçiminde olmalı.'); return; }
  el.disabled = true;
  try {
    const { id, ...rest } = S.settings;
    await S.store.save('settings', { ...rest, id: 'main', mail: { ...cfg(), url, fromName: $('#mName').value.trim(), replyTo: $('#mReply').value.trim() } });
    closeModal(); toast('Kaydedildi'); if (url) setTimeout(() => A.mailPing(), 300);
  } catch (e) { toast(errText(e)); el.disabled = false; }
};
A.mailPing = async () => {
  toast('Bağlantı deneniyor…');
  try {
    const j = await post({ action: 'ping' });
    if (can.admin() && j.email && cfg().account !== j.email) { const { id, ...rest } = S.settings; await S.store.save('settings', { ...rest, id: 'main', mail: { ...cfg(), account: j.email } }); }
    toast(`Bağlantı tamam: ${j.email || 'hesap'} · bugün kalan gönderim hakkı ${j.quota}`);
  } catch (e) { toast('Bağlantı kurulamadı: ' + ((e && e.message) || e)); }
};
A.mailTest = async () => {
  const to = S.user.email || cfg().replyTo || S.settings.email;
  if (!to) return toast('Deneme için e-posta adresiniz bulunamadı.');
  const g = { id: 'test', name: (S.user.name || 'Deneme Misafir'), email: to, stays: [] };
  const ev = { type: 'dogum', key: 'dogum', label: 'Doğum günü', date: '1990' + today().slice(4), g, day: today() };
  const tpl = defaultFor('dogum');
  const m = { to, subject: '[Deneme] ' + fillCard(tpl.subject || 'Kutlama', ev).text, text: plain(fillCard(tpl.text, ev).text), html: mailHtml(tpl, fillCard(tpl.text, ev).text) };
  try { toast('Gönderiliyor…'); const j = await post({ action: 'send', messages: [m] }); const r = (j.results || [])[0]; toast(r && r.ok ? `Deneme e-postası ${to} adresine gönderildi` : 'Gönderilemedi: ' + ((r && r.error) || '')); }
  catch (e) { toast('Gönderilemedi: ' + ((e && e.message) || e)); }
};
export { iso };
