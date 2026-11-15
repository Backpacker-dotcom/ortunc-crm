// Teklif revizyonu: mevcut fiyatlar saklanır, yeni fiyat girilir; geçmiş ve fark görünür.
import { S, A, $, esc, ic, today, addDays, fmtDate, iso, byId, recTitle, toast, stamp, can, openForm, recTotals, moneyMap, priceRows, revNo, prevRev, revRec, itemsOf, calcItems, num, money } from './core.js';
import { itemsField } from './forms.js';

const snap = (col, r) => ({
  no: revNo(r), at: Date.now(), by: S.user.name, items: JSON.parse(JSON.stringify(itemsOf(col, r))), deposit: r.deposit ?? '', guests: r.guests ?? '', pax: r.pax ?? '', rooms: r.rooms ?? '',
  currency: r.currency || 'TRY', validUntil: r.validUntil || '', offerSentAt: r.offerSentAt || null, totals: recTotals(col, r),
});
const pctDiff = (oldT, newT) => { const k = Object.keys(newT).find((c) => oldT[c]); if (!k || !oldT[k]) return ''; const d = ((newT[k] - oldT[k]) / oldT[k]) * 100; return Math.abs(d) < 0.05 ? 'değişmedi' : `${d > 0 ? '+' : ''}${d.toFixed(1).replace('.', ',')}%`; };

A.revise = (el) => {
  const col = el.dataset.col, r = byId(col, el.dataset.id); if (!r || !can.edit(col)) return;
  const n = revNo(r);
  openForm({
    title: `Teklifi revize et · Rev. ${n} → Rev. ${n + 1}`, wide: true, saveLabel: 'Revizeyi kaydet',
    intro: `<div class="banner" style="margin:0 0 12px;background:var(--gold-soft)"><span>Şu anki teklif <b>Rev. ${n}</b> olarak saklanacak: <b>${esc(moneyMap(recTotals(col, r)))}</b>. Yeni fiyatları aşağıda düzenleyin; eski teklif kayıtta ve istenirse teklif çıktısında görünür.</span></div>`,
    data: { note: '', items: itemsOf(col, r), deposit: r.deposit ?? '', validUntil: addDays(today(), 10), guests: r.guests, pax: r.pax, rooms: r.rooms, start: r.start, end: r.end, date: r.date },
    fields: [
      { k: 'note', label: 'Revize nedeni', req: true, ph: col === 'weddings' ? 'ör. Çift kişi başı fiyatta indirim istedi; davetli 150\'den 180\'e çıktı' : 'ör. Firma oda fiyatında indirim istedi; coffee break sayısı arttı' },
      ...(col === 'weddings' ? [{ k: 'guests', label: 'Davetli sayısı', type: 'number', half: true }] : [{ k: 'pax', label: 'Kişi sayısı', type: 'number', half: true }, { k: 'rooms', label: 'Oda sayısı', type: 'number', half: true }]),
      itemsField('Yeni fiyat kalemleri', 'Fiyatları, miktarları ya da vergileri değiştirin; kalem ekleyip çıkarabilirsiniz.', col),
      { k: 'deposit', label: col === 'weddings' ? 'İstenen kapora' : 'İstenen ön ödeme', type: 'number', half: true },
      { k: 'validUntil', label: 'Yeni teklif geçerlilik', type: 'date', half: true },
    ],
    onSave: async (v) => {
      const fresh = byId(col, r.id) || r;
      const before = snap(col, fresh);
      const items = (v.items || []).map((x) => ({ name: x.name || '', qty: x.qty === '' ? '' : num(x.qty), price: num(x.price), cur: x.cur || 'TRY', kdv: num(x.kdv), kv: num(x.kv), mode: x.mode === 'ekle' ? 'ekle' : 'dahil' }));
      const upd = { ...fresh, items, deposit: v.deposit, validUntil: v.validUntil, revisions: [...(fresh.revisions || []), { ...before, note: v.note }], offerSentAt: null, revAt: Date.now() };
      if (col === 'weddings') { upd.guests = v.guests; } else { upd.pax = v.pax; upd.rooms = v.rooms; }
      const c = calcItems(items, col === 'weddings' ? (upd.guests || 1) : 1); upd.currency = c.main;
      if (col === 'opps') upd.value = c.by[c.main] ? Math.round(c.by[c.main].gross * 100) / 100 : 0;
      if (col === 'weddings') { upd.perPerson = null; upd.extras = null; upd.discount = null; }
      if (['talep', 'gorusme'].includes(upd.stage)) { upd.stage = 'teklif'; upd.stageAt = Date.now(); }
      const newT = recTotals(col, upd);
      await S.store.save(col, stamp(upd));
      await S.store.save('activities', stamp({ ref: { col, id: r.id }, refName: recTitle(col, upd), type: 'not', date: today(), subject: `Teklif revize edildi (Rev. ${n + 1})`, note: `${moneyMap(before.totals)} → ${moneyMap(newT)} (${pctDiff(before.totals, newT)})\n${v.note}`, userId: S.user.uid, userName: S.user.name }));
      toast(`Rev. ${n + 1} kaydedildi`);
      setTimeout(() => A._reopenOffer && A._reopenOffer(col, r.id), 150);
    },
  });
};

