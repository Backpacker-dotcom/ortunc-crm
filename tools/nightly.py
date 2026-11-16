#!/usr/bin/env python3
"""Ortunç & Elia gece raporlarını (PDF) okuyup günlük performans satırları üretir.
Kullanım: python3 nightly.py dosya1.pdf dosya2.pdf ...  -> JSON (stdout)
Çıktı: {"daily":[{...}], "otb":[{hotel, asOf, date, rooms, roomRev}], "files":[...]}"""
import json, re, subprocess, sys

def txt(path):
    return subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True).stdout

def num(s):
    s = s.strip().replace('%', '').replace('(', '').replace(')', '').replace(' ', '')
    neg = s.startswith('-')
    s = s.lstrip('-+')
    if not s: return None
    if ',' in s and '.' in s:
        if s.rfind(',') > s.rfind('.'): s = s.replace('.', '').replace(',', '.')
        else: s = s.replace(',', '')
    elif ',' in s:
        s = s.replace(',', '') if re.fullmatch(r'\d{1,3}(,\d{3})+', s) else s.replace(',', '.')
    elif '.' in s and re.fullmatch(r'\d{1,3}(\.\d{3})+', s):
        s = s.replace('.', '')
    try: v = float(s)
    except ValueError: return None
    return -v if neg else v

NUM = r'-?\s?[\d.,]+%?'
def row(t, label, n=None):
    """etiketin ardından gelen sayıları döndürür (ilk eşleşen satır)"""
    for line in t.splitlines():
        m = re.match(r'\s*' + re.escape(label) + r'\s{2,}(.*)$', line)
        if m:
            vals = [num(x) for x in re.findall(r'-\s?[\d.,]+|\(?[\d.,]+%?\)?', m.group(1))]
            vals = [v for v in vals if v is not None]
            return vals[:n] if n else vals
    return []

def d6(s):  # 15.11.26 / 15.11.2026 -> 2026-11-15
    d, m, y = s.split('.')
    y = '20' + y if len(y) == 2 else y
    return f'{y}-{m}-{d}'

HIST = []
CAP = {'ortunc': 40, 'elia': 17}

# ---------------- Ortunç (Opera Manager Flash) ----------------
def ortunc_flash_gross(t):
    m = re.search(r'Month to Date\s+(\d\d\.\d\d\.\d\d)', t)
    if not m: return None
    r = {'hotel': 'ortunc', 'date': d6(m.group(1))}
    for k, lab in [('roomRevG', 'Room Revenue'), ('fbRevG', 'Food And Beverage Revenue'), ('totalRevG', 'Total Revenue'), ('adrG', 'ADR')]:
        v = row(t, lab)
        if len(v) >= 6:
            r[k] = v[0]; r[k + '_mtd'] = v[1]; r[k + '_ytd'] = v[2]; r[k + '_ly'] = v[3]; r[k + '_lymtd'] = v[4]; r[k + '_lyytd'] = v[5]
    return r

def ortunc_bf(t):
    """Günlük Gelir (Revenue by Transaction Codes, net): Pension Breakfast kodları 2000-2012 toplamı"""
    m = re.search(r'Month to Date \(Date (\d\d\.\d\d\.\d\d)\)', t)
    if not m: return None
    tot = [0.0, 0.0, 0.0]; seen = False
    for line in t.splitlines():
        mm = re.match(r'\s*(20[01]\d)\s+Pension Breakfast.*?\s{2,}(-?\s?[\d.,]+)\s+(-?\s?[\d.,]+)\s+(-?\s?[\d.,]+)\s*$', line)
        if mm:
            seen = True
            for i in range(3): tot[i] += num(mm.group(i + 2)) or 0
    if not seen: return None
    return {'hotel': 'ortunc', 'date': d6(m.group(1)), 'bfRev': round(tot[0], 2), 'bfRev_mtd': round(tot[1], 2), 'bfRev_ytd': round(tot[2], 2)}

