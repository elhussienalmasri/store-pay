const test = require('node:test');
const assert = require('node:assert');

// widgetCore is an ESM module shared by the browser, API routes, and tests.
const loadCore = () => import('../src/lib/widgetCore.mjs');

test('quoteSettlement prices USD carts in lamports', async () => {
  const { quoteSettlement } = await loadCore();

  const quote = quoteSettlement({
    priceMinor: 2400, // $24.00
    quantity: 2,
    currency: 'USD',
    solUsd: 100,
  });

  assert.strictEqual(quote.subtotalMinor, 4800);
  assert.strictEqual(quote.usdCents, 4800);
  // 48 USD / 100 USD per SOL = 0.48 SOL = 480,000,000 lamports
  assert.strictEqual(quote.settlementLamports, '480000000');
  assert.strictEqual(quote.quantity, 2);
});

test('quoteSettlement converts EUR prices through the EUR/USD rate', async () => {
  const { quoteSettlement } = await loadCore();

  const quote = quoteSettlement({
    priceMinor: 1000, // €10.00
    quantity: 1,
    currency: 'EUR',
    eurUsdRate: 1.1,
    solUsd: 110,
  });

  assert.strictEqual(quote.subtotalMinor, 1000);
  assert.strictEqual(quote.usdCents, 1100);
  assert.strictEqual(quote.settlementLamports, '100000000');
  assert.strictEqual(quote.eurUsdRate, 1.1);
});

test('quoteSettlement rejects invalid inputs and never quotes zero', async () => {
  const { quoteSettlement } = await loadCore();

  assert.throws(() => quoteSettlement({ priceMinor: 0 }), /greater than zero/);
  assert.throws(
    () => quoteSettlement({ priceMinor: 100, currency: 'GBP' }),
    /Unsupported pricing currency/
  );
  assert.throws(
    () => quoteSettlement({ priceMinor: 100, solUsd: 0 }),
    /Invalid SOL\/USD quote/
  );

  // A dust-priced item still gets a non-zero settlement amount.
  const dust = quoteSettlement({ priceMinor: 1, solUsd: 1_000_000_000 });
  assert.strictEqual(dust.settlementLamports, '1');
});

test('escrow deposit adds the one-lamport take offset', async () => {
  const { escrowDepositLamports, ESCROW_RECEIVE_BASE_UNITS } = await loadCore();

  assert.strictEqual(escrowDepositLamports('250000000'), 250000001n);
  assert.strictEqual(escrowDepositLamports(1n), 2n);
  assert.strictEqual(ESCROW_RECEIVE_BASE_UNITS, 1n);
});

test('formatSol renders lamports without trailing zeros', async () => {
  const { formatSol } = await loadCore();

  assert.strictEqual(formatSol(0), '0');
  assert.strictEqual(formatSol(1n), '0.000000001');
  assert.strictEqual(formatSol(500000000), '0.5');
  assert.strictEqual(formatSol(1_000_000_000n), '1');
  assert.strictEqual(formatSol(1_234_500_000), '1.2345');
});

test('fiat parsing and formatting use minor units', async () => {
  const { formatFiatMinor, parsePriceToMinor } = await loadCore();

  assert.strictEqual(parsePriceToMinor('24.5'), 2450);
  assert.strictEqual(parsePriceToMinor(0.01), 1);
  assert.strictEqual(parsePriceToMinor(''), null);
  assert.strictEqual(parsePriceToMinor('0'), null);
  assert.strictEqual(parsePriceToMinor('-5'), null);
  assert.strictEqual(parsePriceToMinor('not-a-number'), null);

  assert.strictEqual(formatFiatMinor(2450, 'EUR'), '24.50 EUR');
  assert.strictEqual(formatFiatMinor(1000, 'usd'), '10.00 USD');
});