export function revCard(col, r) {
  const list = r.revisions || [];
  if (!list.length) return can.edit(col) ? `<div><button class="btn sm" data-act="revise" data-col="${col}" data-id="${r.id}">${ic('pencil')} Teklifi revize et</button></div>` : '';
  const cur = recTotals(col, r);
  const rows = [...list].reverse().map((rv, i, arr) => {
    const newer = i === 0 ? cur : arr[i - 1].totals || recTotals(col, revRec(r, arr[i - 1]));
    const t = rv.totals || recTotals(col, revRec(r, rv));
    return `<div class="row"><div class="av" style="font-size:12px">R${rv.no}</div><div class="t"><b><s style="color:var(--muted)">${esc(moneyMap(t))}</s> → ${esc(moneyMap(newer))} <span class="badge ${pctDiff(t, newer).startsWith('-') ? 'olive' : 'gold'}">${esc(pctDiff(t, newer))}</span></b><span>${esc(fmtDate(iso(new Date(rv.at))))} · ${esc(rv.by || '')}${rv.offerSentAt ? ' · gönderilmişti' : ''}</span>${rv.note ? `<span>${esc(rv.note)}</span>` : ''}</div><button class="btn sm" data-act="revShow" data-col="${col}" data-id="${r.id}" data-i="${list.indexOf(rv)}">Gör</button></div>`;
  }).join('');
  return `<div class="card"><div class="pad" style="padding-bottom:4px;display:flex;align-items:center;gap:8px"><h3 style="margin:0;flex:1">Revizyonlar · şu an Rev. ${revNo(r)}</h3>${can.edit(col) ? `<button class="btn sm" data-act="revise" data-col="${col}" data-id="${r.id}">${ic('pencil')} Revize et</button>` : ''}</div>
    <div class="row" style="background:var(--primary-soft)"><div class="av" style="font-size:12px">R${revNo(r)}</div><div class="t"><b>${esc(moneyMap(cur))}</b><span>Güncel teklif${r.revAt ? ' · ' + fmtDate(iso(new Date(r.revAt))) : ''}</span></div></div>${rows}</div>`;
}
A.revShow = (el) => {
  const col = el.dataset.col, r = byId(col, el.dataset.id); const rv = (r.revisions || [])[Number(el.dataset.i)]; if (!rv) return;
  const p = priceRows(col, revRec(r, rv));
  $('#modal2').innerHTML = `<div class="ov center"><div class="modal"><div class="mh"><h2>Rev. ${rv.no} · ${esc(fmtDate(iso(new Date(rv.at))))}</h2><button class="x" id="rvX" aria-label="Kapat">${ic('x')}</button></div><div class="mb">
    ${rv.note ? `<p style="margin-top:0"><b>Bu sürüm neden revize edildi:</b> ${esc(rv.note)}</p>` : ''}
    <table class="tb">${p.rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="n">${esc(b)}</td></tr>`).join('')}${p.foot.map(([a, b, k]) => (k === 't' ? `<tr><td><b>${esc(a)}</b></td><td class="n"><b>${esc(b)}</b></td></tr>` : `<tr><td class="muted">${esc(a)}</td><td class="n muted">${esc(b)}</td></tr>`)).join('')}${num(rv.deposit) ? `<tr><td>Kapora / ön ödeme</td><td class="n">${money(num(rv.deposit), rv.currency)}</td></tr>` : ''}</table>
    <p class="muted" style="font-size:12.5px;margin-bottom:0">Hazırlayan: ${esc(rv.by || '')}${rv.validUntil ? ' · geçerlilik ' + fmtDate(rv.validUntil) : ''}</p></div></div></div>`;
  $('#rvX').onclick = () => { $('#modal2').innerHTML = ''; };
};
export const revBadge = (r) => ((r.revisions || []).length ? ` <span class="badge gold">Rev. ${revNo(r)}</span>` : '');
