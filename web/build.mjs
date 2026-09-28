import { build } from 'esbuild'; import fs from 'fs'; import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname);
const r = await build({ entryPoints: [path.join(here, 'src/main.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' });
const app = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
fs.copyFileSync(path.join(here, '../data/raceweek.json'), path.join(here, 'public/assets/raceweek.json'));
fs.writeFileSync(path.join(here, 'public/index.html'), fs.readFileSync(path.join(here, 'index.template.html'), 'utf8').replace('__APP__', () => app));
// Split build for CDN hosting: the game code as app.js next to assets/, and a shell page that loads it.
// A host (tools/cdn_shell.py) adds <base href> pointing at a pinned commit of web/public on a CDN.
fs.writeFileSync(path.join(here, 'public/app.js'), r.outputFiles[0].text);
fs.writeFileSync(path.join(here, 'public/shell.html'), fs.readFileSync(path.join(here, 'index.template.html'), 'utf8')
  .replace('<script>__APP__</script>', '<script src="app.js"></script>'));
console.log('built', (app.length / 1e3).toFixed(0), 'kB');
