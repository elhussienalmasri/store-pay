import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState, QuantityPicker } from '../components/ShopUi';
import { CART_EVENT, readCart, removeFromCart, setQuantity } from '../lib/cart';
import { formatPrice } from '../lib/money';
import { lineTotal } from '../lib/orders';

export default function CartPage() {
  const [cart, setCart] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [failed, setFailed] = useState(false);

  const syncCart = useCallback(() => setCart(readCart()), []);

  useEffect(() => {
    syncCart();
    window.addEventListener(CART_EVENT, syncCart);
    return () => window.removeEventListener(CART_EVENT, syncCart);
  }, [syncCart]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/products')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('bad response'))))
      .then((data) => {
        if (!cancelled) setCatalog(data.products);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lines = useMemo(
    () =>
      cart
        .map((item) => {
          const product = catalog.find((entry) => entry.slug === item.slug);
          if (!product) return null;
          return {
            product,
            quantity: item.quantity,
            lineTotalCents: lineTotal(product.priceCents, item.quantity),
          };
        })
        .filter(Boolean),
    [cart, catalog]
  );

  const dropped = cart.length - lines.length;
  const totalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);

  return (
    <div className="space-y-6">
      <Head>
        <title>Cart · Shop App</title>
      </Head>

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold text-white">Your Cart</h1>
        <Link href="/" className="text-sm text-gray-400 hover:text-white transition">
          Keep shopping
        </Link>
      </div>

      {failed && (
        <div className="panel p-4 text-sm text-rose-300">Prices could not be loaded. Reload the page to try again.</div>
      )}

      {lines.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          hint="Add something from the catalogue and it will show up here."
          action={
            <Link href="/" className="btn-primary w-fit">
              Browse Catalogue
            </Link>
          }
        />
      ) : (
        <>
          <div className="panel divide-y divide-line">
            {lines.map(({ product, quantity, lineTotalCents }) => (
              <div key={product.slug} className="flex flex-wrap items-center gap-4 p-4">
                <div className="w-16 h-16 rounded-xl bg-[#0f111a] overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${product.slug}`} className="text-sm font-bold text-white hover:text-mint transition">
                    {product.title}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {formatPrice(product.priceCents)} each {!product.inStock && '· out of stock'}
                  </p>
                </div>
                <QuantityPicker
                  value={quantity}
                  onChange={(next) => {
                    setQuantity(product.slug, next);
                    syncCart();
                  }}
                />
                <span className="w-24 text-right text-sm font-black text-white">{formatPrice(lineTotalCents)}</span>
                <button
                  type="button"
                  onClick={() => {
                    removeFromCart(product.slug);
                    syncCart();
                  }}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {dropped > 0 && (
            <p className="text-xs text-gray-400">
              {dropped} {dropped === 1 ? 'item' : 'items'} are no longer sold here and were left out of the total.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 panel p-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">Total</p>
              <p className="text-2xl font-black text-mint">{formatPrice(totalCents)}</p>
            </div>
            <Link
              href={lines.some((line) => !line.product.inStock) ? '#' : '/checkout'}
              className={lines.some((line) => !line.product.inStock) ? 'btn-primary pointer-events-none opacity-50' : 'btn-primary'}
            >
              Checkout
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
