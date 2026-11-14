import {
  S, A, ACC_TYPES, ACC_STATUS, OPP_KINDS, OPP_STAGES, WED_STAGES, ACT_TYPES, CURS, opts, openForm, today, stamp, can, toast,
  byId, sortBy, recTitle, COL_LABEL, addDays, userName,
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
      { k: 'notes', label: 'Notlar', type: 'textarea' },
    ],
    onSave: async (v) => { const id = await save('accounts', v, rec); if (!rec) A.open({ dataset: { col: 'accounts', id } }); },
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
      { k: 'birthday', label: 'Doğum günü', type: 'date', half: true },
      { k: 'anniversary', label: 'Evlilik yıl dönümü', type: 'date', half: true },
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
    data: rec || { kind: 'grup', stage: 'talep', currency: 'TRY', ownerId: S.user.uid, property: S.settings.properties[0], ...preset },
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
      { k: 'value', label: 'Tahmini tutar', type: 'number', half: true },
      { k: 'currency', label: 'Para birimi', type: 'select', opts: CURS, req: true, half: true },
      { k: 'source', label: 'Kaynak', type: 'select', opts: listOpts(S.settings.sources), half: true },
      { k: 'ownerId', label: 'Sorumlu', type: 'select', opts: userOpts(), half: true },
      { k: 'lossReason', label: 'Kayıp nedeni (kaybedildiyse)', ph: 'ör. Fiyat, tarih uygun değil, rakip otel' },
      { k: 'notes', label: 'Notlar', type: 'textarea' },
    ],
    onSave: async (v) => {
      if (v.start && v.end && v.end < v.start) { const e = new Error(); e.userMsg = 'Bitiş tarihi başlangıçtan önce olamaz.'; throw e; }
      if (!v.end) v.end = v.start;
      if (v.stage !== (rec && rec.stage)) v.stageAt = Date.now();
      const id = await save('opps', v, rec); if (!rec) A.open({ dataset: { col: 'opps', id } });
    },
    onDelete: delFn('opps', rec),
  });
}

export function weddingForm(rec) {
  openForm({
    title: rec ? 'Düğün teklifini düzenle' : 'Yeni düğün teklifi',
    data: rec || { stage: 'talep', currency: 'TRY', ownerId: S.user.uid, venue: S.settings.properties[0], validUntil: addDays(today(), 15) },
    fields: [
      { k: 'couple', label: 'Çift', req: true, ph: 'ör. Elif & Mert' },
      { k: 'phone', label: 'Telefon', type: 'tel', half: true },
      { k: 'email', label: 'E-posta', type: 'email', half: true },
      { k: 'date', label: 'Düğün tarihi', type: 'date', half: true },
      { k: 'venue', label: 'Mekân', type: 'select', opts: listOpts(S.settings.properties), half: true },
      { k: 'eventType', label: 'Organizasyon', half: true, ph: 'Düğün, nişan, kına, after party…', def: 'Düğün' },
      { k: 'stage', label: 'Aşama', type: 'select', opts: WED_STAGES, req: true, half: true },
      { k: 'guests', label: 'Davetli sayısı', type: 'number', half: true },
      { k: 'perPerson', label: 'Kişi başı fiyat', type: 'number', half: true },
      { k: 'menu', label: 'Menü / paket', ph: 'ör. Ege menüsü, yerli içecek paketi' },
      { k: 'extras', label: 'Ek hizmetler', type: 'rows', addLabel: 'Ek hizmet ekle', sub: [{ k: 'name', ph: 'Hizmet (süsleme, müzik, konaklama…)' }, { k: 'amount', ph: 'Tutar', type: 'number' }] },
      { k: 'discount', label: 'İndirim', type: 'number', half: true },
      { k: 'currency', label: 'Para birimi', type: 'select', opts: CURS, req: true, half: true },
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
