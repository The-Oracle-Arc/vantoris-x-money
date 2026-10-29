/**
 * Self-hosted private model client.
 * The browser only calls same-origin endpoints; provider credentials remain server-side.
 */
export async function askPrivateModel(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return { ok: false, error: 'prompt_required', text: 'Enter a question to continue.' };
  }
  if (prompt.trim().length > 4000) {
    return { ok: false, error: 'prompt_too_long', text: 'Please keep your question under 4,000 characters.' };
  }

  const endpoints = ['/api/ask', '/.netlify/functions/ask'];
  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
        credentials: 'same-origin',
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && typeof data.text === 'string' && data.text.trim()) {
        return { ok: true, text: data.text.trim(), source: data.source || 'private' };
      }
      if (response.status !== 404 && response.status !== 405) {
        const error = typeof data.error === 'string' ? data.error : 'model_unavailable';
        return {
          ok: false,
          error,
          text: error === 'not_configured'
            ? 'The private AI service is not configured on this host yet.'
            : 'The private AI service is temporarily unavailable. Please try again later.',
        };
      }
    } catch {
      // Local /api/ask may not exist on a static host; try the Netlify function next.
    }
  }
  return { ok: false, error: 'model_unavailable', text: 'The private AI service is unavailable on this host.' };
}

export function privateLlmConfigured() {
  // Client-side code cannot securely determine whether the server has its secret configured.
  // Treat this as feature availability only; the endpoint response is authoritative.
  return true;
}
