import {
  itemsOf, num, presetsOf,
  S, A, EINV, ACC_TYPES, ACC_STATUS, OPP_KINDS, OPP_STAGES, WED_STAGES, ACT_TYPES, CURS, opts, openForm, today, stamp, can, toast,
  byId, sortBy, recTitle, COL_LABEL, addDays, userName, taxCfg, KDV_OPTS, kvOpts, MODE_OPTS, calcItems, money, esc,
} from './core.js';

const userOpts = () => {
  const l = S.data.users.filter((u) => u.active !== false).map((u) => [u.id, u.name]);
  return l.length ? l : [[S.user.uid, S.user.name]];
};
const accOpts = () => sortBy(S.data.accounts, (a) => a.name.toLocaleLowerCase('tr-TR')).map((a) => [a.id, a.name]);
const listOpts = (arr) => (arr || []).map((x) => [x, x]);
const save = async (col, rec, base) => {
  const obj = stamp({ ...(base || {}), ...rec });
  const id = await S.store.save(col, obj);
  toast('Kaydedildi');
  return id;
};
const delFn = (col, rec) => (rec && can.del(col, rec) ? async () => { await S.store.remove(col, rec.id); if (S.sheet && S.sheet.id === rec.id) { S.sheet = null; } toast('Silindi'); A._refresh(); } : null);


/* ---------- fiyat kalemleri (para birimi + KDV + konaklama vergisi) ---------- */
export function itemsField(label, hint, col) {
  const t = taxCfg();
  return {
    k: 'items', label, type: 'rows', cls: 'items', addLabel: 'Kalem ekle', hint, presets: col ? presetsOf(col) : null,
    heads: ['Kalem', 'Miktar', 'Birim fiyat', 'Para birimi', 'KDV', 'Konaklama vergisi', 'Vergiler'],
    sub: [
      { k: 'name', ph: 'Kalem' }, { k: 'qty', ph: 'Miktar', type: 'number' }, { k: 'price', ph: 'Birim fiyat', type: 'number', neg: true },
      { k: 'cur', type: 'select', opts: CURS, req: true, def: 'TRY' }, { k: 'kdv', type: 'select', opts: KDV_OPTS, req: true, def: String(t.kdv) },
      { k: 'kv', type: 'select', opts: kvOpts(), req: true, def: '0' }, { k: 'mode', type: 'select', opts: MODE_OPTS, req: true, def: t.mode },
    ],
    summary: (rows, get) => {
      const c = calcItems(rows, get('guests') || 1);
      if (!c.lines.length) return '<span class="muted">Kalem girin; toplamlar burada hesaplanır.</span>';
      return c.curs.map((k) => { const x = c.by[k]; return `<table>${c.curs.length > 1 ? `<tr><td colspan="2"><b>${k}</b></td></tr>` : ''}
        <tr><td>Ara toplam (vergiler hariç)</td><td class="n">${money(x.net, k)}</td></tr>
        ${Object.keys(x.kvR).map((r) => `<tr><td>Konaklama vergisi %${r}</td><td class="n">${money(x.kvR[r], k)}</td></tr>`).join('')}
        ${Object.keys(x.kdv).sort().map((r) => `<tr><td>KDV %${r}</td><td class="n">${money(x.kdv[r], k)}</td></tr>`).join('')}
        <tr class="t"><td>Genel toplam</td><td class="n">${money(x.gross, k)}</td></tr></table>`; }).join('<div style="height:8px"></div>');
    },
  };
}
const cleanItems = (items) => (items || []).map((x) => ({ name: x.name || '', qty: x.qty === '' ? '' : num(x.qty), price: num(x.price), cur: x.cur || 'TRY', kdv: num(x.kdv), kv: num(x.kv), mode: x.mode === 'ekle' ? 'ekle' : 'dahil' }));

