#!/usr/bin/env python3
"""Yeni satırları Google Sheet'teki mevcut satırlarla birleştirir.
python3 sheet_merge.py rows.json gunluk_keys.json otb_rows.json  -> islem planı (JSON)
gunluk_keys.json: [[key, src], ...] (gunluk!A2:A ve src sütunu, başlıksız, sıralı)
otb_rows.json:    otb sayfasının mevcut satırları (başlıksız)
Çıktı: {"updates":[{"range":"gunluk!A5","values":[[...]]}], "append":[[...]], "otb":[[başlık],...tüm satırlar], "summary":...}"""
import json, sys, datetime
FULL = {'Manager Flash', 'Günlük Yönetim Raporu'}
rows = json.load(open(sys.argv[1])); keys = json.load(open(sys.argv[2])); otb_old = json.load(open(sys.argv[3]))
idx = {}
for i, kv in enumerate(keys):
    if kv and kv[0]: idx[kv[0]] = (i + 2, kv[1] if len(kv) > 1 else '')
H = rows['dailyHeader']; src_i = H.index('src')
updates, append, skipped = [], [], 0
for r in rows['daily']:
    k = r[0]
    if k in idx:
        rowno, old_src = idx[k]
        if old_src in FULL and r[src_i] not in FULL: skipped += 1; continue
        updates.append({'range': f'gunluk!A{rowno}', 'values': [r]})
    else:
        append.append(r)
# otb: aynı otel için daha yeni raporun tahmini eskisinin yerine geçer; geçmiş günler silinir
today = datetime.date.today().isoformat()
new = {o[0]: o for o in rows['otb']}
asof_new = {}
for o in rows['otb']: asof_new[o[1]] = max(asof_new.get(o[1], ''), o[2])
keep = []
for o in otb_old:
    if not o or len(o) < 6 or str(o[3]) < today: continue
    if o[0] in new: continue
    if o[1] in asof_new and str(o[2]) < asof_new[o[1]]: continue  # o otelin daha yeni tahmini geldi
    keep.append(o)
otb = sorted(keep + [o for o in rows['otb'] if str(o[3]) >= today], key=lambda o: (o[1], str(o[3])))
print(json.dumps({'updates': updates, 'append': append, 'otb': [rows['otbHeader']] + otb, 'otbClearRows': len(otb_old) + 1,
                  'summary': {'updated': len(updates), 'appended': len(append), 'skipped': skipped, 'otb': len(otb), 'days': sorted({r[2] for r in rows['daily']})}}, ensure_ascii=False))
