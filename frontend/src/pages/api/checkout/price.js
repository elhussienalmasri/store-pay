let cachedPrice = 95.5;
let lastFetch = 0;

export default async function handler(req, res) {
  const now = Date.now();
  // Cache for 60 seconds
  if (now - lastFetch < 60000 && cachedPrice) {
    return res.status(200).json({ solPriceUsd: cachedPrice, cached: true });
  }

  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    if (response.ok) {
      const data = await response.json();
      if (data?.solana?.usd) {
        cachedPrice = data.solana.usd;
        lastFetch = now;
      }
    }
  } catch (err) {
    console.warn('Price fetch fallback:', err.message);
  }

  return res.status(200).json({ solPriceUsd: cachedPrice, cached: false });
}