export function accountForm(rec) {
  openForm({
    title: rec ? 'Acente / firmayı düzenle' : 'Yeni acente / firma',
    data: rec || { type: 'acente', status: 'aktif' },
    fields: [
      { k: 'name', label: 'Firma / acente adı', req: true },
      { k: 'type', label: 'Tür', type: 'select', opts: opts(ACC_TYPES), req: true, half: true },
      { k: 'status', label: 'Durum', type: 'select', opts: opts(ACC_STATUS), req: true, half: true },
      { k: 'city', label: 'Şehir', half: true },
      { k: 'country', label: 'Ülke', half: true },
      { k: 'market', label: 'Pazar / segment', half: true, ph: 'ör. Yurt içi, Balkanlar, MICE' },
      { k: 'ownerId', label: 'Sorumlu', type: 'select', opts: userOpts(), half: true },
      { k: 'phone', label: 'Telefon', type: 'tel', half: true },
      { k: 'email', label: 'E-posta', type: 'email', half: true },
      { k: 'web', label: 'Web sitesi' },
      { k: 'contacts', label: 'Yetkili kişiler', type: 'rows', addLabel: 'Yetkili ekle', sub: [{ k: 'name', ph: 'Ad Soyad' }, { k: 'title', ph: 'Görevi' }, { k: 'phone', ph: 'Telefon', type: 'tel' }, { k: 'email', ph: 'E-posta', type: 'email' }] },
      { k: 'commission', label: 'Komisyon %', type: 'number', half: true },
      { k: 'contractNote', label: 'Kontrat / fiyat notu', half: true, ph: 'ör. 2027 kontratı imzalandı' },
      { k: 'contractStart', label: 'Kontrat başlangıç', type: 'date', half: true },
      { k: 'contractEnd', label: 'Kontrat bitiş', type: 'date', half: true },
      { type: 'section', label: 'Fatura bilgileri', hint: 'Kontrat dosyasını kaydettikten sonra kartın içindeki "Belgeler" bölümünden yükleyebilirsiniz.' },
      { k: 'invTitle', label: 'Ticari ünvan', ph: 'ör. Ets Tur Turizm Seyahat A.Ş.' },
      { k: 'taxOffice', label: 'Vergi dairesi', half: true },
      { k: 'taxNo', label: 'Vergi no / TC kimlik no', half: true, type: 'tel' },
      { k: 'invAddress', label: 'Fatura adresi', type: 'textarea' },
      { k: 'invEmail', label: 'Fatura e-postası', type: 'email', half: true },
      { k: 'eInvoice', label: 'e-Fatura durumu', type: 'select', opts: Object.entries(EINV), half: true },
      { k: 'paymentTerms', label: 'Ödeme koşulu / vade', half: true, ph: 'ör. 30 gün, ön ödeme' },
      { k: 'mersis', label: 'MERSİS no', half: true },
      { k: 'iban', label: 'IBAN', ph: 'TR..' },
      { type: 'section', label: 'Diğer' },
      { k: 'notes', label: 'Notlar', type: 'textarea' },
    ],
    onSave: async (v) => { if (v.taxNo && !/^\d{10,11}$/.test(v.taxNo.replace(/\s/g, ''))) { const e = new Error(); e.userMsg = 'Vergi no 10, TC kimlik no 11 haneli olmalı.'; throw e; } v.taxNo = (v.taxNo || '').replace(/\s/g, ''); v.iban = (v.iban || '').replace(/\s/g, '').toUpperCase(); const id = await save('accounts', v, rec); if (!rec) A.open({ dataset: { col: 'accounts', id } }); },
    onDelete: delFn('accounts', rec),
  });
}

