const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function lineTotal(unitPriceCents, quantity) {
  return Math.round(unitPriceCents * quantity);
}

function mergeItems(items) {
  const merged = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const slug = typeof item?.slug === 'string' ? item.slug.trim() : '';
    if (!slug) return;
    const quantity = Number(item?.quantity);
    const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
    if (merged.has(slug)) merged.get(slug).quantity += safeQuantity;
    else merged.set(slug, { slug, quantity: safeQuantity });
  });
  return [...merged.values()];
}

function validateCustomer(customer) {
  const value = customer || {};
  const errors = {};
  const name = String(value.name || '').trim();
  const email = String(value.email || '').trim();
  const phone = String(value.phone || '').replace(/[\s()-]/g, '');
  const address = String(value.address || '').trim();

  if (name.length < 2) errors.name = 'Enter the name for this order.';
  if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter an email address we can send the receipt to.';
  if (!/^[+\d]{7,20}$/.test(phone)) errors.phone = 'Enter a phone number with at least 7 digits.';
  if (address.length < 10) errors.address = 'Enter the full delivery address, including city.';

  return { errors, value: { name, email, phone, address } };
}

function validateItems(items) {
  const merged = mergeItems(items);
  const errors = [];
  if (merged.length === 0) errors.push('Pick at least one product.');
  merged.forEach((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      errors.push(`Quantity for ${item.slug} must be between 1 and 99.`);
    }
  });
  return { merged, errors };
}

function buildReference(now = new Date()) {
  const stamp = now.toISOString().replace(/\D/g, '').slice(2, 10);
  const random = Math.floor(Math.random() * 46656)
    .toString(36)
    .toUpperCase()
    .padStart(3, '0');
  return `SH-${stamp}-${random}`;
}

function priceOrder(catalog, items) {
  const lines = [];
  const problems = [];

  mergeItems(items).forEach(({ slug, quantity }) => {
    const product = catalog.find((entry) => entry.slug === slug);
    if (!product) {
      problems.push(`${slug} is no longer sold here.`);
      return;
    }
    if (!product.inStock) {
      problems.push(`${product.title} is out of stock.`);
      return;
    }
    lines.push({
      slug: product.slug,
      title: product.title,
      unitPriceCents: product.priceCents,
      quantity,
      lineTotalCents: lineTotal(product.priceCents, quantity),
    });
  });

  const totalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  return { lines, totalCents, problems };
}

module.exports = { lineTotal, mergeItems, validateCustomer, validateItems, buildReference, priceOrder };
