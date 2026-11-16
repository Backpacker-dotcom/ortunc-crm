// Ortunç CRM – Otel performans verisi köprüsü (Google Apps Script web uygulaması)
// CRM bu adresi ?t=<anahtar> ile çağırır; tablo sadece anahtarı bilen CRM'e JSON olarak döner.
const SHEET_ID = '1wf3b2M1RbXecudloOj6eS7gkjAWHIz_-tw9noFOi2nE';
const TOKEN = PropertiesService.getScriptProperties().getProperty('TOKEN');

function readTab_(ss, name) {
  const sh = ss.getSheetByName(name); if (!sh) return [];
  const v = sh.getDataRange().getValues(); if (v.length < 2) return [];
  const h = v[0].map(String);
  return v.slice(1).filter(r => r[0] !== '').map(r => {
    const o = {}; h.forEach((k, i) => { let x = r[i]; if (x instanceof Date) x = Utilities.formatDate(x, 'Europe/Istanbul', 'yyyy-MM-dd'); if (x !== '') o[k] = x; }); return o;
  });
}
function doGet(e) {
  const out = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  if (!TOKEN || !e || !e.parameter || e.parameter.t !== TOKEN) return out({ ok: false, error: 'yetkisiz' });
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return out({ ok: true, daily: readTab_(ss, 'gunluk'), otb: readTab_(ss, 'otb'), at: new Date().toISOString() });
}
function kurulum() { PropertiesService.getScriptProperties().setProperty('TOKEN', '__TOKEN__'); SpreadsheetApp.openById(SHEET_ID).getName(); }