export function guestForm(rec) {
  openForm({
    title: rec ? 'Misafiri düzenle' : 'Yeni misafir',
    data: rec ? { ...rec, tags: (rec.tags || []).join(', ') } : {},
    fields: [
      { k: 'name', label: 'Ad Soyad', req: true },
      { k: 'phone', label: 'Telefon', type: 'tel', half: true },
      { k: 'email', label: 'E-posta', type: 'email', half: true },
      { k: 'city', label: 'Şehir', half: true },
      { k: 'country', label: 'Ülke', half: true },
      { type: 'section', label: 'Doğum günü ve özel günler', hint: 'Yılı bilinmiyorsa günü ve ayı doğru seçin, yıl önemli değil. Bu günlerde misafir "Kutlamalar" ekranına düşer.' },
      { k: 'birthday', label: 'Doğum günü', type: 'date', half: true },
      { k: 'anniversary', label: 'Evlilik yıl dönümü', type: 'date', half: true },
      { k: 'specials', label: 'Diğer özel günler', type: 'rows', addLabel: 'Özel gün ekle', sub: [{ k: 'label', ph: 'Ne? (ör. Kızının doğum günü)' }, { k: 'date', ph: 'Tarih', type: 'date' }] },
      { type: 'section', label: 'Diğer bilgiler' },
      { k: 'tags', label: 'Etiketler', ph: 'VIP, Balayı, Kurumsal…', hint: 'Virgülle ayırın. "VIP" yazarsanız VIP filtresinde görünür.' },
      { k: 'prefs', label: 'Tercihler', type: 'textarea', ph: 'Oda tercihi, yastık, kahvaltı alışkanlığı, sevdiği masa…' },
      { k: 'stays', label: 'Konaklamalar', type: 'rows', addLabel: 'Konaklama ekle', sub: [
        { k: 'checkIn', ph: 'Giriş', type: 'date' }, { k: 'checkOut', ph: 'Çıkış', type: 'date' },
        { k: 'property', ph: 'Tesis', type: 'select', opts: listOpts(S.settings.properties) }, { k: 'room', ph: 'Oda' }, { k: 'amount', ph: 'Tutar', type: 'number' }, { k: 'note', ph: 'Not / kanal' }] },
      { k: 'notes', label: 'Notlar', type: 'textarea' },
    ],
    onSave: async (v) => {
      v.tags = v.tags.split(',').map((t) => t.trim()).filter(Boolean);
      const id = await save('guests', v, rec); if (!rec) A.open({ dataset: { col: 'guests', id } });
    },
    onDelete: delFn('guests', rec),
  });
}

