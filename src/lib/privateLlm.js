/**
 * Member-authenticated private model client.
 * Provider credentials never enter browser code.
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
        return { ok: true, text: data.text.trim(), source: data.source || 'private' };
      }
      if (response.status !== 404 && response.status !== 405) {
        const error = typeof data.error === 'string' ? data.error : 'model_unavailable';
        const message = error === 'not_configured'
          ? 'The private AI service is not configured on this host yet.'
          : error === 'authentication_required'
            ? (data.message || 'Your session could not be verified. Sign in again and retry.')
            : 'The private AI service is temporarily unavailable. Please try again later.';
        return { ok: false, error, text: message };
      }
    } catch {
      // Try the alternate local/dev route when the first route is not available.
    }
  }
  return { ok: false, error: 'model_unavailable', text: 'The private AI service is unavailable on this host.' };
}

export function privateLlmConfigured() {
  // Server configuration is only authoritative after an actual request.
  return true;
}
