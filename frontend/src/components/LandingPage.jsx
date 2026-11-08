import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Code2,
  Globe,
  LayoutDashboard,
  Lock,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Wallet,
  Zap,
} from 'lucide-react';
import { CopyButton } from './widget/WidgetUi';
import { PlatformNav } from './PlatformNav';
import { useSignedInMerchant } from '../lib/useSignedInMerchant';

const EMBED_SNIPPET = `<!-- EscrowPay merchant widget -->
<script src="https://your-escrowpay.app/widget/v1.js" async></script>
<button
  data-escrowpay
  data-public-key="pk_live_your_key"
  data-product="prd_your_product"
  data-quantity="1"
  data-mode="escrow"
>Buy with crypto</button>`;

const STEPS = [
  {
    icon: Store,
    title: 'Find it or list it',
    body: 'Browse the marketplace, or add a product or service to your merchant catalog with its own link.',
  },
  {
    icon: Wallet,
    title: 'Buyer funds the vault',
    body: 'At checkout the buyer signs one transaction into a program-derived vault. Funds stay non-custodial.',
  },
  {
    icon: Receipt,
    title: 'Deliver, then claim',
    body: 'Deliver the item or service. On marketplace listings the buyer confirms receipt first, then you claim from the dashboard.',
  },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Program-owned vaults',
    body: 'Every payment sits in an Anchor PDA on Solana. No custodian holds the keys to your revenue.',
  },
  {
    icon: ShoppingBag,
    title: 'Public marketplace',
    body: 'Sellers list products and services with links. Buyers search one catalog and pay with escrow.',
  },
  {
    icon: Code2,
    title: 'Drop-in widget',
    body: 'One script tag and a data attribute turns any product button into a crypto checkout.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Peer-to-peer exchange',
    body: 'Swap tokens directly with another wallet, with escrow and a P2P evidence desk on both sides.',
  },
  {
    icon: LayoutDashboard,
    title: 'Merchant dashboard',
    body: 'Listings, links, embed config, orders and settlement live in one place with a signed-in session.',
  },
  {
    icon: Lock,
    title: 'Server-side pricing',
    body: 'Quotes are computed on the server, so the browser can never set the amount a buyer pays.',
  },
];

const PLATFORMS = [
  {
    icon: ShoppingBag,
    label: 'Marketplace',
    title: 'Buy and sell with escrow',
    body: 'Every seller’s products and services in one catalog. Search, open the seller’s link, and pay into a vault the seller can only claim after you confirm delivery.',
    cta: 'Browse listings',
    href: '/marketplace',
    primary: true,
  },
  {
    icon: Code2,
    label: 'Widgets',
    title: 'Checkout on your own store',
    body: 'Add an escrow payment button with one script tag. Each product or service gets its own link, snippet and server-priced checkout.',
    cta: 'Set up the widget',
    href: '/signup',
  },
  {
    icon: ArrowLeftRight,
    label: 'Escrow',
    title: 'Peer-to-peer token swaps',
    body: 'Swap SOL or tokens directly with another wallet. Escrow holds both sides until each party confirms the deal in the P2P evidence desk.',
    cta: 'Open escrow desk',
    href: '/escrow',
  },
];

function BrandMark({ size = 'md' }) {
  const box = size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
  return (
    <div className={`${box} rounded-xl bg-gradient-to-tr from-[#9945FF] to-[#14F195] p-[1.5px]`}>
      <div className="w-full h-full bg-[#0d0e15] rounded-[9px] flex items-center justify-center">
        <Zap className="w-4 h-4 text-[#14F195] fill-current" />
      </div>
    </div>
  );
}

