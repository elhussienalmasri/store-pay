import { listProducts } from '../../../lib/db';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const category = typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined;
  return res.status(200).json({ products: listProducts({ category }) });
}
