import { createOrder, getOrder, listProducts } from '../../../lib/db';
import { buildReference, priceOrder, validateCustomer, validateItems } from '../../../lib/orders';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { merged, errors: quantityErrors } = validateItems(req.body?.items);
  const { errors: customerErrors, value: customer } = validateCustomer(req.body?.customer);

  if (quantityErrors.length > 0) {
    return res.status(400).json({ error: quantityErrors.join(' ') });
  }

  const { lines, totalCents, problems } = priceOrder(listProducts(), merged);

  if (problems.length > 0 || lines.length === 0) {
    return res.status(400).json({ error: problems.join(' ') || 'The order has nothing to buy.' });
  }

  if (Object.keys(customerErrors).length > 0) {
    return res.status(400).json({ errors: customerErrors, error: 'Check the highlighted fields.' });
  }

  let reference = buildReference();
  while (getOrder(reference)) reference = buildReference();

  const order = createOrder({ reference, customer, totalCents, items: lines });
  return res.status(201).json({ order });
}
