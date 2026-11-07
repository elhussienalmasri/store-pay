export function formatPrice(cents) {
  const safeCents = Number.isFinite(cents) ? cents : 0;
  return `$${(safeCents / 100).toFixed(2)}`;
}
