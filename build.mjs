import { build } from 'esbuild';
import fs from 'node:fs';
const cfgPath = 'firebase-config.json';
const cfg = !process.env.DEMO && fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : null;
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const r = await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false,
  loader: { '.rules': 'text' }, define: { __FB_CONFIG__: JSON.stringify(cfg) }, legalComments: 'none',
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/__VERSION__/g, version);
const fontCss = [['ibm-plex-sans', [400, 500, 600]], ['ibm-plex-sans-condensed', [600]]].flatMap(([fam, ws]) => ws.map((w) => {
  const dir = `node_modules/@fontsource/${fam}`;
  const blocks = fs.readFileSync(`${dir}/${w}.css`, 'utf8').split('/*').filter((b) => /-latin(-ext)?-\d+-normal \*\//.test(b));
  return blocks.map((b) => '/*' + b).join('').replace(/url\(\.\/files\/([^)]+\.woff2)\) format\('woff2'\),?\s*url\([^)]+\) format\('woff'\)/g, (m, f) => `url(data:font/woff2;base64,${fs.readFileSync(`${dir}/files/${f}`).toString('base64')}) format('woff2')`).replace(/\/\*[^*]*\*\//g, '');
})).join('\n');
const css = fontCss + '\n' + fs.readFileSync('src/style.css', 'utf8').replace(/\s*\n\s*/g, '\n');
const html = fs.readFileSync('src/index.tmpl.html', 'utf8').replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
const out = process.env.OUT || 'index.html';
fs.writeFileSync(out, html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' KB', cfg ? 'firebase: ' + cfg.projectId : 'firebase config yok (kurulum ekranı)');
