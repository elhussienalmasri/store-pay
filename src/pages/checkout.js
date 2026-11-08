import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, QuantityPicker } from '../components/ShopUi';
import { clearCart, readCart, removeFromCart, setQuantity } from '../lib/cart';
import { formatPrice } from '../lib/money';
import { lineTotal, validateCustomer } from '../lib/orders';
import { fetchUser } from '../lib/session';

const FIELDS = [
  { key: 'name', label: 'Name', type: 'text', autoComplete: 'name', placeholder: 'Your Name' },
  { key: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@example.com' },
  { key: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel', placeholder: '+1 555 0100' },
];

const ESCROW_ID = process.env.NEXT_PUBLIC_ESCROWPAY_ID || '';
const ESCROW_ORIGIN = (process.env.NEXT_PUBLIC_ESCROWPAY_ORIGIN || '').replace(/\/+$/, '');

function InPay({ order, onPaid, onError, onReset }) {
  const host = useRef(null);
  const handlers = useRef({});
  handlers.current = { onPaid, onError, onReset };
  const pay = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const node = host.current;
    if (!ESCROW_ID || !ESCROW_ORIGIN) {
      handlers.current.onError?.('EscrowPay is not configured for this store.', true);
      return undefined;
    }
    const reset = (event) => {
      if (event.detail?.escrowId === ESCROW_ID) handlers.current.onReset?.();
    };
    window.addEventListener('escrowpay:reset', reset);
    const script = document.createElement('script');
    script.src = `${ESCROW_ORIGIN}/inpay/v1.js?escrow_id=${encodeURIComponent(ESCROW_ID)}`;
    script.async = true;
    script.dataset.target = 'escrowpay-inpay';
    script.onload = () => {
      pay.current = window.EscrowPayInPay?.pay;
      if (typeof pay.current !== 'function') {
        handlers.current.onError?.('EscrowPay could not start. Reload the page and try again.', true);
        return;
      }
      setLoaded(true);
    };
    script.onerror = () => handlers.current.onError?.('EscrowPay could not load. Check your connection and reload the page.', true);
    node.appendChild(script);
    return () => {
      window.removeEventListener('escrowpay:reset', reset);
      node.replaceChildren();
      script.remove();
    };
  }, []);

  useEffect(() => {
    if (!order || !loaded || !pay.current) return;
    pay.current(order)
      .then((payment) => handlers.current.onPaid?.(payment))
      .catch((error) => handlers.current.onError?.(error.message, error.canRetry !== false));
  }, [order, loaded]);

  return <div id="escrowpay-inpay" ref={host} aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }} />;
}

