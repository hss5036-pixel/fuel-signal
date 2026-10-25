import {build} from 'esbuild';
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {validateSnapshot} from '../lib/refresh.mjs';
validateSnapshot(JSON.parse(await readFile('data/market.json', 'utf8')));
await mkdir('dist/data', {recursive: true});
const result = await build({
  entryPoints: ['scripts/entry.tsx'], bundle: true, minify: true,
  outdir: 'dist/assets', entryNames: 'app-[hash]', format: 'esm',
  jsx: 'automatic', metafile: true, legalComments: 'eof',
  define: {'process.env.NODE_ENV': '"production"'}
});
const files = Object.keys(result.metafile.outputs);
const js = files.find(p => p.endsWith('.js')).replace(/^dist\//, './');
const css = files.find(p => p.endsWith('.css')).replace(/^dist\//, './');
await copyFile('data/market.json', 'dist/data/market.json');
await writeFile('dist/.nojekyll', '');
await writeFile('dist/index.html', `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="미국 전국 가솔린·경유 가격, WTI·브렌트, 제품 현물, 재고와 시장 뉴스를 매일 확인하는 대시보드">
<meta name="theme-color" content="#279d75"><title>Fuel Signal — 미국 연료시장</title>
<link rel="stylesheet" href="${css}"></head><body><div id="root"></div>
<noscript>이 대시보드는 JavaScript가 필요합니다. 브라우저에서 JavaScript를 켜 주세요.</noscript>
<script type="module" src="${js}"></script></body></html>`);
console.log('Built portable static site in dist/');
