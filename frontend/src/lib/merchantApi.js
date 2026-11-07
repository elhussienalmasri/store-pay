const SECRET_STORAGE = 'escrowpay_merchant_secret';

export function getStoredSecret() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SECRET_STORAGE);
}

export function storeSecret(secret) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SECRET_STORAGE, secret);
}

export function clearStoredSecret() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SECRET_STORAGE);
}

async function request(path, { secret, method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export function signupMerchant(payload) {
  return request('/api/v1/merchants', { method: 'POST', body: payload });
}

export function signupAccount(payload) {
  return request('/api/auth/signup', { method: 'POST', body: payload });
}

export function loginMerchant(credentials) {
  return request('/api/auth/login', { method: 'POST', body: credentials });
}

export function loginWithKey(secretKey) {
  return request('/api/auth/key', { method: 'POST', body: { secretKey } });
}

export function logoutMerchant() {
  return request('/api/auth/logout', { method: 'POST' });
}

export function getSession() {
  return request('/api/auth/session');
}

export function getMerchant(secret) {
  return request('/api/v1/merchants/me', { secret });
}

export function updateMerchant(secret, patch) {
  return request('/api/v1/merchants/me', { secret, method: 'PATCH', body: patch });
}

export function regenerateSecret(secret) {
  return request('/api/v1/merchants/me/secret', { secret, method: 'POST' });
}

export function createProduct(secret, product) {
  return request('/api/v1/products', { secret, method: 'POST', body: product });
}

export function updateProduct(secret, productId, patch) {
  return request(`/api/v1/products/${encodeURIComponent(productId)}`, {
    secret,
    method: 'PATCH',
    body: patch,
  });
}

export function deleteProduct(secret, productId) {
  return request(`/api/v1/products/${encodeURIComponent(productId)}`, {
    secret,
    method: 'DELETE',
  });
}

export function createPaymentSession(secret, payload) {
  return request('/api/v1/sessions', { secret, method: 'POST', body: payload });
}

export function listOrders(secret) {
  return request('/api/v1/orders', { secret });
}

export function sendTestWebhook(secret) {
  return request('/api/v1/webhooks/test', { secret, method: 'POST' });
}