def ortunc_flash(t):
    m = re.search(r'Month to Date\s+(\d\d\.\d\d\.\d\d)', t)
    if not m: return None
    date = d6(m.group(1))
    g = lambda lab, i=0: (row(t, lab) + [None] * 6)[i]
    r = {'hotel': 'ortunc', 'date': date, 'src': 'Manager Flash'}
    for k, lab in [('rooms', 'Total Rooms in Hotel'), ('occ', 'Rooms Occupied'), ('occPct', '% Rooms Occupied'), ('ooo', 'Out of Order Rooms'),
                   ('comp', 'Complimentary Rooms'), ('pax', 'Total In-House Persons'), ('arr', 'Arrival Rooms'), ('dep', 'Departure Rooms'),
                   ('noShow', 'No Show Rooms'), ('newRes', 'Reservations Made Today'), ('cxl', 'Reservation Cancellations made Today'),
                   ('rnRes', 'Room Nights Reserved Today'), ('adr', 'ADR'), ('revpar', 'REVPAR'), ('roomRev', 'Room Revenue'),
                   ('fbRev', 'Food And Beverage Revenue'), ('otherRev', 'Other Revenue'), ('totalRev', 'Total Revenue'),
                   ('taRooms', 'Travel Agent Rooms In-House'), ('groupRooms', 'Group Rooms In-House'), ('compRooms', 'Company Rooms In-House')]:
        v = row(t, lab)
        # Flash: [gün, ay, yıl, gy-gün, gy-ay, gy-yıl]; "Total Rooms in Hotel" altında boş etiketli bir satır daha var, sorun değil
        if len(v) >= 6:
            r[k] = v[0]; r[k + '_mtd'] = v[1]; r[k + '_ytd'] = v[2]; r[k + '_ly'] = v[3]; r[k + '_lymtd'] = v[4]; r[k + '_lyytd'] = v[5]
        elif v:
            r[k] = v[0]
    return r

def ortunc_fc(t):
    m = re.search(r'History\s*\n\s*(\d\d\.\d\d\.\d\d)', t)
    asOf = d6(m.group(1)) if m else None
    out = []; part = None
    for line in t.splitlines():
        s = line.strip()
        if s.startswith('History'): part = 'h'; continue
        if s.startswith('Forecast'): part = 'f'; continue
        m = re.match(r'(\d\d\.\d\d\.\d\d)\s+\w{3}\s+(\d+)\s+(\d+)\s+.*?([\d.,]+)%\s+([\d.,]+)\s+([\d.,]+)', s)
        if not m: continue
        if part == 'f':
            out.append({'hotel': 'ortunc', 'asOf': asOf, 'date': d6(m.group(1)), 'rooms': int(m.group(2)), 'occPct': num(m.group(4)), 'roomRev': num(m.group(5))})
        elif part == 'h':
            occ = int(m.group(2)); op = num(m.group(4)) or 0; rr = num(m.group(5)) or 0
            HIST.append({'hotel': 'ortunc', 'date': d6(m.group(1)), 'occ': occ, 'occPct': op, 'rooms': round(occ * 100 / op) if op else CAP['ortunc'],
                         'arr': int(m.group(3)), 'roomRev': rr, 'adr': round(rr / occ, 2) if occ else 0, 'src': 'geçmiş'})
    return out

def ortunc_yearly(t):
    """Yearly Forecast (Yıllık Doluluk): her gün için kesin (D) oda sayısı -> ileri tarihli satışlar"""
    hdr = re.search(r'ORTUNC HOTEL\s+(\d\d\.\d\d\.\d\d)', t)
    if not hdr: return []
    import datetime
    asof = (datetime.datetime.strptime(hdr.group(1), '%d.%m.%y').date() - datetime.timedelta(days=1)).isoformat()
    lines = t.splitlines(); out = []; i = 0
    while i < len(lines):
        mh = list(re.finditer(r'(\d{4}) - (\d\d)', lines[i]))
        if len(mh) >= 2 and i + 1 < len(lines) and re.search(r'\bDAY\b', lines[i + 1]):
            cols = [(m.end(), 'D') if m.group(0) == 'D' else (m.end(), 'ND') for m in re.finditer(r'\bN?D\b', lines[i + 1])]
            dcols = [c for c in cols if c[1] == 'D']
            months = [(int(m.group(1)), int(m.group(2))) for m in mh]
            j = i + 2
            while j < len(lines) and re.match(r'\s*\d\d\s', lines[j]):
                day = int(lines[j].split()[0])
                for m in re.finditer(r'\d+', lines[j][lines[j].index(lines[j].split()[0]) + 2:]):
                    end = m.end() + lines[j].index(lines[j].split()[0]) + 2
                    k = min(range(len(cols)), key=lambda q: abs(cols[q][0] - end))
                    if cols[k][1] != 'D' or abs(cols[k][0] - end) > 3: continue
                    mi = dcols.index(cols[k])
                    if mi >= len(months): continue
                    y, mo = months[mi]
                    try: d = datetime.date(y, mo, day).isoformat()
                    except ValueError: continue
                    if d > asof: out.append({'hotel': 'ortunc', 'asOf': asof, 'date': d, 'rooms': int(m.group(0)), 'roomRev': ''})
                j += 1
            i = j
        else:
            i += 1
    return out

