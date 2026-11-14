// Misafir toplu aktarma: Excel / CSV (otel programı çıktıları dahil), sütun eşleme, önizleme, doğum günleri
import * as XLSX from 'xlsx';
import { S, A, $, esc, ic, today, iso, fmtDate, trLower, digits, toast, errText, stamp, closeModal, occasionsOn, addDays } from './core.js';
import { newId } from './store.js';

const FIELDS = [
  ['name', 'Ad Soyad', ['ad soyad', 'adı soyadı', 'adi soyadi', 'misafir', 'misafir adı', 'misafir adi', 'guest', 'guest name', 'full name', 'name', 'isim', 'ad soyadı', 'müşteri', 'musteri']],
  ['first', 'Ad', ['ad', 'adı', 'adi', 'first name', 'firstname', 'given name', 'isim']],
  ['last', 'Soyad', ['soyad', 'soyadı', 'soyadi', 'last name', 'lastname', 'surname', 'family name']],
  ['birthday', 'Doğum tarihi', ['doğum tarihi', 'dogum tarihi', 'doğum günü', 'dogum gunu', 'd.tarihi', 'd. tarihi', 'birth date', 'birthdate', 'date of birth', 'dob', 'birthday', 'doğum']],
  ['phone', 'Telefon', ['telefon', 'tel', 'cep', 'gsm', 'cep telefonu', 'phone', 'mobile', 'telephone', 'tel no']],
  ['email', 'E-posta', ['e-posta', 'eposta', 'e-mail', 'email', 'mail']],
  ['country', 'Ülke / uyruk', ['ülke', 'ulke', 'uyruk', 'uyruğu', 'nationality', 'country', 'milliyet']],
  ['city', 'Şehir', ['şehir', 'sehir', 'il', 'city']],
  ['anniversary', 'Evlilik yıl dönümü', ['yıl dönümü', 'yil donumu', 'evlilik yıl dönümü', 'evlilik tarihi', 'anniversary', 'wedding date']],
  ['checkIn', 'Giriş tarihi', ['giriş', 'giris', 'giriş tarihi', 'giris tarihi', 'geliş', 'gelis', 'geliş tarihi', 'arrival', 'check in', 'check-in', 'checkin', 'arr']],
  ['checkOut', 'Çıkış tarihi', ['çıkış', 'cikis', 'çıkış tarihi', 'cikis tarihi', 'gidiş', 'gidis', 'ayrılış', 'departure', 'check out', 'check-out', 'checkout', 'dep']],
  ['room', 'Oda', ['oda', 'oda no', 'oda numarası', 'room', 'room no', 'room number', 'rm']],
  ['property', 'Tesis', ['tesis', 'otel', 'hotel', 'property']],
  ['amount', 'Tutar', ['tutar', 'toplam', 'ücret', 'amount', 'total', 'revenue']],
  ['tags', 'Etiketler', ['etiket', 'etiketler', 'tags', 'vip']],
  ['prefs', 'Tercihler', ['tercih', 'tercihler', 'preferences', 'özel istek', 'special request']],
  ['notes', 'Notlar', ['not', 'notlar', 'açıklama', 'notes', 'remarks', 'comment']],
];
const norm = (s) => trLower(s).replace(/[._:*]/g, ' ').replace(/\s+/g, ' ').trim();
function guessField(h) {
  const n = norm(h); if (!n) return '';
  for (const [k, , al] of FIELDS) if (al.includes(n)) return k;
  for (const [k, , al] of FIELDS) if (al.some((a) => a.length > 3 && n.includes(a))) return k;
  return '';
}
const str = (v) => (v == null ? '' : String(v).trim());

