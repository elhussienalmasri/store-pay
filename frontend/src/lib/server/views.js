import {
  canSellerClaim,
  effectiveSessionStatus,
  formatFiatMinor,
  formatSol,
  isQuoteExpired,
  needsBuyerConfirmation,
} from '../widgetCore.mjs';

export function productView(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description || '',
    kind: product.kind === 'service' ? 'service' : 'product',
    linkUrl: product.linkUrl || '',
    priceMinor: product.priceMinor,
    currency: product.currency,
    priceDisplay: formatFiatMinor(product.priceMinor, product.currency),
    active: product.active !== false,
    listed: product.listed !== false,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function merchantOwnerView(merchant) {
  return {
    id: merchant.id,
    name: merchant.name,
    email: merchant.email,
    notificationEmail: merchant.notificationEmail || '',
    domains: merchant.domains || [],
    payoutWallet: merchant.payoutWallet,
    plan: merchant.plan,
    publishableKey: merchant.publishableKey,
    webhookUrl: merchant.webhookUrl || '',
    webhookSecret: merchant.webhookSecret,
    config: merchant.config,
    createdAt: merchant.createdAt,
  };
}

export function sessionPublicView(session, merchant) {
  const status = effectiveSessionStatus(session);
  const signatures = session.signatures || {};
  return {
    id: session.id,
    status,
    mode: session.mode,
    seed: session.seed,
    product: {
      id: session.productId,
      name: session.productName,
      description: session.productDescription || '',
      quantity: session.quantity,
    },
    pricing: {
      unitPriceMinor: session.unitPriceMinor,
      subtotalMinor: session.subtotalMinor,
      currency: session.currency,
      display: formatFiatMinor(session.subtotalMinor, session.currency),
    },
    settlement: {
      asset: 'SOL',
      lamports: session.settlementLamports,
      display: `${formatSol(session.settlementLamports)} SOL`,
      solUsd: session.solUsd,
      quoteExpiresAt: session.quoteExpiresAt,
      quoteExpired: isQuoteExpired(session.quoteExpiresAt),
    },
    merchant: {
      name: merchant.name,
      payoutWallet: merchant.payoutWallet,
      accentColor: merchant.config?.accentColor || '#9945FF',
      buttonText: merchant.config?.buttonText || 'Pay with crypto',
    },
    buyer: session.buyer || null,
    channel: session.channel || null,
    buyerConfirmedAt: session.buyerConfirmedAt || null,
    escrowAddress: session.escrowAddress || null,
    signatures,
    merchantOrderId: session.merchantOrderId || null,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function sessionMerchantView(session) {
  const status = effectiveSessionStatus(session);
  return {
    ...sessionPublicView(session, {
      name: '',
      payoutWallet: session.payoutWallet,
      config: {},
    }),
    merchantId: session.merchantId,
    productId: session.productId,
    productName: session.productName,
    quantity: session.quantity,
    unitPriceMinor: session.unitPriceMinor,
    subtotalMinor: session.subtotalMinor,
    currency: session.currency,
    settlementLamports: session.settlementLamports,
    solUsd: session.solUsd,
    status,
    canClaim: canSellerClaim(session),
    awaitingBuyerConfirmation: needsBuyerConfirmation(session),
    payoutWallet: session.payoutWallet,
    updatedAt: session.updatedAt,
  };
}

export function merchantStats(sessions) {
  const counts = {
    total: sessions.length,
    open: 0,
    funded: 0,
    claimed: 0,
    refunded: 0,
    paid: 0,
    expired: 0,
  };
  let settledLamports = 0n;

  for (const session of sessions) {
    const status = effectiveSessionStatus(session);
    if (counts[status] === undefined) counts[status] = 0;
    counts[status] += 1;
    if (status === 'claimed') {
      settledLamports += BigInt(session.settlementLamports || 0);
    }
  }

  return {
    counts,
    settledLamports: String(settledLamports),
    settledDisplay: `${formatSol(settledLamports)} SOL`,
  };
}
