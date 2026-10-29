/**
 * Fail-closed privileged command boundary.
 * No hard-coded override token or client-side privileged mutation is permitted.
 * Replace this adapter only with a server endpoint that validates role, MFA,
 * action scope, and audit logging on every request.
 */
import { isSuperAdmin, SUPER_ADMIN_EMAIL } from '@/lib/operationsAccess';

export function inspectCommandInput(raw) {
  return { elevated: false, cleanContent: String(raw || '').trim(), hadToken: false };
}

export function redactCommandSecrets(value) {
  return String(value || '').replace(/\b(password|passcode|pin|token)\s*[:=]\s*\S+/gi, '$1: [redacted]');
}

export async function clearConversationCompletely(conversation) {
  if (!conversation?.id || typeof window === 'undefined') return;
  try {
    const key = 'vantoris_deleted_conversations';
    const ids = JSON.parse(window.localStorage.getItem(key) || '[]');
    if (!ids.includes(conversation.id)) ids.push(conversation.id);
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch { /* Local history cleanup is best effort if storage is unavailable. */ }
}

export async function executeElevatedCommand(_content, user) {
  if (!user || !isSuperAdmin(user)) return { ok: false, elevateAgent: false, message: 'Privileged action denied.' };
  return {
    ok: false,
    elevateAgent: false,
    message: 'Privileged commands are disabled until server-side authorization, scoped grants, and audit logging are configured. No action was executed.',
  };
}

export { SUPER_ADMIN_EMAIL };
