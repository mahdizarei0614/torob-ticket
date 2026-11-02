import { createServer, request as upstreamRequest } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8' };
const compressible = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt']);
function acceptsGzip(value = '') {
  return value.split(',').some(part => {
    const [encoding, ...parameters] = part.trim().split(';');
    const quality = parameters.find(parameter => parameter.trim().startsWith('q='));
    return encoding.toLowerCase() === 'gzip' && (!quality || Number(quality.trim().slice(2)) > 0);
  });
}

/** Isolated production artifacts; API data remains on the existing stack. */
export async function createAuditServer({ web = resolve(root, 'dist/t32/web'), admin = resolve(root, 'dist/t32/admin'), api = 'http://127.0.0.1:4300' } = {}) {
  const directories = { web: await realpath(web), admin: await realpath(admin) };
  const upstream = new URL(api);
  if (upstream.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(upstream.hostname) || upstream.username || upstream.password || upstream.pathname !== '/' || upstream.search || upstream.hash || !upstream.port) throw new Error('Audit API must be an explicit loopback HTTP origin');
  const cached = new Map(), sockets = new Set();
  async function asset(directory, pathname) {
    const requested = resolve(directory, '.' + pathname);
    if (requested !== directory && !requested.startsWith(directory + sep)) return null;
    let filename;
    try { filename = await realpath(requested); } catch { return null; }
    if (!filename.startsWith(directory + sep)) return null;
    const info = await stat(filename);
    if (!info.isFile()) return null;
    const previous = cached.get(filename);
    if (previous?.mtimeMs === info.mtimeMs && previous.size === info.size) return previous;
    const content = await readFile(filename), extension = extname(filename).toLowerCase();
    const entry = { content, zipped: compressible.has(extension) ? gzipSync(content, { level: 9 }) : null, extension, mtimeMs: info.mtimeMs, size: info.size, etag: '"' + createHash('sha256').update(content).digest('hex') + '"' };
    cached.set(filename, entry); return entry;
  }
  const server = createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url ?? '/', 'http://127.0.0.1');
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        // Preserve the browser Host/Origin pair for the API's same-origin guard.
        // Never log request headers/cookies or manufacture a reviewer identity.
        const proxy = upstreamRequest({ hostname: upstream.hostname.replace(/^\[|\]$/g, ''), port: upstream.port, path: incoming.url, method: incoming.method, headers: incoming.headers }, response => {
          outgoing.writeHead(response.statusCode ?? 502, response.headers); response.pipe(outgoing);
        });
        proxy.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
        incoming.on('aborted', () => proxy.destroy());
        outgoing.on('close', () => { if (!outgoing.writableEnded) proxy.destroy(); });
        incoming.pipe(proxy); return;
      }
      if (!['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405, { Allow: 'GET, HEAD' }); outgoing.end(); return; }
      if (url.pathname === '/__t32/health') { outgoing.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); outgoing.end(incoming.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ready', mode: 'isolated-production-artifacts', compression: 'gzip-level9-per-file', apiProxy: upstream.origin })); return; }
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { outgoing.writeHead(400); outgoing.end(); return; }
      if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(part => part.startsWith('.'))) { outgoing.writeHead(400); outgoing.end(); return; }
      if (pathname === '/admin') { outgoing.writeHead(308, { Location: '/admin/' + url.search }); outgoing.end(); return; }
      const isAdmin = pathname.startsWith('/admin/'), directory = isAdmin ? directories.admin : directories.web;
      const requested = isAdmin ? pathname.slice('/admin'.length) : pathname;
      let entry = await asset(directory, requested === '/' ? '/index.html' : requested);
      // App routes get their app shell; absent assets never receive HTML.
      if (!entry && !extname(requested) && incoming.headers.accept?.includes('text/html')) entry = await asset(directory, '/index.html');
      if (!entry) { outgoing.writeHead(404); outgoing.end(); return; }
      const zipped = entry.zipped && acceptsGzip(incoming.headers['accept-encoding']);
      const body = zipped ? entry.zipped : entry.content;
      const headers = { 'Content-Type': mime[entry.extension] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': /\/assets\/[^/]+-[\w-]{8,}\./.test(pathname) ? 'public,max-age=31536000,immutable' : 'no-cache', ETag: entry.etag, Vary: 'Accept-Encoding', 'Content-Length': body.length, ...(zipped ? { 'Content-Encoding': 'gzip' } : {}) };
      if (incoming.headers['if-none-match'] === entry.etag) { outgoing.writeHead(304, { ...headers, 'Content-Length': 0 }); outgoing.end(); return; }
      outgoing.writeHead(200, headers); outgoing.end(incoming.method === 'HEAD' ? undefined : body);
    } catch { if (!outgoing.headersSent) outgoing.writeHead(500); outgoing.end(); }
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.on('clientError', (_error, socket) => { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  return { server, close: async () => { for (const socket of sockets) socket.destroy(); await new Promise((done, reject) => server.close(error => error ? reject(error) : done())); } };
}

async function main() {
  const port = Number(process.env.T32_AUDIT_PORT ?? 4307);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || [4300, 4301, 4302].includes(port)) throw new Error('T32_AUDIT_PORT must be an isolated nonprivileged port');
  const audit = await createAuditServer();
  await new Promise((done, reject) => { audit.server.once('error', reject); audit.server.listen(port, '127.0.0.1', done); });
  console.log(JSON.stringify({ listening: `http://127.0.0.1:${port}`, mode: 'isolated-production-artifacts', compression: 'gzip-level9-per-file', apiProxy: 'http://127.0.0.1:4300' }));
  let closing = false;
  const stop = async () => { if (closing) return; closing = true; await audit.close(); process.exitCode = 0; };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