export function oppForm(rec, preset = {}) {
  openForm({
    title: rec ? 'Talebi düzenle' : 'Yeni grup / etkinlik talebi',
    wide: true,
    data: rec ? { ...rec, items: itemsOf('opps', rec) } : { kind: 'grup', stage: 'talep', currency: 'TRY', ownerId: S.user.uid, property: S.settings.properties[0], validUntil: addDays(today(), 10),
      items: [], ...preset },
    fields: [
      { k: 'title', label: 'Başlık', req: true, ph: 'ör. X Firması bayi toplantısı' },
      { k: 'kind', label: 'Tür', type: 'select', opts: opts(OPP_KINDS), req: true, half: true },
      { k: 'stage', label: 'Aşama', type: 'select', opts: OPP_STAGES, req: true, half: true },
      { k: 'accountId', label: 'Acente / firma', type: 'select', opts: accOpts(), half: true },
      { k: 'property', label: 'Tesis', type: 'select', opts: listOpts(S.settings.properties), half: true },
      { k: 'contactName', label: 'İlgili kişi', half: true },
      { k: 'phone', label: 'Telefon', type: 'tel', half: true },
      { k: 'start', label: 'Başlangıç', type: 'date', half: true },
      { k: 'end', label: 'Bitiş', type: 'date', half: true },
      { k: 'pax', label: 'Kişi sayısı', type: 'number', half: true },
      { k: 'rooms', label: 'Oda sayısı', type: 'number', half: true },
      { k: 'program', label: 'Program / menü notu', type: 'textarea', ph: 'ör. 09:00 kayıt, 10:30 coffee break, 12:30 öğle yemeği (açık büfe)…' },
      itemsField('Fiyat kalemleri', 'Önce tarihleri, kişi ve oda sayısını girin; sonra hazır kalemlere dokunun, miktar kendiliğinden hesaplanır (konaklama = oda × gece, yemek = kişi × gün). Özel kalem ile istediğiniz kalemi ekleyin.', 'opps'),
      { k: 'deposit', label: 'İstenen kapora / ön ödeme', type: 'number', half: true },
      { k: 'depositPaid', label: 'Alınan kapora', type: 'number', half: true },
      { k: 'source', label: 'Kaynak', type: 'select', opts: listOpts(S.settings.sources), half: true },
      { k: 'ownerId', label: 'Sorumlu', type: 'select', opts: userOpts(), half: true },
      { k: 'validUntil', label: 'Teklif geçerlilik', type: 'date', half: true },
      { k: 'lossReason', label: 'Kayıp nedeni (kaybedildiyse)', half: true, ph: 'ör. Fiyat, tarih dolu' },
      { k: 'notes', label: 'Notlar', type: 'textarea' },
    ],
    onSave: async (v) => {
      if (v.start && v.end && v.end < v.start) { const e = new Error(); e.userMsg = 'Bitiş tarihi başlangıçtan önce olamaz.'; throw e; }
      if (!v.end) v.end = v.start;
      v.items = cleanItems(v.items); const c = calcItems(v.items, 1);
      v.currency = c.main; v.value = c.by[c.main] ? Math.round(c.by[c.main].gross * 100) / 100 : 0;
      if (v.stage !== (rec && rec.stage)) v.stageAt = Date.now();
      const id = await save('opps', v, rec); if (!rec) A.open({ dataset: { col: 'opps', id } });
    },
    onDelete: delFn('opps', rec),
  });
}

export function weddingForm(rec) {
  openForm({
    title: rec ? 'Düğün teklifini düzenle' : 'Yeni düğün teklifi',
    wide: true,
    data: rec ? { ...rec, items: itemsOf('weddings', rec) } : { stage: 'talep', currency: 'TRY', ownerId: S.user.uid, venue: S.settings.properties[0], validUntil: addDays(today(), 15),
      items: [] },
    fields: [
      { k: 'couple', label: 'Çift', req: true, ph: 'ör. Elif & Mert' },
      { k: 'phone', label: 'Telefon', type: 'tel', half: true },
      { k: 'email', label: 'E-posta', type: 'email', half: true },
      { k: 'date', label: 'Düğün tarihi', type: 'date', half: true },
      { k: 'venue', label: 'Mekân', type: 'select', opts: listOpts(S.settings.properties), half: true },
      { k: 'eventType', label: 'Organizasyon', half: true, ph: 'Düğün, nişan, kına, after party…', def: 'Düğün' },
      { k: 'stage', label: 'Aşama', type: 'select', opts: WED_STAGES, req: true, half: true },
      { k: 'guests', label: 'Davetli sayısı', type: 'number', half: true },
      { k: 'menu', label: 'Menü / paket', half: true, ph: 'ör. Ege menüsü, yerli içecek paketi' },
      itemsField('Fiyat kalemleri', 'Aşağıdaki hazır kalemlere dokunarak ekleyin; miktar davetli / oda / gece sayısından hesaplanır. Her kalemde para birimi, KDV, konaklama vergisi ve vergilerin dahil mi eklenecek mi olduğu seçilir. İndirim için eksi fiyat girin.', 'weddings'),
      { k: 'deposit', label: 'İstenen kapora', type: 'number', half: true },
      { k: 'depositPaid', label: 'Alınan kapora', type: 'number', half: true },
      { k: 'validUntil', label: 'Teklif geçerlilik', type: 'date', half: true },
      { k: 'source', label: 'Kaynak', type: 'select', opts: listOpts(S.settings.sources), half: true },
      { k: 'ownerId', label: 'Sorumlu', type: 'select', opts: userOpts(), half: true },
      { k: 'lossReason', label: 'Kayıp nedeni', half: true },
      { k: 'notes', label: 'Notlar', type: 'textarea' },
    ],
    onSave: async (v) => {
      if (v.stage !== (rec && rec.stage)) v.stageAt = Date.now();
      v.items = cleanItems(v.items); const c = calcItems(v.items, v.guests || 1);
      v.currency = c.main; v.perPerson = null; v.extras = null; v.discount = null;
      const id = await save('weddings', v, rec); if (!rec) A.open({ dataset: { col: 'weddings', id } });
    },
    onDelete: delFn('weddings', rec),
  });
}

