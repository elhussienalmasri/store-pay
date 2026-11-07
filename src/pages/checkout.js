import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, QuantityPicker } from '../components/ShopUi';
import { clearCart, readCart, removeFromCart, setQuantity } from '../lib/cart';
import { formatPrice } from '../lib/money';
import { lineTotal } from '../lib/orders';
import { fetchUser } from '../lib/session';

const FIELDS = [
  { key: 'name', label: 'Name', type: 'text', autoComplete: 'name', placeholder: 'Your Name' },
  { key: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@example.com' },
  { key: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel', placeholder: '+1 555 0100' },
];

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

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((line) => ({ slug: line.product.slug, quantity: line.quantity })),
          customer,
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
            Delivery details only. This store does not take payment — the order is recorded and marked placed.
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

          <button type="submit" className="btn-primary w-full" disabled={submitting || unavailable.length > 0}>
            {submitting ? 'Placing order…' : 'Place Order'}
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