# ---------------- Elia (Elektra) ----------------
def elia_mgr(t):
    m = re.search(r'(\d\d\.\d\d\.\d{4})\s*-\s*Local', t)
    if not m: return None
    date = d6(m.group(1))
    def first(lab, idx=0, step=2):
        v = row(t, lab)
        # oda satırları "17 (%100,00) 17 (...) 255 (...) 5.220 (...)" -> değer, yüzde çiftleri
        return v[idx * step] if len(v) > idx * step else None
    def money(lab, idx=0):
        v = row(t, lab); return v[idx] if len(v) > idx else None
    r = {'hotel': 'elia', 'date': date, 'src': 'Günlük Yönetim Raporu'}
    for k, lab in [('rooms', 'Otel Oda Kapasitesi'), ('occ', 'Dolu Oda'), ('ooo', 'Kapalı Odalar(OOO)'), ('comp', 'Comp Oda'), ('pax', 'Toplam Konaklayan Kişi')]:
        r[k] = first(lab, 0); r[k + '_mtd'] = first(lab, 2); r[k + '_ytd'] = first(lab, 3)
    for k, lab in [('arr', 'Gelen Oda'), ('dep', 'Ayrılan Oda')]:
        v = row(t, lab)
        if v: r[k] = v[0]; r[k + '_mtd'] = v[-2] if len(v) >= 4 else None; r[k + '_ytd'] = v[-1]
    if r.get('rooms'): r['occPct'] = round(100 * (r.get('occ') or 0) / r['rooms'], 2)
    if r.get('rooms_mtd'): r['occPct_mtd'] = round(100 * (r.get('occ_mtd') or 0) / r['rooms_mtd'], 2)
    if r.get('rooms_ytd'): r['occPct_ytd'] = round(100 * (r.get('occ_ytd') or 0) / r['rooms_ytd'], 2)
    def rev(lab):
        v = row(t, lab); return (v + [None] * 4)[:4]  # bugün, yarın, aylık, yıllık
    room = rev('Net Oda Geliri'); fb = [rev('Net Yiyecek Geliri'), rev('Net İçecek Geliri'), rev('Net Alkol Geliri'), rev('Net Pansiyon Geliri')]
    oth = rev('Net Diğer Gelirler'); tot = rev('Toplam Net Gelir')
    for k, arr in [('roomRev', room), ('otherRev', oth), ('totalRev', tot)]:
        r[k] = arr[0]; r[k + '_mtd'] = arr[2]; r[k + '_ytd'] = arr[3]
    for j, suf in [(0, ''), (2, '_mtd'), (3, '_ytd')]:
        r['fbRev' + suf] = round(sum((x[j] or 0) for x in fb), 2)
    # pansiyon (kahvaltı) ve brüt tutarlar
    pn, pg, rg, fg, tg = rev('Net Pansiyon Geliri'), rev('Pansiyon Geliri'), rev('Oda Geliri'), [rev('Yiyecek Geliri'), rev('İçecek Geliri'), rev('Alkol İçecek Geliri'), rev('Pansiyon Geliri')], rev('Toplam Gelir')
    for j, suf in [(0, ''), (2, '_mtd'), (3, '_ytd')]:
        r['bfRev' + suf] = pn[j]; r['bfRevG' + suf] = pg[j]; r['roomRevG' + suf] = rg[j]; r['totalRevG' + suf] = tg[j]
        r['fbRevG' + suf] = round(sum((x[j] or 0) for x in fg), 2)
    for suf in ['', '_mtd', '_ytd']:
        o = r.get('occ' + suf) or 0; c = r.get('rooms' + suf) or 0
        r['adr' + suf] = round((r.get('roomRev' + suf) or 0) / o, 2) if o else 0
        r['revpar' + suf] = round((r.get('roomRev' + suf) or 0) / c, 2) if c else 0
    return r

