/**
 * Authenticated client for the server-side, provider-independent AI gateway.
 * Provider credentials and usage entitlements never enter browser code.
 */
function getSessionToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('base44_access_token')
    || window.localStorage.getItem('token')
    || window.localStorage.getItem('base44_token')
    || '';
}

export async function askPrivateModel(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return { ok: false, error: 'prompt_required', text: 'Enter a question to continue.' };
  }
  if (prompt.trim().length > 4000) {
    return { ok: false, error: 'prompt_too_long', text: 'Please keep your question under 4,000 characters.' };
  }

  const token = getSessionToken();
  if (!token) {
    return { ok: false, error: 'authentication_required', text: 'Sign in to use Vantoris Intelligence.' };
  }

  const endpoints = import.meta.env.DEV ? ['/api/ask'] : ['/.netlify/functions/ask'];
  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
        credentials: 'same-origin',
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && typeof data.text === 'string' && data.text.trim()) {
        return {
          ok: true,
          text: data.text.trim(),
          provider: data.provider || 'unknown',
          plan: data.plan || 'free',
          remaining: Number.isFinite(data.remaining) ? data.remaining : null,
          usage: data.usage || null,
        };
      }
      if (response.status !== 404 && response.status !== 405) {
        const error = typeof data.error === 'string' ? data.error : 'model_unavailable';
        const message = typeof data.message === 'string'
          ? data.message
          : 'The AI service is temporarily unavailable. Please try again later.';
        return { ok: false, error, text: message, remaining: Number.isFinite(data.remaining) ? data.remaining : null };
      }
    } catch {
      // Try the alternate local/dev route when the first route is not available.
    }
  }
  return { ok: false, error: 'model_unavailable', text: 'The AI service is unavailable on this host.' };
}

export function privateLlmConfigured() {
  // Browser code cannot inspect server-only provider environment variables.
  return null;
}
