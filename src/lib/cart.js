const STORAGE_KEY = 'shop-app-cart';
export const CART_EVENT = 'shop-app:cart-changed';

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readCart() {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item?.slug === 'string')
      .map((item) => ({ slug: item.slug, quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)) }));
  } catch {
    return [];
  }
}

function writeCart(items) {
  if (!isBrowser()) return items;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: items }));
  return items;
}

export function addToCart(slug, quantity = 1) {
  const items = readCart();
  const existing = items.find((item) => item.slug === slug);
  if (existing) existing.quantity = Math.min(99, existing.quantity + quantity);
  else items.push({ slug, quantity: Math.min(99, quantity) });
  return writeCart(items);
}

export function setQuantity(slug, quantity) {
  const clamped = Math.max(1, Math.min(99, Number(quantity) || 1));
  return writeCart(readCart().map((item) => (item.slug === slug ? { ...item, quantity: clamped } : item)));
}

export function removeFromCart(slug) {
  return writeCart(readCart().filter((item) => item.slug !== slug));
}

export function clearCart() {
  return writeCart([]);
}

export function cartCount(items = readCart()) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
