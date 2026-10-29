/**
 * Self-hosted operating model. Never calls Base44 InvokeLLM.
 * Local launch talks to /api/ask (Vite proxy -> server/llm-proxy.mjs).
 * Netlify talks to /.netlify/functions/ask.
 * Default model is Qwen 2.5 7B on your own Ollama server.
 */
export async function askPrivateModel(prompt) {
  const endpoints = ['/api/ask', '/.netlify/functions/ask'];
  let last = 'Private model unavailable.';
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.text && data.error !== 'not_configured') return { ok: true, text: data.text };
      last = data.text || data.error || last;
    } catch (e) {
      last = e.message || last;
    }
  }
  return { ok: false, text: last };
}

export function privateLlmConfigured() {
  return true;
}
