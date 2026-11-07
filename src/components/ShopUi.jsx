import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { CART_EVENT, cartCount, readCart } from '../lib/cart';
import { formatPrice } from '../lib/money';
import { SESSION_EVENT, emitSessionChange, fetchUser, submitAuth } from '../lib/session';

function BagIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8z" strokeLinejoin="round" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
    </svg>
  );
}

export function SiteHeader() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const sync = () => setCount(cartCount(readCart()));
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    const sync = () => fetchUser().then(setUser).catch(() => setUser(null));
    sync();
    window.addEventListener(SESSION_EVENT, sync);
    return () => window.removeEventListener(SESSION_EVENT, sync);
  }, []);

  const signOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    emitSessionChange();
    if (router.pathname !== '/') router.push('/');
  };

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-white font-extrabold tracking-tight">
          <span className="w-7 h-7 rounded-lg bg-mint text-[#04140d] grid place-items-center text-sm font-black">S</span>
          Shop App
        </Link>

        <nav className="flex items-center gap-2 min-w-0">
          <Link
            href="/cart"
            className={`relative inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition ${
              router.pathname === '/cart' ? 'border-mint/60 text-mint' : 'border-line text-gray-300 hover:text-white'
            }`}
          >
            <BagIcon className="w-4 h-4" />
            Cart
            {count > 0 && (
              <span className="ml-1 min-w-5 px-1.5 py-0.5 rounded-full bg-mint text-[#04140d] text-[11px] font-black text-center">
                {count}
              </span>
            )}
          </Link>

          {user ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-full bg-grape/20 border border-grape/40 grid place-items-center text-xs font-black text-grape shrink-0">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-sm font-semibold text-white truncate max-w-28 sm:max-w-40">{user.name}</span>
              <button
                type="button"
                onClick={signOut}
                className="px-3 py-2 rounded-xl border border-line text-sm font-semibold text-gray-300 hover:text-white transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/signin"
                className={`px-3 py-2 rounded-xl border border-line text-sm font-semibold transition ${
                  router.pathname === '/signin' ? 'text-white border-[#323850]' : 'text-gray-300 hover:text-white'
                }`}
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className={`px-3 py-2 rounded-xl text-sm font-bold transition ${
                  router.pathname === '/signup'
                    ? 'bg-mint text-[#04140d] opacity-80'
                    : 'bg-mint text-[#04140d] hover:brightness-110'
                }`}
              >
                Create Account
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-xs text-gray-500">
        Shop App · Demo catalogue with sample electronics
      </div>
    </footer>
  );
}

export function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function AuthForm({ title, subtitle, fields, submitPath, primaryLabel, footer, redirectTo = '/' }) {
  const router = useRouter();
  const [values, setValues] = useState(() =>
    fields.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {})
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError('');

    try {
      const result = await submitAuth(submitPath, values);
      if (!result.ok) {
        setErrors(result.errors);
        setFormError(result.error || 'Something went wrong.');
        return;
      }
      emitSessionChange();
      router.push(redirectTo);
    } catch {
      setFormError('The shop did not answer. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto w-full space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-extrabold text-white">{title}</h1>
        <p className="text-sm text-gray-400">{subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="panel p-6 space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="label" htmlFor={field.key}>
              {field.label}
            </label>
            <input
              id={field.key}
              name={field.key}
              type={field.type}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              value={values[field.key]}
              onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
              className="field"
            />
            {errors[field.key] && <p className="mt-1 text-xs text-rose-400">{errors[field.key]}</p>}
          </div>
        ))}

        {formError && <p className="text-xs text-rose-400">{formError}</p>}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Working…' : primaryLabel}
        </button>

        {footer}
      </form>
    </div>
  );
}

export function ProductCard({ product }) {
  return (
    <Link href={`/product/${product.slug}`} className="panel overflow-hidden group hover:border-[#323850] transition">
      <div className="aspect-square bg-[#0f111a] grid place-items-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition"
          loading="lazy"
        />
      </div>
      <div className="p-4 space-y-1.5">
        <p className="text-[11px] uppercase tracking-wider text-gray-500">{product.categoryName}</p>
        <h3 className="text-sm font-bold text-white leading-snug">{product.title}</h3>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-base font-black text-mint">{formatPrice(product.priceCents)}</span>
          {!product.inStock && (
            <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wide">Out of Stock</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function QuantityPicker({ value, onChange, max = 99 }) {
  return (
    <div className="inline-flex items-center border border-line rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="px-3 py-2 text-gray-300 hover:text-white hover:bg-[#1a1d2a] transition"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        type="number"
        min="1"
        max={max}
        value={value}
        onChange={(event) => onChange(Math.max(1, Math.min(max, Number(event.target.value) || 1)))}
        className="w-14 py-2 text-center text-sm bg-transparent border-x border-line focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Quantity"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="px-3 py-2 text-gray-300 hover:text-white hover:bg-[#1a1d2a] transition"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="panel p-10 text-center space-y-3">
      <p className="text-white font-bold">{title}</p>
      {hint && <p className="text-sm text-gray-400">{hint}</p>}
      {action}
    </div>
  );
}
