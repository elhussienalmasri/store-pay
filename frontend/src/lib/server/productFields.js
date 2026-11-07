import { ApiError } from './api';

export const PRODUCT_KINDS = ['product', 'service'];

export function readProductKind(value) {
  if (value === undefined) return undefined;
  const kind = String(value).toLowerCase();
  if (!PRODUCT_KINDS.includes(kind)) {
    throw new ApiError(400, 'Type must be product or service');
  }
  return kind;
}

export function readProductLink(value) {
  if (value === undefined) return undefined;
  const linkUrl = String(value || '').trim();
  if (!linkUrl) return '';
  if (linkUrl.length > 500) {
    throw new ApiError(400, 'Link must be 500 characters or fewer');
  }
  let parsed;
  try {
    parsed = new URL(linkUrl);
  } catch {
    throw new ApiError(400, 'Link must be a valid http(s) URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ApiError(400, 'Link must be a valid http(s) URL');
  }
  return linkUrl;
}

export function readListed(value) {
  if (value === undefined) return undefined;
  return Boolean(value);
}
