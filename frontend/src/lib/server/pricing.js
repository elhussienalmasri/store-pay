import { DEFAULT_EUR_USD_RATE, DEFAULT_SOL_USD } from '../widgetCore.mjs';

let solCache = {
  value: Number(process.env.SOL_USD_FALLBACK) || DEFAULT_SOL_USD,
  fetchedAt: 0,
};

export async function getSolUsd() {
  if (Date.now() - solCache.fetchedAt < 60_000) {
    return solCache.value;
  }

  if (process.env.ESCROWPAY_SKIP_PRICE_FEED === '1') {
    return solCache.value;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { signal: controller.signal, cache: 'no-store' }
    );
    if (response.ok) {
      const data = await response.json();
      const price = Number(data?.solana?.usd);
      if (Number.isFinite(price) && price > 0) {
        solCache = { value: price, fetchedAt: Date.now() };
      }
    }
  } catch (err) {
    console.warn('[escrowpay] SOL price feed unavailable, using fallback:', err.message);
  } finally {
    clearTimeout(timeout);
  }

  return solCache.value;
}

export function getEurUsdRate() {
  const configured = Number(process.env.EUR_USD_RATE);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_EUR_USD_RATE;
}
