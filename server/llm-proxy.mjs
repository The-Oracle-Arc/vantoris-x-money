/**
 * Local private proxy. Run on your server:
 *   PRIVATE_LLM_URL=http://127.0.0.1:11434/v1/chat/completions node server/llm-proxy.mjs
 */
import http from 'node:http';

const port = Number(process.env.PORT || 8787);
const upstream = process.env.PRIVATE_LLM_URL || 'http://127.0.0.1:11434/v1/chat/completions';
const model = process.env.PRIVATE_LLM_MODEL || 'qwen2.5:7b';
const key = process.env.PRIVATE_LLM_KEY || '';

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, upstream }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/ask') {
    res.writeHead(404);
    res.end();
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  const prompt = String(body.prompt || '').slice(0, 4000);
  const r = await fetch(upstream, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false }),
  });
  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content || data?.response || '';
  res.writeHead(r.ok ? 200 : 502, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ text }));
});

server.listen(port, () => {
  console.log(`private llm proxy on :${port} -> ${upstream}`);
});