function CheckoutPreview() {
  return (
    <div className="relative">
      <div className="absolute inset-0 -m-4 rounded-[2rem] bg-gradient-to-tr from-[#9945FF]/20 to-[#14F195]/20 blur-2xl" />
      <div className="relative rounded-3xl border border-[#23273a] bg-[#0e1017]/90 backdrop-blur p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandMark />
            <div>
              <p className="text-xs font-bold text-white">Marketplace checkout</p>
              <p className="text-[10px] text-gray-500">Nova Design Studio</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300">
            <ShieldCheck className="w-3 h-3" />
            Buyer protected
          </span>
        </div>

        <div className="rounded-2xl border border-[#1e2233] bg-[#10121a] p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-block text-[9px] font-bold uppercase tracking-wide text-[#c4a3ff]">
              Service
            </span>
            <p className="text-xs font-semibold text-white">Logo design service</p>
            <p className="text-[10px] text-gray-500">2 revision rounds · Quantity 1</p>
          </div>
          <p className="text-sm font-black text-white shrink-0">$45.00</p>
        </div>

        <div className="rounded-2xl border border-[#1e2233] bg-[#0c0e15] p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-500">Item link</span>
            <span className="font-mono text-gray-300">nova.studio/logo</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-500">SOL quote</span>
            <span className="font-mono text-gray-200">0.485 SOL</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-500">Escrow vault</span>
            <span className="font-mono text-gray-400">7xk…3fq</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-500">Quote expires</span>
            <span className="text-amber-300">in 04:58</span>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-r from-[#9945FF] to-[#14F195] p-[1px]">
          <div className="rounded-[15px] bg-[#0e1017] px-3 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-white">Pay for this item</span>
            <span className="text-[10px] font-semibold text-[#14F195]">One signature</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {['Funded', 'Delivered', 'Claimed'].map((step, index) => (
            <div
              key={step}
              className={`rounded-xl border px-2 py-2 text-[10px] font-semibold ${
                index === 0
                  ? 'border-[#14F195]/40 bg-[#14F195]/10 text-[#14F195]'
                  : 'border-[#23273a] bg-[#10121a] text-gray-500'
              }`}
            >
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { signedIn } = useSignedInMerchant();
  return (
    <>
      <Head>
        <title>EscrowPay · Marketplace, crypto checkout and P2P exchange on Solana</title>
        <meta
          name="description"
          content="Buy and sell with escrow on the marketplace, embed a Solana checkout widget in your store, or swap tokens peer-to-peer — all settled in program-owned vaults."
        />
      </Head>

      <div className="min-h-screen bg-[#0b0c10] text-[#e0e2ec] overflow-x-hidden">
        <div className="pointer-events-none fixed -top-48 right-0 w-[36rem] h-[36rem] rounded-full bg-[#9945FF]/10 blur-3xl" />
        <div className="pointer-events-none fixed top-1/3 -left-40 w-[30rem] h-[30rem] rounded-full bg-[#14F195]/5 blur-3xl" />

        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-[#202436] bg-[#0b0c12]/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-20 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <BrandMark />
              <div>
                <span className="text-lg font-black tracking-tight text-white">
                  Escrow
                  <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">
                    Pay
                  </span>
                </span>
                <span className="hidden sm:inline-flex ml-2 items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 align-middle">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Devnet
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-gray-400">
              <a href="#how" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition">
                How it works
              </a>
              <a href="#platform" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition">
                Products
              </a>
              <a href="#developers" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition">
                Developers
              </a>
              <Link href="/merchant" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition">
                Widgets
              </Link>
              <Link href="/marketplace" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition">
                Marketplace
              </Link>
              <Link href="/escrow" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition">
                Escrow
              </Link>
            </nav>

            <div className="flex items-center gap-2">
              {signedIn ? (
                <Link
                  href="/merchant"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-xs font-bold hover:opacity-90 transition"
                >
                  Create widget
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-xs font-bold hover:opacity-90 transition"
                  >
                    Get started
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              )}
            </div>
            </div>

            <div className="md:hidden flex justify-center pb-2">
              <PlatformNav compact />
            </div>
          </div>
        </header>

        <main>
          {/* Hero */}
          <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20 pb-16">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
              <div className="space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[11px] font-semibold text-purple-300">
                  <Sparkles className="w-3.5 h-3.5 text-[#14F195]" />
                  Escrow for buying, selling and swapping
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.05]">
                  Buy, sell and swap crypto
                  <span className="block bg-gradient-to-r from-[#9945FF] via-[#b06bff] to-[#14F195] bg-clip-text text-transparent">
                    without the trust gap.
                  </span>
                </h1>

                <p className="text-sm sm:text-base text-gray-400 max-w-xl mx-auto lg:mx-0">
                  Browse the marketplace, embed an escrow-protected checkout on your
                  store, or trade tokens peer-to-peer. The money waits in a
                  program-owned vault until the item, service or swap is delivered.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                  <Link
                    href="/marketplace"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 h-12 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-sm font-bold hover:opacity-90 transition"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Browse the marketplace
                  </Link>
                  <Link
                    href="/escrow"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 h-12 rounded-xl bg-[#141624] border border-[#23273a] text-sm font-semibold text-gray-200 hover:bg-[#1a1e30] transition"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    Open escrow
                  </Link>
                </div>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 pt-2 text-[11px] text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#14F195]" />
                    No card required
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#14F195]" />
                    Server-side pricing
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#14F195]" />
                    Solana Devnet
                  </span>
                </div>
              </div>

              <div className="max-w-md w-full mx-auto lg:mx-0 lg:justify-self-end">
                <CheckoutPreview />
              </div>
            </div>
          </section>

          {/* Trust bar */}
          <section className="border-y border-[#1b1f30] bg-[#0d0e14]/60">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {[
                { icon: ShieldCheck, label: 'Program-owned vaults' },
                { icon: Wallet, label: 'Wallet Standard ready' },
                { icon: Lock, label: 'HttpOnly sessions' },
                { icon: Globe, label: 'Domain-locked widgets' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center justify-center gap-2 text-xs font-semibold text-gray-400">
                  <Icon className="w-4 h-4 text-[#14F195]" />
                  {label}
                </div>
              ))}
            </div>
          </section>

          {/* Three products */}
          <section id="platform" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-mt-24">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#14F195]">
                Products
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                One escrow layer, three ways in
              </h2>
              <p className="text-sm text-gray-400">
                Buy from the marketplace, sell from your own storefront, or swap
                tokens wallet-to-wallet — the vault works the same way.
              </p>
            </div>

            <div className="mt-12 grid md:grid-cols-3 gap-5">
              {PLATFORMS.map(({ icon: Icon, label, title, body, cta, href, primary }) => (
                <div
                  key={label}
                  className={`rounded-3xl p-[1px] ${
                    primary
                      ? 'bg-gradient-to-b from-[#9945FF]/70 to-[#14F195]/40'
                      : 'bg-[#23273a]'
                  }`}
                >
                  <div className="h-full rounded-[23px] bg-[#10121a] p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${
                          primary
                            ? 'bg-[#9945FF]/15 border-[#9945FF]/40'
                            : 'bg-[#14F195]/10 border-[#14F195]/25'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${primary ? 'text-[#c4a3ff]' : 'text-[#14F195]'}`} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        {label}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-bold text-white">{title}</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">{body}</p>
                    </div>
                    <Link
                      href={href}
                      className={`mt-auto inline-flex items-center gap-1.5 text-xs font-bold transition ${
                        primary ? 'text-[#c4a3ff] hover:text-white' : 'text-[#14F195] hover:text-white'
                      }`}
                    >
                      {cta}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section id="how" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-mt-24">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#14F195]">
                How it works
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                Protected payments in three steps
              </h2>
              <p className="text-sm text-gray-400">
                The same vault covers products, services and token swaps. The buyer
                keeps leverage until delivery; the seller keeps control of settlement.
              </p>
            </div>

            <div className="mt-12 grid md:grid-cols-3 gap-5">
              {STEPS.map(({ icon: Icon, title, body }, index) => (
                <div
                  key={title}
                  className="relative rounded-3xl border border-[#23273a] bg-[#10121a]/80 p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-[#9945FF]/10 border border-[#9945FF]/30 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#c4a3ff]" />
                    </div>
                    <span className="text-3xl font-black text-white/5">0{index + 1}</span>
                  </div>
                  <h3 className="text-base font-bold text-white">{title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Features */}
          <section id="features" className="border-t border-[#1b1f30] bg-[#0d0e14]/40 scroll-mt-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#14F195]">
                  Features
                </span>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                  Everything you need to buy, sell and swap
                </h2>
                <p className="text-sm text-gray-400">
                  Marketplace listings, embeddable checkout and peer-to-peer swaps all
                  settle through the same non-custodial vaults.
                </p>
              </div>

              <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {FEATURES.map(({ icon: Icon, title, body }) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-[#23273a] bg-[#10121a]/80 p-5 space-y-3 hover:border-[#3a405c] transition"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#14F195]/10 border border-[#14F195]/25 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#14F195]" />
                    </div>
                    <h3 className="text-sm font-bold text-white">{title}</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Developers */}
          <section id="developers" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-mt-24">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="space-y-5">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#14F195]">
                  Developers
                </span>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                  One snippet. Any storefront.
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Paste the embed snippet next to your product buttons. The widget
                  creates a server-priced payment session, locks the registered domain,
                  and opens checkout in an escrow flow your buyers already understand.
                </p>
                <ul className="space-y-2.5 text-xs text-gray-400">
                  {[
                    'Publishable key in the browser, secret key on your server.',
                    'Catalog API to render every marketplace listing with prices.',
                    'Rest API for headless checkouts and custom carts.',
                    'Signed webhooks for funding, claims and refunds.',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#14F195] shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 text-xs font-bold text-[#c4a3ff] hover:text-white transition"
                >
                  Get your keys
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="rounded-3xl border border-[#23273a] bg-[#0c0e15] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2233] bg-[#10121a]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                    <span className="ml-2 text-[11px] font-mono text-gray-500">checkout.html</span>
                  </div>
                  <CopyButton value={EMBED_SNIPPET} label="Copy" />
                </div>
                <pre className="p-4 text-[11px] leading-relaxed overflow-x-auto text-gray-300 font-mono">
                  <code>{EMBED_SNIPPET}</code>
                </pre>
              </div>
            </div>
          </section>

          {/* Final CTA */}
          <section className="border-t border-[#1b1f30] bg-[#0d0e14]/60">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-5">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Start selling — or start swapping — today
              </h2>
              <p className="text-sm text-gray-400 max-w-xl mx-auto">
                Create a merchant account to list products and services, embed the
                checkout on your own site, or open the exchange for a peer-to-peer swap.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 h-12 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-sm font-bold hover:opacity-90 transition"
                >
                  Create free account
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/marketplace"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 h-12 rounded-xl bg-[#141624] border border-[#23273a] text-sm font-semibold text-gray-200 hover:bg-[#1a1e30] transition"
                >
                  Browse marketplace
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-[#1b1f30] bg-[#0d0e14] py-10 text-xs text-gray-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <BrandMark />
                  <span className="text-sm font-black text-white">EscrowPay</span>
                </div>
                <p className="text-[11px] leading-relaxed max-w-xs">
                  Escrow-protected marketplace, embeddable checkout and peer-to-peer
                  token exchange on Solana.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-300">Product</p>
                <Link href="/escrow" className="block hover:text-white transition">Escrow</Link>
                <Link href="/marketplace" className="block hover:text-white transition">Marketplace</Link>
                <Link href="/merchant" className="block hover:text-white transition">Widgets</Link>
                <Link href="/signup" className="block hover:text-white transition">Create account</Link>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-300">Resources</p>
                <a href="#developers" className="block hover:text-white transition">Widget snippet</a>
                <a href="#features" className="block hover:text-white transition">Features</a>
                <Link href="/login" className="block hover:text-white transition">Sign in</Link>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-300">Network</p>
                <span className="block">Solana Devnet</span>
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Operational
                </span>
              </div>
            </div>

            <div className="mt-10 pt-5 border-t border-[#1b1f30] flex items-center justify-center gap-3">
              <span>© {new Date().getFullYear()} EscrowPay · Devnet only</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
