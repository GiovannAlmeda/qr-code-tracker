/**
 * A tiny HTTP layer: static files, JSON routes, and server-sent events.
 *
 * Deliberately dependency-free. The only package this app installs is the
 * Anthropic SDK; everything else is Node's standard library, so `npm install`
 * can never be the reason the app won't start.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

export async function readJsonBody(req, limitBytes = 256 * 1024) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) {
      const err = new Error('Request body too large');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const err = new Error('Body was not valid JSON');
    err.statusCode = 400;
    throw err;
  }
}

/** Open a server-sent event stream and return a writer for it. */
export function openEventStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  // Flush headers immediately so the browser's onopen fires before the first
  // slow AI call rather than after it.
  res.write(': open\n\n');

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  // Proxies love to cut idle connections. A comment every 15s keeps them out.
  const heartbeat = setInterval(() => {
    if (!closed) res.write(': ping\n\n');
  }, 15_000);

  return {
    get closed() {
      return closed;
    },
    send(event, data) {
      if (closed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      clearInterval(heartbeat);
      if (!closed) res.end();
      closed = true;
    },
  };
}

function serveStatic(rootDir, urlPath, res) {
  const decoded = decodeURIComponent(urlPath);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');

  // Resolve, then confirm the result is still inside rootDir. Prefix-matching
  // the raw string isn't enough — `..` and symlinks both defeat it.
  const resolved = path.resolve(rootDir, relative);
  if (resolved !== rootDir && !resolved.startsWith(rootDir + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return true;
  }

  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return false;
  }
  if (stat.isDirectory()) return false;

  const ext = path.extname(resolved).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    // The app updates by editing files; never let a stale shell stick around.
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
  });
  fs.createReadStream(resolved).pipe(res);
  return true;
}

/**
 * Routes are declared as `'METHOD /path': handler`. Exact matches only —
 * this app has a dozen endpoints, not a hundred, and a regex router would be
 * more machinery than the problem deserves.
 */
export function createApp({ staticDir, routes, mounts = [] }) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const key = `${req.method} ${url.pathname}`;

    try {
      const handler = routes[key];
      if (handler) {
        await handler(req, res, url);
        return;
      }

      // Extra roots, so the browser can import the same `shared/` modules the
      // server does instead of a duplicated copy under public/.
      if (req.method === 'GET') {
        for (const mount of mounts) {
          if (!url.pathname.startsWith(mount.prefix)) continue;
          const rest = url.pathname.slice(mount.prefix.length);
          if (serveStatic(mount.dir, `/${rest}`, res)) return;
        }
      }

      if (req.method === 'GET' && serveStatic(staticDir, url.pathname, res)) return;

      // Unknown GET that isn't a file: hand back the app shell so deep links
      // and a refresh on /saved both work.
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
        if (serveStatic(staticDir, '/index.html', res)) return;
      }

      json(res, 404, { error: 'Not found', path: url.pathname });
    } catch (err) {
      console.error(`[${key}]`, err);
      if (res.headersSent) {
        res.end();
        return;
      }
      json(res, err.statusCode ?? 500, {
        error: err.message ?? 'Something went wrong',
      });
    }
  });
}