export default function CheckoutPage() {
  const router = useRouter();
  const directSlug = typeof router.query.slug === 'string' ? router.query.slug : '';
  const directQty = Math.max(1, Math.min(99, Number(router.query.qty) || 1));

  const [catalog, setCatalog] = useState([]);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [pendingOrder, setPendingOrder] = useState(null);

  useEffect(() => {
    setCart(readCart());
  }, [router.query.slug]);

  useEffect(() => {
    fetchUser()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/products')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('bad response'))))
      .then((data) => {
        if (!cancelled) setCatalog(data.products);
      })
      .catch(() => {
        if (!cancelled) setFormError('Products could not be loaded. Reload the page to try again.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lines = useMemo(() => {
    const wanted = directSlug
      ? [{ slug: directSlug, quantity: directQty }]
      : cart;
    return wanted
      .map((item) => {
        const product = catalog.find((entry) => entry.slug === item.slug);
        if (!product) return null;
        return { product, quantity: item.quantity, lineTotalCents: lineTotal(product.priceCents, item.quantity) };
      })
      .filter(Boolean);
  }, [catalog, cart, directSlug, directQty]);

  const totalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const unavailable = lines.filter((line) => !line.product.inStock);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError('');

    const { errors: fieldErrors, value: cleanCustomer } = validateCustomer(customer);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setFormError('Check the highlighted fields.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((line) => ({ slug: line.product.slug, quantity: line.quantity })),
          customer: cleanCustomer,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrors(data.errors || {});
        setFormError(data.error || 'The order could not be placed.');
        return;
      }

      if (!directSlug) clearCart();
      router.push(`/order/${data.order.reference}`);
    } catch {
      setFormError('The shop did not answer. Check the connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmPayment = async ({ session, reference }) => {
    setPaying(true);
    setPayError('');
    try {
      const response = await fetch('/api/escrow/paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, session }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The payment could not be confirmed.');
      if (!directSlug) clearCart();
      router.push(`/order/${data.order.reference}`);
    } catch (error) {
      setPayError(error.message);
      setPaying(false);
    }
  };

  const handlePay = async (event) => {
    event.preventDefault();
    setErrors({});
    setFormError('');
    setPayError('');
    const { errors: fieldErrors, value: customerDetails } = validateCustomer(customer);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setPayError('Check the highlighted fields before paying.');
      return;
    }
    setPaying(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((line) => ({ slug: line.product.slug, quantity: line.quantity })),
          customer: customerDetails,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(data.errors || {});
        throw new Error(data.error || 'The order could not be prepared.');
      }
      setPendingOrder({
        amountMinor: data.order.totalCents,
        currency: 'USD',
        reference: data.order.reference,
        description: lines.map((line) => `${line.quantity}x ${line.product.title}`).join(', ').slice(0, 120),
      });
    } catch (error) {
      setPayError(error.message);
      setPaying(false);
    }
  };

  if (lines.length === 0) {
    return (
      <EmptyState
        title="Nothing to check out"
        hint="Add a product to the cart, or open a product and use Buy Now."
        action={
          <Link href="/" className="btn-primary w-fit">
            Browse Catalogue
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Head>
        <title>Checkout · Shop App</title>
      </Head>

      <h1 className="text-2xl font-extrabold text-white">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-3 panel p-6 space-y-5">
          <p className="text-xs text-gray-400">
            Delivery details. Pay with Solana below; your payment stays in escrow until the seller claims it.
          </p>

          {FIELDS.map((field) => (
            <div key={field.key}>
              <label className="label" htmlFor={field.key}>
                {field.label}
              </label>
              <input
                id={field.key}
                type={field.type}
                autoComplete={field.autoComplete}
                placeholder={field.key === 'name' && user ? user.name : field.placeholder}
                value={customer[field.key]}
                onChange={(event) => setCustomer((prev) => ({ ...prev, [field.key]: event.target.value }))}
                className="field"
              />
              {errors[field.key] && <p className="mt-1 text-xs text-rose-400">{errors[field.key]}</p>}
            </div>
          ))}

          <div>
            <label className="label" htmlFor="address">
              Delivery Address
            </label>
            <textarea
              id="address"
              rows={3}
              autoComplete="street-address"
              placeholder="Street, building, city and postal code"
              value={customer.address}
              onChange={(event) => setCustomer((prev) => ({ ...prev, address: event.target.value }))}
              className="field resize-none"
            />
            {errors.address && <p className="mt-1 text-xs text-rose-400">{errors.address}</p>}
          </div>

          {formError && <p className="text-xs text-rose-400">{formError}</p>}

          <div className="space-y-3 border-t border-line pt-5">
            {payError && <p className="text-xs text-rose-400" role="alert">{payError}</p>}
            <button
              type="button"
              onClick={handlePay}
              disabled={paying || submitting || unavailable.length > 0}
              className="btn-primary w-full"
            >
              {paying ? 'Payment in progress…' : `Pay ${formatPrice(totalCents)} in crypto`}
            </button>
            <InPay
              order={pendingOrder}
              onPaid={confirmPayment}
              onError={(message, canRetry) => {
                setPayError(message);
                setPendingOrder(null);
                if (canRetry) setPaying(false);
              }}
              onReset={() => {
                setPayError('');
                setPendingOrder(null);
                setPaying(false);
              }}
            />
          </div>

          <button
            type="submit"
            className="btn-secondary w-full"
            disabled={submitting || paying || unavailable.length > 0}
          >
            {submitting ? 'Placing order…' : 'Place Order Without Payment'}
          </button>
        </form>

        <aside className="lg:col-span-2 space-y-4">
          <div className="panel divide-y divide-line">
            {lines.map(({ product, quantity, lineTotalCents }) => (
              <div key={product.slug} className="p-4 flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-[#0f111a] overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{product.title}</p>
                  <p className="text-xs text-gray-500">
                    {formatPrice(product.priceCents)} × {quantity}
                  </p>
                  {directSlug ? (
                    <p className="text-[11px] text-gray-400 mt-1">
                      <Link href={`/product/${product.slug}`} className="underline">
                        Change item
                      </Link>
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 mt-2">
                      <QuantityPicker
                        value={quantity}
                        onChange={(next) => {
                          setQuantity(product.slug, next);
                          setCart(readCart());
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          removeFromCart(product.slug);
                          setCart(readCart());
                        }}
                        className="text-[11px] font-semibold text-rose-400 hover:text-rose-300"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {!product.inStock && <p className="mt-1 text-[11px] text-rose-400">Out of stock</p>}
                </div>
                <span className="text-sm font-black text-white">{formatPrice(lineTotalCents)}</span>
              </div>
            ))}
            <div className="p-4 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-gray-500">Total</span>
              <span className="text-xl font-black text-mint">{formatPrice(totalCents)}</span>
            </div>
          </div>

          {unavailable.length > 0 && (
            <p className="text-xs text-rose-400">
              Remove or replace the out-of-stock item before placing the order.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
