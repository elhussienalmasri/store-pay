import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Code2,
  ExternalLink,
  Link2,
  Palette,
  Save,
  Sparkles,
  Zap,
} from 'lucide-react';
import { createPaymentSession, updateMerchant } from '../../lib/merchantApi';
import {
  buildApiExample,
  buildEmbedSnippet,
  buildInPayConfig,
  formatFiatMinor,
} from '../../lib/widgetCore.mjs';
import { CopyButton, Field, inputClass, Panel } from './WidgetUi';
import { buildInPayWidgetExample } from '../../lib/inpayWidgetExample';

const MODE_OPTIONS = [
  { id: 'escrow', label: 'Escrow only' },
  { id: 'direct', label: 'Instant only' },
  { id: 'both', label: 'Buyer chooses' },
];

export function WidgetConfigPanel({ secret, merchant, products, onChanged }) {
  const [appOrigin, setAppOrigin] = useState('');
  const [buttonText, setButtonText] = useState(
    merchant.config?.buttonText || 'Pay with crypto'
  );
  const [accentColor, setAccentColor] = useState(
    merchant.config?.accentColor || '#9945FF'
  );
  const [mode, setMode] = useState(merchant.config?.mode || 'escrow');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [paymentLink, setPaymentLink] = useState('');

  useEffect(() => {
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    setAppOrigin(origin.replace(/\/$/, ''));
  }, []);

  useEffect(() => {
    if (!productId && products.length > 0) {
      setProductId(products.find((product) => product.active)?.id || products[0].id);
    }
  }, [products, productId]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) || products[0] || null,
    [products, productId]
  );

  const snippet = useMemo(() => {
    if (!appOrigin || !selectedProduct) return '';
    return buildEmbedSnippet({
      appOrigin,
      publishableKey: merchant.publishableKey,
      productId: selectedProduct.id,
      buttonText,
      quantity,
      mode: mode === 'both' ? 'escrow' : mode,
    });
  }, [appOrigin, merchant.publishableKey, selectedProduct, buttonText, quantity, mode]);

  const apiExample = useMemo(() => {
    if (!appOrigin || !selectedProduct) return '';
    return buildApiExample({ appOrigin, productId: selectedProduct.id });
  }, [appOrigin, selectedProduct]);

  const inpayConfig = useMemo(() => {
    if (!appOrigin) return '';
    return buildInPayConfig({
      appOrigin,
      publishableKey: merchant.publishableKey,
      buildExample: buildInPayWidgetExample,
    });
  }, [appOrigin, merchant.publishableKey]);

  const catalogExample = useMemo(() => {
    if (!appOrigin) return '';
    return [
      '// Browser-safe: returns every active product in your catalog',
      `const res = await fetch('${appOrigin}/api/v1/products?publishableKey=${merchant.publishableKey}');`,
      'const { products } = await res.json();',
      '',
      '// Render one button per product (each product needs its own snippet)',
      'for (const product of products) {',
      '  console.log(product.id, product.name, product.priceDisplay);',
      '}',
    ].join('\n');
  }, [appOrigin, merchant.publishableKey]);

  async function handleSave() {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await updateMerchant(secret, {
        config: { buttonText, accentColor, mode },
      });
      await onChanged();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateLink() {
    if (!selectedProduct) return;
    setLinkBusy(true);
    setError('');
    try {
      const data = await createPaymentSession(secret, {
        productId: selectedProduct.id,
        quantity,
        mode: mode === 'both' ? 'escrow' : mode,
      });
      setPaymentLink(data.session.checkoutUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setLinkBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Payment</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Pick an item, set the button and mode, then copy the embed snippet or
              create a hosted payment link.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-gray-500">Publishable key</span>
            <code className="font-mono text-gray-300 bg-[#0e1017] border border-[#23273a] px-2 py-1 rounded-lg">
              {merchant.publishableKey}
            </code>
            <CopyButton value={merchant.publishableKey} label="Copy" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-5">
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Button text">
                <input
                  className={inputClass}
                  value={buttonText}
                  maxLength={40}
                  onChange={(e) => setButtonText(e.target.value)}
                />
              </Field>
              <Field label="Accent color">
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value.toUpperCase())}
                    className="h-10 w-12 rounded-lg bg-[#0e1017] border border-[#242941] p-1"
                  />
                  <input
                    className={inputClass}
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value.toUpperCase())}
                  />
                </div>
              </Field>
            </div>

            <Field label="Payment mode">
              <div className="grid grid-cols-3 gap-2">
                {MODE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMode(option.id)}
                    className={`px-2 py-2 rounded-xl border text-[11px] font-semibold transition ${
                      mode === option.id
                        ? 'border-[#14F195]/60 bg-[#14F195]/10 text-[#b8ffe3]'
                        : 'border-[#23273a] bg-[#0e1017] text-gray-400 hover:border-[#3a405c]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Snippet product (${products.length})`}>
                <select
                  className={inputClass}
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  disabled={products.length === 0}
                >
                  {products.length === 0 && <option value="">No products yet</option>}
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quantity">
                <input
                  type="number"
                  min="1"
                  max="100"
                  className={inputClass}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                />
              </Field>
            </div>
            <p className="text-[11px] text-gray-500 -mt-1">
              The selector lists your whole catalog and previews one product at a
              time. Each product gets its own embed snippet — use the Catalog API
              below to load them all into a storefront.
            </p>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={busy}
                className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {busy ? 'Saving…' : saved ? 'Saved' : 'Save settings'}
              </button>
              <button
                onClick={handleCreateLink}
                disabled={linkBusy || !selectedProduct}
                className="px-3 h-10 rounded-xl bg-[#181b28] border border-[#2a2f45] text-[11px] font-semibold text-gray-200 disabled:opacity-40 flex items-center gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5" />
                {linkBusy ? 'Creating…' : 'Create payment link'}
              </button>
            </div>

            {paymentLink && (
              <div className="rounded-xl border border-[#14F195]/30 bg-[#14F195]/5 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-[#b8ffe3]">
                  Hosted checkout link
                </p>
                <code className="block text-[10px] text-gray-300 break-all font-mono">
                  {paymentLink}
                </code>
                <div className="flex gap-2">
                  <CopyButton value={paymentLink} label="Copy link" />
                  <a
                    href={paymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#14F195]/15 border border-[#14F195]/30 text-[11px] font-semibold text-[#b8ffe3]"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            <div className="rounded-xl bg-[#0e1017] border border-[#1e2233] p-3 text-[11px] text-gray-500 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#c4a3ff] shrink-0 mt-0.5" />
              {serverNote(mode)}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
              <Palette className="w-3.5 h-3.5" />
              Live preview
            </div>
            <div className="rounded-2xl border border-[#23273a] bg-[#0c0e15] p-4">
              <div className="rounded-2xl bg-[#12141f] border border-[#23273a] p-4 max-w-sm mx-auto space-y-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-[#0b0c12]"
                    style={{ background: `linear-gradient(135deg, ${accentColor}, #14F195)` }}
                  >
                    {merchant.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{merchant.name}</p>
                    <p className="text-[10px] text-gray-500">Powered by EscrowPay</p>
                  </div>
                </div>
                <div className="rounded-xl bg-[#0b0c12] border border-[#1e2233] p-3">
                  <p className="text-xs font-semibold text-white">
                    {selectedProduct?.name || 'Your product'}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {selectedProduct
                      ? formatFiatMinor(selectedProduct.priceMinor, selectedProduct.currency)
                      : 'Add a product to preview pricing'}
                  </p>
                </div>
                <button
                  type="button"
                  className="w-full h-10 rounded-xl text-xs font-bold text-[#0b0c12]"
                  style={{ background: `linear-gradient(90deg, ${accentColor}, #14F195)` }}
                >
                  {buttonText || 'Pay with crypto'}
                </button>
                <p className="text-[9px] text-center text-gray-600">
                  {mode === 'escrow'
                    ? 'Escrow protected · buyer can reclaim until claimed'
                    : mode === 'direct'
                    ? 'Instant payment to merchant'
                    : 'Buyer chooses escrow or instant at checkout'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-[#14F195]" />
              Popup pay
            </h3>
            <CopyButton value={snippet} label="Copy HTML" />
          </div>
          <pre className="text-[10px] leading-relaxed text-gray-300 bg-[#0a0c12] border border-[#1e2233] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {snippet || 'Add a product to generate the snippet.'}
          </pre>
          <p className="text-[11px] text-gray-500">
            Paste both tags into the product page. The script opens the hosted
            checkout in a popup (or an iframe if popups are blocked).
          </p>
        </Panel>

        <Panel className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-[#c4a3ff]" />
              Server-to-server API
            </h3>
            <CopyButton value={apiExample} label="Copy curl" />
          </div>
          <pre className="text-[10px] leading-relaxed text-gray-300 bg-[#0a0c12] border border-[#1e2233] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {apiExample || 'Add a product to generate an API example.'}
          </pre>
          <p className="text-[11px] text-gray-500">
            Use your secret key on the server to create sessions for invoices or
            custom amounts, then redirect the buyer to the returned checkout URL.
          </p>
        </Panel>

        <Panel className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#14F195]" />
              Inline pay
            </h3>
            <CopyButton value={inpayConfig} label="Copy component" />
          </div>
          <pre className="text-[10px] leading-relaxed text-gray-300 bg-[#0a0c12] border border-[#1e2233] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {inpayConfig}
          </pre>
          <p className="text-[11px] text-gray-500">
            Mount this component on your checkout page and pass your server-priced order:
            {' '}<code>{'{ amountMinor, currency, reference, description }'}</code>.
            EscrowPay handles the wallet, transaction and confirmation inline, then returns
            the funded session on <code>escrowpay:paid</code> so you can confirm the payment
            to the buyer. Keep your secret key on your server.
          </p>
        </Panel>

        <Panel className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#c4a3ff]" />
              Catalog API
            </h3>
            <CopyButton value={catalogExample} label="Copy JS" />
          </div>
          <pre className="text-[10px] leading-relaxed text-gray-300 bg-[#0a0c12] border border-[#1e2233] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {catalogExample}
          </pre>
          <p className="text-[11px] text-gray-500">
            Uses your publishable key and is origin-checked against your registered
            domains. Only active products are returned; disabled products stay hidden
            from buyers.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function serverNote(mode) {
  if (mode === 'direct') {
    return 'Instant mode sends SOL straight to your payout wallet. It is not escrow-protected.';
  }
  if (mode === 'both') {
    return 'The snippet defaults to escrow; pass data-mode="direct" on the button for instant payments.';
  }
  return 'Escrow mode holds the buyer payment in the deployed program vault until you claim it.';
}