/* ---------- tarih okuma ---------- */
let dayFirst = true;
function toIso(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v)) return iso(new Date(v.getTime() + 12 * 3600e3));
  if (typeof v === 'number' && v > 59 && v < 80000) return iso(new Date(Date.UTC(1899, 11, 30) + v * 864e5 + 12 * 3600e3));
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/))) return valid(m[1], m[2], m[3]);
  if ((m = s.match(/^(\d{1,2})[-./ ](\d{1,2})[-./ ](\d{2,4})/))) {
    let [a, b, y] = [Number(m[1]), Number(m[2]), m[3]];
    if (y.length === 2) { const yy = Number(y); y = String(yy > (new Date().getFullYear() % 100) + 1 ? 1900 + yy : 2000 + yy); }
    return dayFirst ? valid(y, b, a) : valid(y, a, b);
  }
  const t = Date.parse(s); return isNaN(t) ? '' : iso(new Date(t + 12 * 3600e3));
}
function valid(y, m, d) { y = Number(y); m = Number(m); d = Number(d); if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1900 && y < 2200)) return ''; const t = new Date(Date.UTC(y, m - 1, d)); if (t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return ''; return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function detectOrder(values) {
  let df = 0, mf = 0;
  values.forEach((v) => { if (typeof v !== 'string') return; const m = v.trim().match(/^(\d{1,2})[-./ ](\d{1,2})[-./ ]\d{2,4}/); if (!m) return; if (Number(m[1]) > 12) df++; if (Number(m[2]) > 12) mf++; });
  return mf > df ? false : true;
}

/* ---------- dosya okuma ---------- */
let G = null; // { file, rows(array of arrays), headerIdx, headers, map:{colIndex: field} }
A.guestImport = () => { const i = $('#guestFile'); i.value = ''; i.click(); };
export async function handleGuestFile(input) {
  const file = input.files && input.files[0]; if (!file) return;
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, codepage: 65001 });
    let best = null;
    wb.SheetNames.forEach((sn) => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true, blankrows: false });
      for (let r = 0; r < Math.min(15, rows.length); r++) {
        const hits = rows[r].filter((c) => guessField(c)).length;
        if (!best || hits > best.hits) best = { sheet: sn, rows, idx: r, hits };
      }
    });
    if (!best || !best.rows.length) throw new Error('Dosyada veri bulunamadı');
    const headers = best.rows[best.idx].map((h, i) => str(h) || `Sütun ${i + 1}`);
    const map = {}; const used = new Set();
    headers.forEach((h, i) => { const f = guessField(h); if (f && !used.has(f)) { map[i] = f; used.add(f); } });
    const data = best.rows.slice(best.idx + 1).filter((r) => r.some((c) => str(c)));
    G = { file: file.name, sheet: best.sheet, headers, data, map, hIdx: best.idx };
    const dateCols = Object.keys(map).filter((k) => ['birthday', 'anniversary', 'checkIn', 'checkOut'].includes(map[k]));
    dayFirst = detectOrder(data.flatMap((r) => dateCols.map((c) => r[c])));
    G.dayFirst = dayFirst;
    renderMap();
  } catch (e) { toast('Dosya okunamadı: ' + ((e && e.message) || e)); }
}
function renderMap() {
  const ex = (i) => G.data.slice(0, 3).map((r) => str(r[i] instanceof Date ? fmtDate(toIso(r[i])) : r[i])).filter(Boolean).join(' · ');
  const opt = (i) => `<select class="inp" data-gmap="${i}" style="min-height:34px;padding:4px 8px"><option value="">— alma —</option>${FIELDS.map(([k, l]) => `<option value="${k}" ${G.map[i] === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const hasName = Object.values(G.map).some((f) => f === 'name' || f === 'first' || f === 'last');
  $('#modal').innerHTML = `<div class="ov center"><div class="modal" style="width:min(820px,100%)"><div class="mh"><h2>Misafir aktarma · sütunlar</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb"><p style="margin-top:0"><b>${esc(G.file)}</b> <span class="muted">· ${G.data.length} satır${G.sheet ? ' · ' + esc(G.sheet) : ''}</span></p>
      <p class="muted" style="font-size:13.5px;margin-top:0">Sütunları otomatik eşledim. Yanlış olanı soldan değiştirin; almak istemediğinizi "— alma —" yapın.</p>
      ${hasName ? '' : `<div class="banner">${ic('warn')}<span>Ad soyad sütunu bulunamadı. Lütfen ad soyad (ya da ad ve soyad) sütununu seçin.</span></div>`}
      <div class="scroll-x"><table class="tb"><tr><th>Dosyadaki sütun</th><th>Aktarılacak alan</th><th>Örnek</th></tr>
      ${G.headers.map((h, i) => `<tr><td><b>${esc(h)}</b></td><td style="min-width:190px">${opt(i)}</td><td class="muted" style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ex(i))}</td></tr>`).join('')}</table></div>
      <div class="fld" style="margin-top:12px;max-width:340px"><label for="gDayFirst">Tarih yazılışı</label><select id="gDayFirst" class="inp"><option value="1" ${G.dayFirst ? 'selected' : ''}>Gün.Ay.Yıl (14.11.1985)</option><option value="0" ${G.dayFirst ? '' : 'selected'}>Ay/Gün/Yıl (11/14/1985)</option></select></div>
    </div>
    <div class="mf"><button class="btn" data-act="closeModal">Vazgeç</button><button class="btn pri" data-act="gPreview">Önizle</button></div></div></div>`;
}
const readMap = () => { document.querySelectorAll('[data-gmap]').forEach((s) => { if (s.value) G.map[s.dataset.gmap] = s.value; else delete G.map[s.dataset.gmap]; }); G.dayFirst = $('#gDayFirst').value === '1'; dayFirst = G.dayFirst; };

