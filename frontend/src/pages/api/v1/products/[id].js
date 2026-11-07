import { ApiError, sendError } from '../../../../lib/server/api';
import { requireMerchant } from '../../../../lib/server/auth';
import { patchProduct, removeProduct } from '../../../../lib/server/store';
import { productView } from '../../../../lib/server/views';
import {
  parsePriceToMinor,
  SUPPORTED_PRICING_CURRENCIES,
} from '../../../../lib/widgetCore.mjs';

export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'PATCH, DELETE');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const merchant = await requireMerchant(req);
    const { id } = req.query;

    if (req.method === 'DELETE') {
      const removed = await removeProduct(merchant.id, id);
      if (!removed) throw new ApiError(404, 'Product not found');
      return res.status(200).json({ ok: true });
    }

    const patch = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 1 || name.length > 80) {
        throw new ApiError(400, 'Product name must be between 1 and 80 characters');
      }
      patch.name = name;
    }
    if (req.body?.description !== undefined) {
      const description = String(req.body.description).trim();
      if (description.length > 500) {
        throw new ApiError(400, 'Description must be 500 characters or fewer');
      }
      patch.description = description;
    }
    if (req.body?.currency !== undefined) {
      const currency = String(req.body.currency).toUpperCase();
      if (!SUPPORTED_PRICING_CURRENCIES.includes(currency)) {
        throw new ApiError(400, `Currency must be one of: ${SUPPORTED_PRICING_CURRENCIES.join(', ')}`);
      }
      patch.currency = currency;
    }
    if (req.body?.priceMinor !== undefined || req.body?.price !== undefined) {
      const minor =
        req.body.priceMinor !== undefined
          ? Number(req.body.priceMinor)
          : parsePriceToMinor(req.body.price);
      if (!Number.isInteger(minor) || minor <= 0) {
        throw new ApiError(400, 'Price must be greater than zero');
      }
      patch.priceMinor = minor;
    }
    if (req.body?.active !== undefined) {
      patch.active = Boolean(req.body.active);
    }

    if (Object.keys(patch).length === 0) {
      throw new ApiError(400, 'No supported fields to update');
    }

    const product = await patchProduct(merchant.id, id, patch);
    if (!product) throw new ApiError(404, 'Product not found');

    return res.status(200).json({ product: productView(product) });
  } catch (err) {
    sendError(res, err);
  }
}
