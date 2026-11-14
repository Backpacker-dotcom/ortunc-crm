import {
  S, A, V, $, $$, esc, ic, ROLES, OPP_STAGES, OPP_KINDS, WED_STAGES, ACT_TYPES, ACC_TYPES, DEFAULT_SETTINGS, MON3, today, fmtDate, money, moneyMap, sumByCur,
  num, fmtNum, sortBy, wedTotal, lastContact, can, toast, errText, openForm, closeModal, infoModal, confirmBox, copyText, stamp, userName, fmtTs,
} from './core.js';
import { localStore, firebaseStore, authMessage, COLS } from './store.js';
import { renderShell, renderView, renderBody, refresh, renderSheet, guestStats } from './views.js';
import { handleImportFile } from './io.js';
import RULES from '../firestore.rules';

const BAKED_CONFIG = __FB_CONFIG__;
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* yok */ } }, del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* yok */ } } };
const K_MODE = 'ortunc-crm.mode', K_CFG = 'ortunc-crm.fbcfg';

/* ================= RAPORLAR ================= */
const bars = (rows, cls = '') => { const max = Math.max(1, ...rows.map((r) => r[1])); return rows.length ? `<div class="bars">${rows.map(([l, v, t]) => `<div class="bar"><span title="${esc(l)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l)}</span><div class="tr"><i class="${cls}" style="width:${(v / max) * 100}%"></i></div><span class="v">${t != null ? t : fmtNum(v)}</span></div>`).join('')}</div>` : '<span class="muted">Veri yok.</span>'; };
const countBy = (list, fn) => { const m = {}; list.forEach((x) => { const k = fn(x) || 'Belirtilmemiş'; m[k] = (m[k] || 0) + 1; }); return sortBy(Object.entries(m), (e) => e[1], -1); };
A.repYear = (el) => { S.repYear = Number(el.value); renderBody(); };
V.reports = {
  title: () => 'Raporlar',
  head: () => {
    const ys = new Set([new Date().getFullYear()]);
    S.data.opps.forEach((o) => o.start && ys.add(Number(o.start.slice(0, 4)))); S.data.weddings.forEach((w) => w.date && ys.add(Number(w.date.slice(0, 4))));
    return `<select class="inp" style="width:auto" data-change="repYear" aria-label="Yıl">${Array.from(ys).sort().map((y) => `<option ${y === S.repYear ? 'selected' : ''}>${y}</option>`).join('')}</select><button class="btn" data-act="exportAll">${ic('download')} Tüm veriler (Excel)</button>`;
  },
  body: () => {
    const y = String(S.repYear), D = S.data;
    const opps = D.opps.filter((o) => (o.start || '').startsWith(y)), weds = D.weddings.filter((w) => (w.date || '').startsWith(y));
    const won = opps.filter((o) => o.stage === 'kazanildi'), lost = opps.filter((o) => o.stage === 'kaybedildi');
    const wWon = weds.filter((w) => w.stage === 'sozlesme'), wLost = weds.filter((w) => w.stage === 'kaybedildi');
    const rate = (a, b) => (a + b ? Math.round((a / (a + b)) * 100) + '%' : '—');
    const mTry = (list, dk, vf) => Array.from({ length: 12 }, (_, i) => list.filter((x) => Number((x[dk] || '').slice(5, 7)) === i + 1 && (x.currency || 'TRY') === 'TRY').reduce((s, x) => s + vf(x), 0));
    const mo = mTry(won, 'start', (o) => num(o.value)), mw = mTry(wWon, 'date', wedTotal); const mmax = Math.max(1, ...mo.map((v, i) => v + mw[i]));
    const acts = D.activities.filter((a) => (a.date || '').startsWith(y));
    const accPerf = sortBy(D.accounts.map((a) => { const os = opps.filter((o) => o.accountId === a.id); return { a, n: acts.filter((x) => x.ref && x.ref.col === 'accounts' && x.ref.id === a.id).length, os: os.length, won: sumByCur(os.filter((o) => o.stage === 'kazanildi'), (o) => num(o.value)), wonN: os.filter((o) => o.stage === 'kazanildi').reduce((s, o) => s + (o.currency === 'TRY' || !o.currency ? num(o.value) : 0), 0), lc: lastContact(a.id) }; }).filter((x) => x.n || x.os), (x) => x.wonN * 1e6 + x.os * 1e3 + x.n, -1).slice(0, 15);
    const topGuests = sortBy(D.guests.map((g) => ({ g, s: guestStats(g) })).filter((x) => x.s.n), (x) => x.s.nights, -1).slice(0, 10);
    const rep = D.guests.filter((g) => (g.stays || []).length > 1).length;
    return `
    <div class="kpis">
      <div class="kpi"><small>Kesinleşen grup & etkinlik</small><b>${won.length}</b><em>${moneyMap(sumByCur(won, (o) => num(o.value)))}</em></div>
      <div class="kpi"><small>Grup kazanma oranı</small><b>${rate(won.length, lost.length)}</b><em>${won.length} kazanıldı · ${lost.length} kaybedildi</em></div>
      <div class="kpi"><small>Sözleşmeli düğün</small><b>${wWon.length}</b><em>${moneyMap(sumByCur(wWon, wedTotal))}</em></div>
      <div class="kpi"><small>Düğün kazanma oranı</small><b>${rate(wWon.length, wLost.length)}</b><em>ort. ${wWon.length ? fmtNum(wWon.reduce((s, w) => s + num(w.guests), 0) / wWon.length) : '—'} davetli</em></div>
      <div class="kpi"><small>Aktivite</small><b>${acts.length}</b><em>${acts.filter((a) => a.type === 'ziyaret').length} satış ziyareti</em></div>
    </div>
    <div class="grid g2">
      <div class="card pad" style="grid-column:1/-1"><h3>Aylık kesinleşen gelir · ${y} (₺)</h3><div class="cols12">${mo.map((v, i) => `<div title="${MON3[i]}: grup ${money(v)} · düğün ${money(mw[i])}"><i class="w" style="height:${(mw[i] / mmax) * 100}%"></i><i style="height:${(v / mmax) * 100}%"></i>${MON3[i]}</div>`).join('')}</div>
        <p class="muted" style="font-size:12.5px;margin:10px 0 0"><span class="badge teal">Grup & etkinlik</span> <span class="badge terra">Düğün</span> Etkinlik tarihine göre; yalnızca TL kayıtlar grafikte, diğer para birimleri üstteki toplamlarda.</p></div>
      <div class="card pad"><h3>Grup & etkinlik · aşamalar</h3>${bars(OPP_STAGES.map(([k, l]) => { const li = opps.filter((o) => o.stage === k); return [l, li.length, `${li.length} · ${moneyMap(sumByCur(li, (o) => num(o.value)))}`]; }))}</div>
      <div class="card pad"><h3>Düğün · aşamalar</h3>${bars(WED_STAGES.map(([k, l]) => { const li = weds.filter((w) => w.stage === k); return [l, li.length, `${li.length} · ${moneyMap(sumByCur(li, wedTotal))}`]; }), 'terra')}</div>
      <div class="card pad"><h3>Talep kaynakları</h3>${bars(countBy(opps.concat(weds), (x) => x.source), 'olive')}</div>
      <div class="card pad"><h3>Kayıp nedenleri</h3>${bars(countBy(lost.concat(wLost), (x) => x.lossReason), 'red')}</div>
      <div class="card pad"><h3>Türe göre talepler</h3>${bars(Object.entries(OPP_KINDS).map(([k, l]) => [l, opps.filter((o) => o.kind === k).length]).concat([['Düğün', weds.length]]))}</div>
      <div class="card pad"><h3>Ekip aktiviteleri</h3>${bars(countBy(acts, (a) => a.userName))}</div>
      <div class="card pad" style="grid-column:1/-1"><h3>Acente / firma performansı · ${y}</h3>${accPerf.length ? `<div class="scroll-x"><table class="tb"><tr><th>Acente / firma</th><th>Tür</th><th class="n">Aktivite</th><th class="n">Talep</th><th class="n">Kesinleşen</th><th>Son temas</th></tr>${accPerf.map((x) => `<tr><td><a href="#" data-act="open" data-col="accounts" data-id="${x.a.id}">${esc(x.a.name)}</a></td><td>${esc(ACC_TYPES[x.a.type] || '')}</td><td class="n">${x.n}</td><td class="n">${x.os}</td><td class="n">${moneyMap(x.won)}</td><td>${fmtDate(x.lc)}</td></tr>`).join('')}</table></div>` : '<span class="muted">Bu yıl için aktivite ya da talep yok.</span>'}</div>
      <div class="card pad"><h3>Misafirler</h3><dl class="dl"><dt>Toplam kayıt</dt><dd>${D.guests.length}</dd><dt>Tekrar gelen</dt><dd>${rep} (${D.guests.length ? Math.round((rep / D.guests.length) * 100) : 0}%)</dd></dl><div style="height:12px"></div>${bars(countBy(D.guests, (g) => g.country || g.city).slice(0, 6), 'olive')}</div>
      <div class="card pad"><h3>En çok konaklayan misafirler</h3>${topGuests.length ? `<table class="tb"><tr><th>Misafir</th><th class="n">Konaklama</th><th class="n">Gece</th></tr>${topGuests.map((x) => `<tr><td><a href="#" data-act="open" data-col="guests" data-id="${x.g.id}">${esc(x.g.name)}</a></td><td class="n">${x.s.n}</td><td class="n">${x.s.nights}</td></tr>`).join('')}</table>` : '<span class="muted">Konaklama kaydı yok.</span>'}</div>
    </div>`;
  },
};

/* ================= AYARLAR ================= */
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
A.editSettings = () => openForm({
  title: 'Otel bilgileri ve listeler', data: { ...S.settings, properties: S.settings.properties.join('\n'), sources: S.settings.sources.join('\n') },
  fields: [
    { k: 'hotelName', label: 'Otel / işletme adı', req: true }, { k: 'phone', label: 'Telefon', type: 'tel', half: true }, { k: 'email', label: 'E-posta', type: 'email', half: true }, { k: 'address', label: 'Adres' },
    { k: 'properties', label: 'Tesisler / mekânlar', type: 'textarea', hint: 'Her satıra bir tane. Talep ve düğün formlarındaki listelerde çıkar.' },
    { k: 'sources', label: 'Talep kaynakları', type: 'textarea', hint: 'Her satıra bir tane.' },
    { k: 'offerNote', label: 'Düğün teklifi alt notu', type: 'textarea' },
  ],
  onSave: async (v) => { await S.store.save('settings', { id: 'main', ...v, properties: lines(v.properties), sources: lines(v.sources) }); toast('Kaydedildi'); },
});
A.newUser = () => openForm({
  title: 'Yeni kullanıcı', saveLabel: 'Kullanıcıyı oluştur',
  intro: '<p class="muted" style="margin-top:0">Geçici şifreyi kullanıcıya siz iletin. Kullanıcı giriş ekranındaki "Şifremi unuttum" ile kendi şifresini belirleyebilir.</p>',
  data: { role: 'satis' },
  fields: [{ k: 'name', label: 'Ad Soyad', req: true }, { k: 'email', label: 'E-posta', type: 'email', req: true }, { k: 'pass', label: 'Geçici şifre (en az 6 karakter)', req: true, half: true }, { k: 'role', label: 'Rol', type: 'select', opts: Object.entries(ROLES), req: true, half: true }],
  onSave: async (v) => { try { await S.store.createUser(v.name, v.email, v.pass, v.role); toast('Kullanıcı oluşturuldu'); } catch (e) { e.userMsg = authMessage(e); throw e; } },
});
A.editUser = (el) => {
  const u = S.data.users.find((x) => x.id === el.dataset.id); if (!u) return; const self = u.id === S.user.uid;
  openForm({
    title: 'Kullanıcıyı düzenle', data: { ...u, active: u.active === false ? 'hayir' : 'evet' },
    fields: [{ k: 'name', label: 'Ad Soyad', req: true }, { k: 'role', label: 'Rol', type: 'select', opts: Object.entries(ROLES), req: true, half: true }, { k: 'active', label: 'Erişim', type: 'select', opts: [['evet', 'Açık'], ['hayir', 'Kapalı (giriş yapamaz)']], req: true, half: true }],
    onSave: async (v) => {
      if (self && (v.role !== 'yonetici' || v.active !== 'evet')) { const e = new Error(); e.userMsg = 'Kendi yönetici yetkinizi ya da erişiminizi kaldıramazsınız.'; throw e; }
      await S.store.save('users', { ...u, name: v.name, role: v.role, active: v.active === 'evet' }); toast('Kaydedildi');
    },
  });
};
A.resetUserPass = async (el) => { const u = S.data.users.find((x) => x.id === el.dataset.id); try { await S.store.resetPassword(u.email); toast('Şifre sıfırlama e-postası gönderildi: ' + u.email); } catch (e) { toast(authMessage(e)); } };
A.copyRules = () => copyText(RULES);
A.showRules = () => infoModal('Firestore güvenlik kuralları', `<p class="muted" style="margin-top:0">Firebase konsolu › Firestore Database › Rules sekmesine yapıştırıp <b>Publish</b>'e basın.</p><pre class="code">${esc(RULES)}</pre>`, `<button class="btn pri" data-act="copyRules">${ic('copy')} Kuralları kopyala</button>`);
A.copyCfgCode = () => copyText(btoa(unescape(encodeURIComponent(LS.get(K_CFG) || JSON.stringify(BAKED_CONFIG)))));
A.logout = () => confirmBox('Oturum kapatılsın mı?', 'Çıkış yap', async () => { await S.store.signOut(); }, false);
A.leaveDemo = () => confirmBox('Demo modundan çıkılacak. Demo kayıtları bu cihazda durmaya devam eder.', 'Çık', async () => { LS.del(K_MODE); location.reload(); }, false);
A.disconnect = () => confirmBox('Bu cihazdaki Firebase bağlantı bilgisi silinecek. Buluttaki verilere dokunulmaz.', 'Bağlantıyı kaldır', async () => { try { await S.store.signOut(); } catch (e) { /* yok */ } LS.del(K_CFG); LS.del(K_MODE); location.reload(); });

V.settings = {
  title: () => 'Ayarlar',
  body: () => {
    const fb = S.store.kind === 'firebase', adm = can.admin(), st = S.settings;
    const perms = [['Yönetici', 'Her şeyi görür ve düzenler; kullanıcıları, ayarları yönetir; kayıt siler.'], ['Satış', 'Acente, misafir, talep, düğün, aktivite ve görev ekler/düzenler. Kayıt silemez.'], ['Ön büro', 'Misafir kayıtlarını, görevleri ve aktiviteleri ekler/düzenler; diğerlerini yalnızca görür.'], ['İzleyici', 'Her şeyi görür, hiçbir şeyi değiştiremez.']];
    return `<div class="grid g2">
      <div class="card pad"><h3>Otel bilgileri</h3><dl class="dl"><dt>İşletme</dt><dd>${esc(st.hotelName)}</dd><dt>Telefon</dt><dd>${esc(st.phone || '—')}</dd><dt>E-posta</dt><dd>${esc(st.email || '—')}</dd><dt>Tesisler</dt><dd>${esc(st.properties.join(', '))}</dd><dt>Kaynaklar</dt><dd>${esc(st.sources.join(', '))}</dd></dl>
        ${adm ? `<div style="margin-top:14px"><button class="btn" data-act="editSettings">${ic('pencil')} Düzenle</button></div>` : ''}</div>
      <div class="card pad"><h3>Excel</h3><p class="muted" style="margin-top:0">Toplu kayıt aktarın ya da tüm veriyi yedek olarak indirin. Aynı adla kayıtlı acenteler atlanır; misafirlerde yeni konaklamalar mevcut kayda eklenir.</p>
        <div class="acts">${can.edit('accounts') ? `<button class="btn" data-act="importPick" data-col="accounts">${ic('upload')} Acente içe aktar</button>` : ''}${can.edit('guests') ? `<button class="btn" data-act="importPick" data-col="guests">${ic('upload')} Misafir içe aktar</button>` : ''}<button class="btn" data-act="exportAll">${ic('download')} Tüm veriyi indir</button></div>
        <div class="acts" style="margin-top:8px"><button class="linkbtn" data-act="template" data-col="accounts">Acente şablonu</button><button class="linkbtn" data-act="template" data-col="guests">Misafir şablonu</button></div></div>
      ${fb ? `<div class="card" style="grid-column:1/-1"><div class="pad" style="padding-bottom:4px;display:flex;align-items:center"><h3 style="margin:0;flex:1">Kullanıcılar</h3>${adm ? `<button class="btn sm pri" data-act="newUser">${ic('plus')} Kullanıcı</button>` : ''}</div>
        <div class="list">${sortBy(S.data.users, (u) => u.name || '').map((u) => `<div class="row"><div class="av">${esc((u.name || '?').slice(0, 1).toLocaleUpperCase('tr-TR'))}</div><div class="t"><b>${esc(u.name)}${u.id === S.user.uid ? ' (siz)' : ''}</b><span>${esc(u.email)}</span></div>
          <div class="r"><span class="badge ${u.active === false ? 'red' : 'teal'}">${u.active === false ? 'Kapalı' : esc(ROLES[u.role] || u.role)}</span></div>${adm ? `<div class="acts"><button class="btn sm" data-act="resetUserPass" data-id="${u.id}" title="Şifre sıfırlama e-postası gönder">Şifre</button><button class="btn sm" data-act="editUser" data-id="${u.id}" aria-label="Düzenle">${ic('pencil')}</button></div>` : ''}</div>`).join('')}</div></div>` : ''}
      <div class="card pad"><h3>Roller</h3><dl class="dl">${perms.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>
      <div class="card pad"><h3>Bağlantı</h3>${fb ? `<p style="margin-top:0">Ekip bulutu bağlı: <b>${esc(S.store.projectId || '')}</b><br><span class="muted">${esc(S.user.email)} · ${esc(ROLES[S.user.role])}</span></p>
          <div class="acts">${adm ? `<button class="btn" data-act="showRules">Güvenlik kuralları</button>` : ''}${adm && !BAKED_CONFIG ? `<button class="btn" data-act="copyCfgCode">${ic('copy')} Bağlantı kodunu kopyala</button>` : ''}<button class="btn" data-act="logout">${ic('logout')} Çıkış yap</button>${!BAKED_CONFIG ? '<button class="btn danger" data-act="disconnect">Bağlantıyı kaldır</button>' : ''}</div>
          ${adm && !BAKED_CONFIG ? '<p class="muted" style="font-size:13px;margin-bottom:0">Bağlantı kodu: ekip arkadaşlarınız uygulamayı ilk açtıklarında "Ekip bulutuna bağlan" ekranına bu kodu yapıştırır.</p>' : ''}`
        : `<p style="margin-top:0"><b>Demo modu.</b> <span class="muted">Kayıtlar yalnızca bu cihazda.</span></p><div class="acts"><button class="btn" data-act="loadSample">Örnek verileri yükle</button>${S.data.accounts.concat(S.data.guests, S.data.opps, S.data.weddings).some((x) => x.sample) ? '<button class="btn danger" data-act="wipeSample">Örnekleri sil</button>' : ''}<button class="btn pri" data-act="leaveDemo">Ekip bulutuna bağlan</button></div>`}
        <p class="muted" style="font-size:12.5px;margin:14px 0 0">Ortunç CRM · sürüm __VERSION__</p></div>
    </div>`;
  },
};

/* ================= GİRİŞ EKRANLARI ================= */
const gateBox = (inner) => { $('#app').innerHTML = `<div class="gate"><div class="box"><h1>${esc(S.settings.hotelName)}</h1><div class="sub">Müşteri İlişkileri Yönetimi</div>${inner}</div></div>`; $('#sheet').innerHTML = ''; };
const gErr = (m) => { const e = $('#gErr'); if (e) { e.textContent = m; e.hidden = false; } };
function parseConfig(txt) {
  let t = String(txt || '').trim(); if (!t) return null;
  if (!t.includes('{') && /^[A-Za-z0-9+/=\s]+$/.test(t)) { try { t = decodeURIComponent(escape(atob(t.replace(/\s/g, '')))); } catch (e) { return null; } }
  const out = {}; const re = /["']?(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId)["']?\s*:\s*["']([^"']+)["']/g; let m;
  while ((m = re.exec(t))) out[m[1]] = m[2];
  return out.apiKey && out.projectId ? out : null;
}
function renderGate() {
  const g = S.gate;
  if (g === 'loading') return gateBox('<p>Yükleniyor…</p>');
  if (g === 'choose') return gateBox(`<p>Acenteler, misafirler, grup ve etkinlik talepleri, düğün teklifleri ve raporlar tek yerde.</p>
    <button class="btn pri" data-act="goConnect">Ekip bulutuna bağlan</button><div class="alt"><button class="btn" data-act="goDemo">Demo olarak dene</button><span class="muted" style="font-size:13px;text-align:center">Demo kayıtları yalnızca bu cihazda durur.</span></div>`);
  if (g === 'connect') return gateBox(`<p>Firebase konsolundaki web uygulaması yapılandırmasını (<code>firebaseConfig</code>) ya da yöneticinizin verdiği bağlantı kodunu yapıştırın.</p>
    <form class="form" id="gForm"><div class="fld"><label for="cfg">Yapılandırma / bağlantı kodu</label><textarea id="cfg" rows="7" style="font-family:monospace;font-size:12.5px" placeholder='const firebaseConfig = {&#10;  apiKey: "…",&#10;  projectId: "…",&#10;  …&#10;};'></textarea></div><div class="err" id="gErr" hidden></div><button class="btn pri">Bağlan</button></form>
    <div class="alt"><button class="linkbtn" data-act="goChoose">Geri</button></div>`);
  if (g === 'setup') return gateBox(`<p><b>İlk kurulum.</b> Bu veritabanında henüz yönetici yok. Oluşturacağınız hesap yönetici olur; diğer kullanıcıları Ayarlar'dan siz eklersiniz.</p>
    <form class="form" id="gForm"><div class="fld"><label for="gn">Ad Soyad</label><input id="gn" required autocomplete="name"></div><div class="fld"><label for="ge">E-posta</label><input id="ge" type="email" required autocomplete="username"></div><div class="fld"><label for="gp">Şifre (en az 6 karakter)</label><input id="gp" type="password" required autocomplete="new-password"></div><div class="err" id="gErr" hidden></div><button class="btn pri">Yönetici hesabını oluştur</button></form>
    <div class="alt"><button class="linkbtn" data-act="goLogin">Zaten hesabım var</button></div>`);
  if (g === 'out') return gateBox(`<form class="form" id="gForm"><div class="fld"><label for="ge">E-posta</label><input id="ge" type="email" required autocomplete="username"></div><div class="fld"><label for="gp">Şifre</label><input id="gp" type="password" required autocomplete="current-password"></div><div class="err" id="gErr" hidden></div><button class="btn pri">Giriş yap</button></form>
    <div class="alt"><button class="linkbtn" data-act="forgot">Şifremi unuttum</button>${BAKED_CONFIG ? '' : '<button class="linkbtn" data-act="disconnect">Farklı bir veritabanına bağlan</button>'}</div>`);
  if (g === 'noaccess') return gateBox(`<p><b>${esc(S.gateInfo.email || '')}</b> hesabının bu sisteme erişim yetkisi yok ya da erişimi kapatılmış. Yöneticinizden sizi kullanıcı olarak eklemesini isteyin.</p><button class="btn" data-act="logoutNow">Farklı hesapla giriş yap</button>`);
  return null;
}
A.goDemo = () => { LS.set(K_MODE, 'local'); boot(); };
A.goConnect = () => { S.gate = 'connect'; renderGate(); };
A.goChoose = () => { S.gate = 'choose'; renderGate(); };
A.goLogin = () => { S.gate = 'out'; S.forceLogin = true; renderGate(); };
A.logoutNow = async () => { await S.store.signOut(); };
A.forgot = async () => { const em = ($('#ge') || {}).value || ''; if (!em) return gErr('Önce e-posta adresinizi yazın.'); try { await S.store.resetPassword(em.trim()); toast('Şifre sıfırlama e-postası gönderildi'); } catch (e) { gErr(authMessage(e)); } };
async function gateSubmit(form) {
  const btn = $('button', form); btn.disabled = true;
  try {
    if (S.gate === 'connect') { const c = parseConfig($('#cfg').value); if (!c) { gErr('Yapılandırma okunamadı. apiKey ve projectId içeren metni eksiksiz yapıştırın.'); return; } LS.set(K_CFG, JSON.stringify(c)); LS.set(K_MODE, 'firebase'); location.reload(); return; }
    if (S.gate === 'setup') await S.store.setupAdmin($('#gn').value.trim(), $('#ge').value.trim(), $('#gp').value);
    else if (S.gate === 'out') await S.store.signIn($('#ge').value.trim(), $('#gp').value);
  } catch (e) { gErr(authMessage(e)); } finally { btn.disabled = false; }
}

/* ================= AÇILIŞ ================= */
function subscribeAll() {
  COLS.forEach((c) => S.store.subscribe(c, (list) => { S.data[c] = list; refresh(); }));
  S.store.subscribeDoc('settings', 'main', (d) => { S.settings = { ...DEFAULT_SETTINGS, ...(d || {}) }; if (!S.settings.properties.length) S.settings.properties = DEFAULT_SETTINGS.properties; const b = $('.brand b'); if (b) b.textContent = S.settings.hotelName; refresh(); });
  if (S.store.kind === 'firebase') S.store.subscribe('users', (list) => { S.data.users = list; refresh(); });
  else S.data.users = [{ id: S.user.uid, name: S.user.name, role: 'yonetici', active: true }];
}
function boot() {
  const cfg = BAKED_CONFIG || (() => { try { return JSON.parse(LS.get(K_CFG) || 'null'); } catch (e) { return null; } })();
  const mode = BAKED_CONFIG ? 'firebase' : LS.get(K_MODE);
  S.gate = 'loading'; renderGate();
  if (mode === 'local') S.store = localStore();
  else if (mode === 'firebase' && cfg) {
    try { S.store = firebaseStore(cfg); S.store.projectId = cfg.projectId; } catch (e) { LS.del(K_CFG); S.gate = 'connect'; renderGate(); gErr('Bağlantı kurulamadı: ' + e.message); return; }
    S.store.onError((e, col) => { if (e && e.code === 'permission-denied') toast(`"${col}" verisi okunamadı: yetki yok. Güvenlik kuralları yayınlandı mı?`); });
  } else { S.gate = 'choose'; renderGate(); return; }
  S.store.init((r) => {
    if (r.state === 'in') {
      const was = S.gate === 'in'; S.user = r.user; S.gate = 'in';
      if (!was) { S.view = 'pano'; subscribeAll(); renderShell(); } else { renderShell(); }
    } else {
      if (r.state === 'setup' && S.forceLogin) r.state = 'out';
      S.gate = r.state; S.gateInfo = r; S.user = null; S.sheet = null; closeModal();
      COLS.forEach((c) => { S.data[c] = []; }); S.data.users = [];
      renderGate();
    }
  });
}

/* ================= OLAYLAR ================= */
document.addEventListener('click', (ev) => {
  const ov = ev.target.classList && ev.target.classList.contains('ov') ? ev.target : null;
  if (ov) { if (ov.closest('#sheet')) A.closeSheet(); else if (ov.closest('#modal') && !$('#frm')) closeModal(); return; }
  const el = ev.target.closest('[data-act]'); if (!el) return;
  if (el.tagName === 'A') ev.preventDefault();
  const fn = A[el.dataset.act]; if (fn) fn(el, ev);
});
document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.id === 'importFile') return handleImportFile(el);
  if (el.dataset && el.dataset.change && A[el.dataset.change]) A[el.dataset.change](el, ev);
});
document.addEventListener('input', (ev) => { if (ev.target.matches && ev.target.matches('[data-search]')) { S.q = ev.target.value; renderBody(); } });
document.addEventListener('submit', (ev) => { if (ev.target.id === 'gForm') { ev.preventDefault(); gateSubmit(ev.target); } });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') window.crmBack(); });
// Kanban sürükle-bırak
let dragId = null;
document.addEventListener('dragstart', (ev) => { const k = ev.target.closest && ev.target.closest('.kc'); if (k) { dragId = k.dataset.id; ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', dragId); } catch (e) { /* yok */ } } });
document.addEventListener('dragover', (ev) => { const c = dragId && ev.target.closest && ev.target.closest('.col'); if (c) { ev.preventDefault(); $$('.col.over').forEach((x) => x !== c && x.classList.remove('over')); c.classList.add('over'); } });
document.addEventListener('drop', (ev) => { const c = dragId && ev.target.closest && ev.target.closest('.col'); $$('.col.over').forEach((x) => x.classList.remove('over')); if (c) { ev.preventDefault(); A.setStage({ dataset: { col: 'opps', id: dragId, v: c.dataset.stage } }); } dragId = null; });
document.addEventListener('dragend', () => { dragId = null; $$('.col.over').forEach((x) => x.classList.remove('over')); });
// Android geri tuşu / Esc
window.crmBack = () => {
  if ($('#modal2').innerHTML) { $('#modal2').innerHTML = ''; return true; }
  if ($('#modal').innerHTML) { closeModal(); return true; }
  if (S.sheet) { A.closeSheet(); return true; }
  if (S.gate === 'in' && S.view !== 'pano') { A.nav({ dataset: { v: 'pano' } }); return true; }
  return false;
};
boot();