/* ---------- plan ---------- */
const keyName = (s) => trLower(s).replace(/\s+/g, ' ').trim();
const keyPhone = (s) => digits(s).slice(-10);
function plan() {
  const rows = G.data.map((r) => { const o = {}; Object.entries(G.map).forEach(([i, f]) => { o[f] = r[i]; }); return o; });
  const byPhone = new Map(), byName = new Map();
  const entries = S.data.guests.map((g) => ({ g: JSON.parse(JSON.stringify(g)), isNew: false, touched: false, chg: [] }));
  entries.forEach((e) => { const p = keyPhone(e.g.phone); if (p.length >= 7) byPhone.set(p, e); byName.set(keyName(e.g.name), e); });
  let skipped = 0, bad = [];
  rows.forEach((r, idx) => {
    const name = str(r.name) || [str(r.first), str(r.last)].filter(Boolean).join(' ');
    if (!name) { skipped++; return; }
    const ph = keyPhone(r.phone);
    let e = (ph.length >= 7 && byPhone.get(ph)) || byName.get(keyName(name));
    if (!e) {
      e = { isNew: true, touched: true, chg: [], g: { id: newId(), name: name.replace(/\s+/g, ' '), phone: str(r.phone), email: str(r.email), city: str(r.city), country: str(r.country), tags: str(r.tags).split(/[,;]/).map((t) => t.trim()).filter(Boolean), prefs: str(r.prefs), notes: str(r.notes), stays: [] } };
      entries.push(e); if (ph.length >= 7) byPhone.set(ph, e); byName.set(keyName(name), e);
    } else {
      ['phone', 'email', 'city', 'country'].forEach((k) => { if (!e.g[k] && str(r[k])) { e.g[k] = str(r[k]); e.touched = true; } });
    }
    [['birthday', 'birthday'], ['anniversary', 'anniversary']].forEach(([f, k]) => {
      if (str(r[f]) === '' && !(r[f] instanceof Date) && typeof r[f] !== 'number') return;
      const d = toIso(r[f]); if (!d) { bad.push(`Excel ${idx + G.hIdx + 2}. satır (${str(r.name) || [str(r.first), str(r.last)].join(' ')}): ${str(r[f])}`); return; }
      if (e.g[k] !== d) { e.g[k] = d; e.touched = true; if (!e.isNew) e.chg.push(k); }
    });
    const ci = toIso(r.checkIn);
    if (ci && !(e.g.stays || []).some((s) => s.checkIn === ci)) {
      e.g.stays = [...(e.g.stays || []), { checkIn: ci, checkOut: toIso(r.checkOut), property: str(r.property) || S.settings.properties[0], room: str(r.room), amount: Number(String(r.amount || '').replace(/\./g, '').replace(',', '.')) || 0, note: 'Excel aktarımı' }];
      e.touched = true;
    }
  });
  const add = entries.filter((e) => e.isNew), upd = entries.filter((e) => !e.isNew && e.touched);
  const withBd = add.concat(upd).filter((e) => e.g.birthday);
  return { add, upd, skipped, bad, withBd };
}
A.gPreview = () => {
  readMap();
  if (!Object.values(G.map).some((f) => ['name', 'first', 'last'].includes(f))) { toast('Önce ad soyad sütununu seçin.'); return; }
  const p = plan(); G.plan = p;
  const t = today(); const soon = p.withBd.filter((e) => { for (let i = 0; i <= 7; i++) { const d = addDays(t, i); if (e.g.birthday.slice(5) === d.slice(5)) return true; } return false; });
  const todayN = p.withBd.filter((e) => e.g.birthday.slice(5) === t.slice(5)).length;
  $('#modal').innerHTML = `<div class="ov center"><div class="modal" style="width:min(820px,100%)"><div class="mh"><h2>Misafir aktarma · önizleme</h2><button class="x" data-act="closeModal" aria-label="Kapat">${ic('x')}</button></div>
    <div class="mb">
      <div class="kpis" style="margin-bottom:12px"><div class="kpi"><small>Yeni misafir</small><b>${p.add.length}</b></div><div class="kpi"><small>Güncellenecek</small><b>${p.upd.length}</b><em>kayıtlı misafir</em></div><div class="kpi"><small>Doğum günü bulunan</small><b>${p.withBd.length}</b><em>${todayN} kişi bugün</em></div><div class="kpi"><small>Atlanan satır</small><b>${p.skipped}</b><em>ad soyad boş</em></div></div>
      ${p.bad.length ? `<div class="banner">${ic('warn')}<span><b>${p.bad.length} tarih okunamadı</b> (bu satırlarda tarih boş bırakılacak): ${esc(p.bad.slice(0, 4).join(', '))}${p.bad.length > 4 ? '…' : ''}</span></div>` : ''}
      <div class="card" style="box-shadow:none"><div class="pad" style="padding-bottom:4px"><h3>İlk kayıtlar · tarihlerin doğru okunduğunu kontrol edin</h3></div><div class="scroll-x"><table class="tb" style="margin:0 0 6px">
        <tr><th>Ad Soyad</th><th>Doğum tarihi</th><th>Telefon</th><th>Konaklama</th><th></th></tr>
        ${p.add.concat(p.upd).slice(0, 8).map((e) => `<tr><td>${esc(e.g.name)}</td><td>${fmtDate(e.g.birthday)}</td><td>${esc(e.g.phone || '')}</td><td>${(e.g.stays || []).slice(-1).map((s) => esc([fmtDate(s.checkIn), s.room ? 'Oda ' + s.room : ''].filter(Boolean).join(' · '))).join('')}</td><td>${e.isNew ? '<span class="badge teal">Yeni</span>' : '<span class="badge gold">Güncelle</span>'}</td></tr>`).join('')}</table></div></div>
      ${soon.length ? `<p style="margin:12px 0 0">${ic('cake')} Önümüzdeki 7 günde doğum günü olan <b>${soon.length}</b> misafir Kutlamalar ekranına düşecek.</p>` : ''}
    </div>
    <div class="mf"><button class="btn sp" data-act="gBack">Sütunlara dön</button><button class="btn" data-act="closeModal">Vazgeç</button><button class="btn pri" data-act="gGo" ${p.add.length + p.upd.length ? '' : 'disabled'}>${p.add.length + p.upd.length} kaydı aktar</button></div></div></div>`;
};
A.gBack = () => renderMap();
A.gGo = async (el) => {
  const p = G.plan; el.disabled = true; el.textContent = 'Aktarılıyor…';
  try {
    await S.store.saveMany('guests', p.add.concat(p.upd).map((e) => stamp(e.g)));
    const todayN = occasionsOn(today()).filter((o) => o.type === 'dogum').length;
    closeModal(); G = null;
    $('#modal').innerHTML = `<div class="ov center"><div class="modal sm"><div class="mb" style="padding-top:22px"><b>${p.add.length + p.upd.length} misafir aktarıldı.</b><br>${p.withBd.length} misafirin doğum günü kaydedildi. Bugün doğum günü olan: <b>${todayN}</b>.</div>
      <div class="mf"><button class="btn" data-act="closeModal">Tamam</button><button class="btn pri" data-act="nav" data-v="cel">${ic('cake')} Kutlamalara git</button></div></div></div>`;
  } catch (e) { toast(errText(e)); el.disabled = false; el.textContent = 'Tekrar dene'; }
};
A.guestTemplate = () => {
  const heads = ['Ad Soyad', 'Doğum Tarihi', 'Telefon', 'E-posta', 'Ülke', 'Şehir', 'Giriş Tarihi', 'Çıkış Tarihi', 'Oda', 'Tesis', 'Evlilik Yıl Dönümü', 'Etiketler', 'Tercihler', 'Notlar'];
  const ws = XLSX.utils.aoa_to_sheet([heads, ['Ayşe Yılmaz', '14.11.1985', '0532 000 00 00', 'ayse@ornek.com', 'Türkiye', 'İzmir', '14.11.2026', '16.11.2026', '204', S.settings.properties[0], '', 'VIP', 'Deniz manzarası', '']]);
  ws['!cols'] = heads.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Misafirler');
  A._saveFile('Misafir-Aktarim-Sablonu.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
};
export { toIso as guestToIso };