test('domain normalization and origin allowlisting', async () => {
  const { normalizeDomain, isOriginAllowed } = await loadCore();

  assert.strictEqual(normalizeDomain('https://www.Shop.Acme.coffee/path'), 'shop.acme.coffee');
  assert.strictEqual(normalizeDomain('shop.acme.coffee:3000'), 'shop.acme.coffee');
  assert.strictEqual(normalizeDomain('  ACME.COFFEE  '), 'acme.coffee');

  assert.strictEqual(isOriginAllowed(null, []), true);
  assert.strictEqual(isOriginAllowed('http://localhost:3000', []), true);
  assert.strictEqual(isOriginAllowed('http://127.0.0.1:3000', []), true);
  assert.strictEqual(isOriginAllowed('https://shop.acme.coffee', ['shop.acme.coffee']), true);
  assert.strictEqual(
    isOriginAllowed('https://www.shop.acme.coffee', ['shop.acme.coffee']),
    false
  );
  assert.strictEqual(isOriginAllowed('https://evil.example', ['shop.acme.coffee']), false);
  assert.strictEqual(isOriginAllowed('not a url', ['shop.acme.coffee']), false);
});

test('session expiry helpers cover open and settled states', async () => {
  const {
    effectiveSessionStatus,
    isQuoteExpired,
    isSessionExpired,
    statusLabel,
  } = await loadCore();

  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();

  assert.strictEqual(isQuoteExpired(future), false);
  assert.strictEqual(isQuoteExpired(past), true);
  assert.strictEqual(isQuoteExpired(undefined), true);

  assert.strictEqual(isSessionExpired(future), false);
  assert.strictEqual(isSessionExpired(undefined), true);

  assert.strictEqual(effectiveSessionStatus({ status: 'open', expiresAt: past }), 'expired');
  assert.strictEqual(
    effectiveSessionStatus({ status: 'prepared', expiresAt: past }),
    'expired'
  );
  assert.strictEqual(
    effectiveSessionStatus({ status: 'funded', expiresAt: past }),
    'funded'
  );
  assert.strictEqual(
    effectiveSessionStatus({ status: 'open', expiresAt: future }),
    'open'
  );

  assert.strictEqual(statusLabel('funded'), 'Funds in escrow');
  assert.strictEqual(statusLabel('claimed'), 'Settled');
  assert.strictEqual(statusLabel('unknown'), 'unknown');
});

test('embed snippet includes keys and escapes merchant text', async () => {
  const { buildEmbedSnippet } = await loadCore();

  const snippet = buildEmbedSnippet({
    appOrigin: 'https://app.escrowpay.test',
    publishableKey: 'pk_live_abc123',
    productId: 'prod_1',
    buttonText: 'Buy <now> & save',
    quantity: 3,
    mode: 'direct',
  });

  assert.ok(snippet.includes('https://app.escrowpay.test/widget/v1.js'));
  assert.ok(snippet.includes('data-public-key="pk_live_abc123"'));
  assert.ok(snippet.includes('data-product="prod_1"'));
  assert.ok(snippet.includes('data-quantity="3"'));
  assert.ok(snippet.includes('data-mode="direct"'));
  assert.ok(snippet.includes('Buy &lt;now&gt; &amp; save'));
  assert.ok(!snippet.includes('<now>'));
});

test('key masking and uint64 validation', async () => {
  const { isUint64String, maskKey, isLikelyPublicKey } = await loadCore();

  assert.strictEqual(maskKey('short'), 'short');
  assert.strictEqual(maskKey('sk_live_1234567890abcdef'), 'sk_live_…cdef');

  assert.strictEqual(isUint64String('0'), true);
  assert.strictEqual(isUint64String('18446744073709551615'), true);
  assert.strictEqual(isUint64String('18446744073709551616'), false);
  assert.strictEqual(isUint64String('-1'), false);
  assert.strictEqual(isUint64String('abc'), false);
  assert.strictEqual(isUint64String(''), false);

  assert.strictEqual(
    isLikelyPublicKey('So11111111111111111111111111111111111111112'),
    true
  );
  assert.strictEqual(isLikelyPublicKey('not-a-wallet'), false);
});