const refOf = (col, id) => { const r = byId(col, id); return r ? { ref: { col, id }, refName: recTitle(col, r) } : {}; };

export function activityForm(refCol, refId, rec) {
  const pickAcc = !rec && !refCol;
  openForm({
    title: rec ? 'Aktiviteyi düzenle' : 'Aktivite ekle',
    data: rec || { type: refCol === 'accounts' || pickAcc ? 'ziyaret' : 'telefon', date: today() },
    fields: [
      ...(pickAcc ? [{ k: 'accountId', label: 'Acente / firma', type: 'select', opts: accOpts(), req: true }] : []),
      { k: 'type', label: 'Tür', type: 'select', opts: opts(ACT_TYPES), req: true, half: true },
      { k: 'date', label: 'Tarih', type: 'date', req: true, half: true },
      { k: 'subject', label: 'Konu', req: true, ph: 'ör. 2027 kontrat görüşmesi' },
      { k: 'note', label: 'Görüşme notu', type: 'textarea' },
      ...(rec ? [] : [{ k: 'followUp', label: 'Takip tarihi (isteğe bağlı)', type: 'date', hint: 'Doldurursanız bu kayıt için size bir takip görevi açılır.' }]),
    ],
    onSave: async (v) => {
      const link = rec ? {} : pickAcc ? refOf('accounts', v.accountId) : refOf(refCol, refId);
      const { followUp, accountId, ...a } = v;
      await save('activities', { ...link, ...a, userId: (rec && rec.userId) || S.user.uid, userName: (rec && rec.userName) || S.user.name }, rec);
      if (followUp) await S.store.save('tasks', stamp({ ...link, title: 'Takip: ' + a.subject, due: followUp, done: false, assigneeId: S.user.uid, priority: 'normal' }));
    },
    onDelete: delFn('activities', rec),
  });
}

export function taskForm(refCol, refId, rec) {
  openForm({
    title: rec ? 'Görevi düzenle' : 'Görev / takip ekle',
    data: rec || { due: addDays(today(), 1), assigneeId: S.user.uid, priority: 'normal' },
    fields: [
      { k: 'title', label: 'Yapılacak iş', req: true, ph: 'ör. Teklifi tekrar ara' },
      { k: 'due', label: 'Tarih', type: 'date', req: true, half: true },
      { k: 'assigneeId', label: 'Atanan', type: 'select', opts: userOpts(), req: true, half: true },
      { k: 'priority', label: 'Öncelik', type: 'select', opts: [['normal', 'Normal'], ['yuksek', 'Yüksek']], req: true, half: true },
      { k: 'note', label: 'Not', type: 'textarea' },
    ],
    onSave: async (v) => { await save('tasks', { ...(rec ? {} : refOf(refCol, refId)), ...v, done: rec ? !!rec.done : false }, rec); },
    onDelete: delFn('tasks', rec),
  });
}

export function refLabel(t) {
  if (!t.ref) return '';
  const r = byId(t.ref.col, t.ref.id);
  return (r ? recTitle(t.ref.col, r) : t.refName) || '';
}
export { COL_LABEL, userName };
