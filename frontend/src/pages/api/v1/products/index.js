import { ApiError, sendError } from '../../../../lib/server/api';
import { requireMerchant } from '../../../../lib/server/auth';
import { insertProduct, listProducts } from '../../../../lib/server/store';
import { productView } from '../../../../lib/server/views';
import {
  parsePriceToMinor,
  SUPPORTED_PRICING_CURRENCIES,
} from '../../../../lib/widgetCore.mjs';

function readPriceMinor(body) {
  const minor =
    body?.priceMinor !== undefined ? Number(body.priceMinor) : parsePriceToMinor(body?.price);
  if (!Number.isInteger(minor) || minor <= 0 || minor > 1_000_000_000_000) {
    throw new ApiError(400, 'Price must be greater than zero');
  }
  return minor;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const merchant = await requireMerchant(req);

    if (req.method === 'GET') {
      const products = await listProducts(merchant.id);
      return res.status(200).json({ products: products.map(productView) });
    }

    const name = String(req.body?.name || '').trim();
    if (name.length < 1 || name.length > 80) {
      throw new ApiError(400, 'Product name must be between 1 and 80 characters');
    }
    const currency = String(req.body?.currency || 'USD').toUpperCase();
    if (!SUPPORTED_PRICING_CURRENCIES.includes(currency)) {
      throw new ApiError(400, `Currency must be one of: ${SUPPORTED_PRICING_CURRENCIES.join(', ')}`);
    }
    const description = String(req.body?.description || '').trim();
    if (description.length > 500) {
      throw new ApiError(400, 'Description must be 500 characters or fewer');
    }

    const product = await insertProduct({
      merchantId: merchant.id,
      name,
      description,
      priceMinor: readPriceMinor(req.body),
      currency,
      active: req.body?.active !== false,
    });

    return res.status(201).json({ product: productView(product) });
  } catch (err) {
    sendError(res, err);
  }
}
