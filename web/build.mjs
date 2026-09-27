import { build } from 'esbuild'; import fs from 'fs'; import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname);
const r = await build({ entryPoints: [path.join(here, 'src/main.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' });
const app = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
fs.copyFileSync(path.join(here, '../data/raceweek.json'), path.join(here, 'public/assets/raceweek.json'));
fs.writeFileSync(path.join(here, 'public/index.html'), fs.readFileSync(path.join(here, 'index.template.html'), 'utf8').replace('__APP__', () => app));
console.log('built', (app.length / 1e3).toFixed(0), 'kB');
