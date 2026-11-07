export const SESSION_EVENT = 'shop-app:session-changed';

export function emitSessionChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESSION_EVENT));
}

export async function fetchUser() {
  const response = await fetch('/api/auth/session');
  if (!response.ok) return null;
  const data = await response.json();
  return data.user || null;
}

export async function submitAuth(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, errors: data.errors || {}, error: data.error || '', user: data.user || null };
}
