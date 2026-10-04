// PackUp backend proxy: serves the app and forwards agent requests to a model provider.
// API keys and model choice stay here, never in the browser.
//
//   AI_PROVIDER=bedrock AWS_REGION=ap-southeast-1 MODEL_FAST=<id> MODEL_STRONG=<id> node server/index.mjs
//   AI_PROVIDER=mock node server/index.mjs        (no credentials; for checking the wiring)
//
// Then open http://localhost:8787/?ai=live
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT || 8787);
const PROVIDER = process.env.AI_PROVIDER || 'mock';
const MAX_BODY = 1_000_000;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

const provider = await import(`./providers/${PROVIDER}.mjs`);

function readJson(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new Error('Request too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

async function handleAgent(req, res) {
  try {
    const request = await readJson(req);
    if (!request.system || !Array.isArray(request.messages)) return send(res, 400, { error: 'system and messages are required' });
    const reply = await provider.complete(request); // { text, toolCalls, stopReason }
    return send(res, 200, reply);
  } catch (err) {
    console.error('[agent]', err.message);
    return send(res, 502, { error: 'Model request failed' });
  }
}

async function handleStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = normalize(join(ROOT, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
  const rel = relative(ROOT, path);
  const outside = rel.startsWith('..') || rel.split(sep)[0] === 'server'; // never serve the server's own files
  if (outside) return send(res, 404, 'Not found', 'text/plain');
  try {
    return send(res, 200, await readFile(path), TYPES[extname(path)] || 'application/octet-stream');
  } catch {
    return send(res, 404, 'Not found', 'text/plain');
  }
}

createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/agent') return handleAgent(req, res);
  if (req.method === 'GET') return handleStatic(req, res);
  return send(res, 405, { error: 'Method not allowed' });
}).listen(PORT, () => console.log(`PackUp on http://localhost:${PORT} (provider: ${PROVIDER}). Live agents: add ?ai=live`));
