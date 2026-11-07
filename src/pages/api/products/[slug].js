import { findProduct } from '../../../lib/db';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const product = findProduct(req.query.slug);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  return res.status(200).json({ product });
}