def elia_oz(t):
    """Özet raporundan yeni rezervasyon / iptal / no show (oda)"""
    out = {}
    for k, lab in [('newRes', 'Yeni Rez'), ('cxl', 'İptal'), ('noShow', 'No Show')]:
        m = re.search(re.escape(lab) + r'\s+(\d+)\s', t)
        if m: out[k] = int(m.group(1))
    return out

def elia_fc(t):
    m = re.search(r'Ara Top\.', t)
    asOf = None
    mm = re.search(r'\n\s*Geçmiş\s*\n(?:.*\n)*?\s*(\d\d\.\d\d\.\d\d)', t)
    out = []; part = None; last_hist = None
    for line in t.splitlines():
        s = line.strip()
        if s.startswith('Geçmiş'): part = 'h'; continue
        if s.startswith('Forecast'): part = 'f'; continue
        m = re.match(r'(\d\d\.\d\d\.\d\d)\s+(\d+)\s+(\d+)\s.*\s([\d.,]+)\s+([\d.,]+)$', s)
        if not m: continue
        if part == 'h':
            last_hist = d6(m.group(1)); occ = int(m.group(2)); cap = occ + int(m.group(3))
            # Elia doluluk tablosundaki oda geliri brüttür (KDV + konaklama vergisi dahil); net'e çevrilir
            rr = round((num(m.group(4)) or 0) / (1.11 if last_hist >= '2025-01-01' else 1.122), 2)
            HIST.append({'hotel': 'elia', 'date': last_hist, 'occ': occ, 'rooms': cap, 'occPct': round(100 * occ / cap, 2) if cap else 0, 'roomRev': rr, 'adr': round(rr / occ, 2) if occ else 0, 'src': 'geçmiş'})
        if part == 'f':
            out.append({'hotel': 'elia', 'date': d6(m.group(1)), 'rooms': int(m.group(2)), 'roomRev': round((num(m.group(4)) or 0) / 1.11, 2)})
    for o in out: o['asOf'] = last_hist
    return out

