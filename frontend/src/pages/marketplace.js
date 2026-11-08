import React, { useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  ExternalLink,
  Loader2,
  LogOut,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Wrench,
  Zap,
} from 'lucide-react';
import { listMarketplaceProducts } from '../lib/server/store';
import { formatFiatMinor } from '../lib/widgetCore.mjs';
import { useSignedInMerchant } from '../lib/useSignedInMerchant';
import { PlatformNav } from '../components/PlatformNav';
import { NotificationBell } from '../components/NotificationBell';
import { SiteFooter } from '../components/SiteFooter';

const KIND_FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'product', label: 'Products' },
  { id: 'service', label: 'Services' },
];

function truncate(value, max = 150) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default function MarketplacePage({ items, merchantName }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [buyingId, setBuyingId] = useState('');
  const [error, setError] = useState('');
  const { signedIn, signOut } = useSignedInMerchant(Boolean(merchantName));

  const sellers = useMemo(
    () => new Set(items.map((item) => item.merchantName)).size,
    [items]
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (kind !== 'all' && item.kind !== kind) return false;
      if (!needle) return true;
      return (
        item.name.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle) ||
        item.merchantName.toLowerCase().includes(needle)
      );
    });
  }, [items, query, kind]);

  async function handleBuy(item) {
    setBuyingId(item.id);
    setError('');
    try {
      const response = await fetch('/api/v1/marketplace/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: item.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Could not start checkout (${response.status})`);
      }
      window.location.href = data.session.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setBuyingId('');
    }
  }

  return (
    <>
      <Head>
        <title>Marketplace · StorePay</title>
        <meta
          name="description"
          content="Browse products and services from EscrowPay sellers and pay with escrow-protected Solana checkout."
        />
      </Head>

      <div className="min-h-screen flex flex-col bg-[#0b0c10] text-[#e0e2ec] overflow-x-hidden">
        <div className="pointer-events-none fixed -top-48 right-0 w-[36rem] h-[36rem] rounded-full bg-[#9945FF]/10 blur-3xl" />
        <div className="pointer-events-none fixed top-1/3 -left-40 w-[30rem] h-[30rem] rounded-full bg-[#14F195]/5 blur-3xl" />

        <header className="sticky top-0 z-40 border-b border-[#202436] bg-[#0b0c12]/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-20 flex items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9945FF] to-[#14F195] p-[1.5px]">
                  <div className="w-full h-full bg-[#0d0e15] rounded-[10px] flex items-center justify-center">
                    <Zap className="w-4 h-4 text-[#14F195] fill-current" />
                  </div>
                </div>
                <span className="text-lg font-black tracking-tight text-white">
                  Escrow
                  <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">
                    Pay
                  </span>
                </span>
              </Link>

              <PlatformNav
                active="marketplace"
                compact
                hideLabelsOnMobile
                className="hidden md:flex"
              />

              <div className="flex items-center gap-2">
                <NotificationBell />
                {signedIn ? (
                  <>
                    <Link
                      href="/merchant"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-xs font-bold hover:opacity-90 transition"
                    >
                      <Store className="w-3.5 h-3.5" />
                      Dashboard
                    </Link>
                    <button
                      onClick={signOut}
                      className="inline-flex p-2.5 rounded-xl bg-[#141624] border border-[#23273a] text-gray-400 hover:text-red-300 transition"
                      title="Sign out"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="hidden sm:inline-flex px-3 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-xs font-bold hover:opacity-90 transition"
                    >
                      Sell your work
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="md:hidden flex justify-center pb-2">
              <PlatformNav active="marketplace" compact />
            </div>
          </div>
        </header>

        <main className="relative flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[11px] font-semibold text-purple-300">
              <Sparkles className="w-3.5 h-3.5 text-[#14F195]" />
              {items.length} listing(s) from {sellers} seller(s)
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Marketplace
            </h1>
            <p className="text-sm text-gray-400 max-w-2xl">
              Products and services from EscrowPay sellers. Pay on Solana with
              escrow protection — funds settle only when the seller delivers.
            </p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products, services, or sellers"
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-[#0e1017] border border-[#23273a] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#9945FF]/60"
              />
            </div>
            <div className="flex items-center gap-1 p-1 bg-[#12141f] border border-[#212538] rounded-xl">
              {KIND_FILTERS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setKind(option.id)}
                  className={`px-3.5 py-2 rounded-lg text-[11px] font-semibold transition ${
                    kind === option.id
                      ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              {error}
            </div>
          )}

          {visible.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-dashed border-[#2a2f45] p-12 text-center">
              <ShoppingBag className="w-8 h-8 text-gray-600 mx-auto" />
              <p className="mt-3 text-sm font-semibold text-gray-300">No listings found</p>
              <p className="mt-1 text-xs text-gray-500">
                {items.length === 0
                  ? 'Sellers can list products and services from their merchant dashboard.'
                  : 'Try a different search or filter.'}
              </p>
              {items.length === 0 && (
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-xs font-bold"
                >
                  Start selling
                </Link>
              )}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {visible.map((item) => {
                const isService = item.kind === 'service';
                const Icon = isService ? Wrench : Package;
                return (
                  <article
                    key={item.id}
                    className="rounded-2xl bg-[#0e1017] border border-[#1e2233] p-5 flex flex-col gap-3 hover:border-[#3a405c] transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#c4a3ff]">
                        <Icon className="w-3.5 h-3.5" />
                        {isService ? 'Service' : 'Product'}
                      </span>
                      <span className="text-sm font-bold font-mono text-[#14F195]">
                        {item.priceDisplay}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-white">{item.name}</h2>
                      {item.description && (
                        <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                          {truncate(item.description)}
                        </p>
                      )}
                    </div>

                    <div className="mt-auto space-y-3">
                      <p className="text-[11px] text-gray-400">
                        Sold by <span className="text-gray-200 font-semibold">{item.merchantName}</span>
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleBuy(item)}
                          disabled={buyingId === item.id}
                          className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-xs font-bold disabled:opacity-60 flex items-center justify-center gap-1.5"
                        >
                          {buyingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="w-3.5 h-3.5" />
                          )}
                          {buyingId === item.id ? 'Starting…' : 'Buy with escrow'}
                        </button>
                        {item.linkUrl && (
                          <a
                            href={item.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#181b28] border border-[#2a2f45] text-gray-300 hover:text-white"
                            title="Open seller link"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-gray-600">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Escrow-protected checkout on Solana Devnet
            </span>
            <span>•</span>
            <span>Prices are set by each seller server-side</span>
          </div>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}

export async function getServerSideProps({ req }) {
  const items = (await listMarketplaceProducts()).map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description || '',
    kind: product.kind === 'service' ? 'service' : 'product',
    priceDisplay: formatFiatMinor(product.priceMinor, product.currency),
    linkUrl: product.linkUrl || '',
    merchantName: product.merchantName,
    createdAt: product.createdAt,
  }));

  let merchantName = '';
  try {
    const { merchantFromSession } = await import('../lib/server/auth');
    const merchant = await merchantFromSession(req);
    merchantName = merchant?.name || '';
  } catch (err) {
    console.warn('[escrowpay] could not read marketplace session:', err.message);
  }

  return { props: { items, merchantName } };
}
