import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
const root = resolve('dist');
const port = Number(process.env.PORT ?? 4173);
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  // The nested route verifies compatibility with GitHub project Pages.
  const path = decodeURIComponent(url.pathname).replace(/^\/fuel-signal\//, '/');
  const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
  if (!file.startsWith(root + sep)) {response.writeHead(403).end(); return;}
  try {
    const content = await readFile(file);
    const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json'};
    response.writeHead(200, {'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store'}).end(content);
  } catch {response.writeHead(404).end('Not found');}
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/fuel-signal/`));