def main(paths):
    daily = {}; otb = []; files = []; yearly = []
    for p in paths:
        t = txt(p); kind = None
        if 'Manager - Flash' in t and 'ORTUNC' in t.upper() and re.search(r'\n\s*Gross\s*\n', t):
            r = ortunc_flash_gross(t); kind = 'ortunc-flash-brut'
            if r: daily.setdefault(('ortunc', r['date']), {}).update(r)
        elif 'Manager - Flash' in t and 'ORTUNC' in t.upper():
            r = ortunc_flash(t); kind = 'ortunc-flash'
            if r: daily.setdefault(('ortunc', r['date']), {}).update(r)
        elif 'Revenue by Transaction Codes' in t and 'ORTUNC' in t.upper():
            r = ortunc_bf(t); kind = 'ortunc-gelir'
            if r: daily.setdefault(('ortunc', r['date']), {}).update(r)
        elif 'Yearly Forecast' in t and 'ORTUNC' in t.upper():
            yearly += ortunc_yearly(t); kind = 'ortunc-yillik'
        elif 'History and Forecast' in t:
            otb += ortunc_fc(t); kind = 'ortunc-forecast'
        elif 'Oda Analizi' in t and 'Gelir Analizi' in t:
            r = elia_mgr(t); kind = 'elia-yonetim'
            if r: daily.setdefault(('elia', r['date']), {}).update(r)
        elif 'Özet Günlük Yönetim Raporu' in t:
            m = re.search(r'Özet Günlük Yönetim Raporu\s*\n\s*(\d\d\.\d\d\.\d{4})', t)
            kind = 'elia-ozet'
            if m: daily.setdefault(('elia', d6(m.group(1))), {}).update(elia_oz(t))
        elif 'Doluluk Grafiği' in t and ('ELİA' in t or 'ELIA' in t):
            otb += elia_fc(t); kind = 'elia-forecast'
        files.append({'file': p.split('/')[-1], 'kind': kind})
    for (h, d), r in daily.items():
        for suf in ['', '_mtd', '_ytd']:
            rn, rg = r.get('roomRev' + suf), r.get('roomRevG' + suf)
            if h == 'ortunc' and r.get('bfRev' + suf) is not None and rn and rg and r.get('bfRevG' + suf) is None:
                r['bfRevG' + suf] = round(r['bfRev' + suf] * rg / rn, 2)
            occ = r.get('occ' + suf)
            if occ and r.get('bfRev' + suf) is not None and rn is not None:
                r['sadr' + suf] = round((rn + r['bfRev' + suf]) / occ, 2)
                if rg is not None and r.get('bfRevG' + suf) is not None: r['sadrG' + suf] = round((rg + r['bfRevG' + suf]) / occ, 2)
            if occ and rg is not None and r.get('adrG' + suf) is None: r['adrG' + suf] = round(rg / occ, 2)
    # geçmiş tablolarındaki günler: aynı gün için tam rapor yoksa eklenir
    for h in HIST:
        k = (h['hotel'], h['date'])
        if k not in daily: daily[k] = dict(h)
    # yıllık doluluk: aylık forecast'in kapsamadığı ileri günler (yalnız oda sayısı)
    have = {(o['hotel'], o['date']) for o in otb}
    otb += [y for y in yearly if (y['hotel'], y['date']) not in have]
    # aynı otel+tarih için en son tahmin
    seen = {}
    for o in otb:
        if o.get('asOf'): seen[(o['hotel'], o['date'])] = o
    return {'daily': [v for v in daily.values() if v.get('date') and v.get('hotel') and 'rooms' in v], 'otb': sorted(seen.values(), key=lambda o: (o['hotel'], o['date'])), 'files': files}


# ---- Google Sheet satır biçimi ----
BASE = ['rooms', 'occ', 'occPct', 'ooo', 'comp', 'pax', 'arr', 'dep', 'noShow', 'newRes', 'cxl', 'rnRes', 'adr', 'revpar', 'roomRev', 'fbRev', 'otherRev', 'totalRev']
PER = ['rooms', 'occ', 'occPct', 'pax', 'arr', 'adr', 'revpar', 'roomRev', 'fbRev', 'otherRev', 'totalRev']
EXTRA = ['bfRev', 'bfRevG', 'roomRevG', 'fbRevG', 'totalRevG', 'adrG', 'sadr', 'sadrG']
DAILY_COLS = (['key', 'hotel', 'date'] + BASE + [k + s for s in ['_mtd', '_ytd'] for k in PER] + [k + s for s in ['_ly', '_lymtd', '_lyytd'] for k in PER] + ['taRooms', 'groupRooms', 'compRooms', 'src', 'updatedAt']
              + [k + s for k in EXTRA for s in ['', '_mtd', '_ytd']] + [k + s for k in ['roomRevG', 'totalRevG', 'adrG'] for s in ['_ly', '_lymtd', '_lyytd']])
OTB_COLS = ['key', 'hotel', 'asOf', 'date', 'rooms', 'roomRev']

def sheet_rows(res, stamp):
    d = []
    for r in sorted(res['daily'], key=lambda r: (r['date'], r['hotel'])):
        r = dict(r, key=f"{r['hotel']}_{r['date']}", updatedAt=stamp)
        d.append([('' if r.get(c) is None else r.get(c)) for c in DAILY_COLS])
    o = [[f"{x['hotel']}_{x['date']}", x['hotel'], x['asOf'], x['date'], x['rooms'], x['roomRev']] for x in res['otb']]
    return {'dailyHeader': DAILY_COLS, 'daily': d, 'otbHeader': OTB_COLS, 'otb': o}

if __name__ == '__main__':
    import datetime
    args = sys.argv[1:]
    res = main([a for a in args if not a.startswith('--')])
    if '--rows' in args: res = dict(res, **sheet_rows(res, datetime.datetime.now().strftime('%Y-%m-%d %H:%M')))
    print(json.dumps(res, ensure_ascii=False))
