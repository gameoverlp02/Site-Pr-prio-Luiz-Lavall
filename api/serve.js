import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
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

async function handleAPI(req, res, urlPath) {
  const parts = urlPath.replace(/^\/api\//, '').split('/').filter(Boolean);
  const resource = parts[0];

  // GET /api/{resource} - retorna dados
  if (req.method === 'GET' && DATA_FILES[resource]) {
    const data = readJSON(resource);
    return sendJSON(res, data ? 200 : 404, data || { error: 'Não encontrado' });
  }

  sendJSON(res, 404, { error: 'Rota não encontrada' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API
  if (pathname.startsWith('/api/')) {
    return handleAPI(req, res, pathname);
  }

  // Arquivos estáticos
  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);

  // Security: evitar directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Se for diretório, tenta index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Se não existir, tenta como index.html (SPA fallback)
  if (!fs.existsSync(filePath)) {
    const ext = path.extname(pathname);
    if (!ext || ext === '.html') {
      filePath = path.join(ROOT, 'index.html');
    }
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);

  res.writeHead(200, { 'Content-Type': mime, 'Content-Length': content.length });
  res.end(content);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
