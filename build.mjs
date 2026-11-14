import { build } from 'esbuild';
import fs from 'node:fs';
const cfgPath = 'firebase-config.json';
const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : null;
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const r = await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false,
  loader: { '.rules': 'text' }, define: { __FB_CONFIG__: JSON.stringify(cfg) }, legalComments: 'none',
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/__VERSION__/g, version);
const css = fs.readFileSync('src/style.css', 'utf8').replace(/\s*\n\s*/g, '\n');
const html = fs.readFileSync('src/index.tmpl.html', 'utf8').replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
fs.writeFileSync('index.html', html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' KB', cfg ? 'firebase: ' + cfg.projectId : 'firebase config yok (kurulum ekranı)');
