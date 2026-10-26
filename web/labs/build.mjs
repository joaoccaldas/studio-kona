// node web/labs/build.mjs -> web/public/labs/aerolab.html (standalone; not part of the Kona bundle)
import { build } from 'esbuild'; import fs from 'fs'; import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname);
const r = await build({ entryPoints: [path.join(here, 'demo.js')], bundle: true, format: 'esm', minify: true, write: false, target: 'es2022', loader: { '.json': 'json' } });
const app = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(here, '../src/aerolab/aerolab.css'), 'utf8');
const out = path.join(here, '../public/labs/aerolab.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, fs.readFileSync(path.join(here, 'aerolab.template.html'), 'utf8').replace('__CSS__', () => css).replace('__APP__', () => app));
console.log('built', out, (app.length / 1e6).toFixed(2), 'MB');
