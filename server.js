const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/mp4',
  '.ogg': 'video/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const DATA_FILES = {
  portfolio: 'portfolio.json',
  projetos: 'projetos.json',
  sobre: 'sobre.json',
  autoral: 'autoral.json',
  pensamentos: 'pensamentos.json',
};

function readJSON(name) {
  const file = path.join(DATA_DIR, DATA_FILES[name]);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return null; }
}

function writeJSON(name, data) {
  const file = path.join(DATA_DIR, DATA_FILES[name]);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJSONBody(req) {
  const buf = await readBody(req);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf-8')); }
  catch { return null; }
}

function safeName(name) {
  return String(name || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

async function handleAPI(req, res, urlPath) {
  const parts = urlPath.replace(/^\/api\//, '').split('/').filter(Boolean);
  const resource = parts[0];

  if (resource === 'briefing') {
    const briefingHandler = require('./api/briefing.js');
    return briefingHandler(req, res);
  }

  if (resource === 'upload' && req.method === 'POST') {
    const body = await readJSONBody(req);
    if (!body || !body.dataBase64 || !body.filename) {
      return sendJSON(res, 400, { error: 'Faltam campos filename/dataBase64' });
    }
    let fname;
    if (body.posterFor) {
      const base = path.basename(String(body.posterFor));
      if (!/^[a-zA-Z0-9._-]+$/.test(base)) {
        return sendJSON(res, 400, { error: 'posterFor inválido' });
      }
      fname = `${base}.poster.jpg`;
    } else {
      const ext = path.extname(body.filename).toLowerCase() || '.jpg';
      const id = crypto.randomBytes(8).toString('hex');
      fname = `${Date.now()}_${id}${ext}`;
    }
    const fullPath = path.join(UPLOADS_DIR, fname);
    if (!fullPath.startsWith(UPLOADS_DIR)) return sendJSON(res, 400, { error: 'Caminho inválido' });
    const buf = Buffer.from(body.dataBase64, 'base64');
    fs.writeFileSync(fullPath, buf);
    return sendJSON(res, 200, { url: `uploads/${fname}` });
  }

  if (!DATA_FILES[resource]) return sendJSON(res, 404, { error: 'Recurso desconhecido' });

  if (req.method === 'GET') {
    const data = readJSON(resource) || { items: [] };
    return sendJSON(res, 200, data);
  }

  if (req.method === 'PUT') {
    const body = await readJSONBody(req);
    if (!body) return sendJSON(res, 400, { error: 'JSON inválido' });
    writeJSON(resource, body);
    return sendJSON(res, 200, { ok: true });
  }

  return sendJSON(res, 405, { error: 'Método não permitido' });
}

function serveStatic(req, res, urlPath) {
  let relPath = decodeURIComponent(urlPath);
  if (relPath === '' || relPath === '/') relPath = '/index.html';
  else if (relPath.endsWith('/')) relPath = relPath + 'index.html';

  let filePath = path.join(ROOT, relPath);
  if (!filePath.startsWith(ROOT)) return sendText(res, 403, 'Forbidden');

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    } else if (err) {
      return sendText(res, 404, 'Not found');
    }
    fs.stat(filePath, (err2, stat2) => {
      if (err2 || !stat2.isFile()) return sendText(res, 404, 'Not found');
      const ext = path.extname(filePath).toLowerCase();
      const longCacheExts = ['.woff', '.woff2', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.mp4', '.webm', '.mov', '.ogg', '.ico'];
      const mediumCacheExts = ['.css', '.js'];
      let cacheControl;
      if (longCacheExts.includes(ext)) {
        cacheControl = 'public, max-age=31536000, immutable';
      } else if (mediumCacheExts.includes(ext)) {
        cacheControl = 'public, max-age=86400, must-revalidate';
      } else {
        cacheControl = 'public, max-age=0, must-revalidate';
      }
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': cacheControl,
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  if (u.pathname.startsWith('/api/')) {
    try { await handleAPI(req, res, u.pathname); }
    catch (e) { sendJSON(res, 500, { error: String(e && e.message || e) }); }
    return;
  }
  // Rota limpa: /briefing  →  serve briefing.html
  if (/^\/briefing\/?$/.test(u.pathname)) {
    const filePath = path.join(ROOT, 'briefing.html');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  // Rota limpa: /projeto/<id>  →  serve projeto.html
  if (/^\/projeto\/[a-zA-Z0-9_-]+\/?$/.test(u.pathname)) {
    const filePath = path.join(ROOT, 'projeto.html');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  serveStatic(req, res, u.pathname);
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Admin em http://localhost:${PORT}/admin/`);
});
