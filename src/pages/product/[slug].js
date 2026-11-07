import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { QuantityPicker } from '../../components/ShopUi';
import { addToCart } from '../../lib/cart';
import { findProduct } from '../../lib/db';
import { formatPrice } from '../../lib/money';

export default function ProductPage({ product }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    addToCart(product.slug, quantity);
    setAdded(true);
  };

  const handleBuyNow = () => {
    router.push(`/checkout?slug=${encodeURIComponent(product.slug)}&qty=${quantity}`);
  };

  return (
    <div className="space-y-8">
      <Head>
        <title>{`${product.title} · Shop App`}</title>
      </Head>

      <Link href="/" className="text-sm text-gray-400 hover:text-white transition">
        Back to catalogue
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="panel overflow-hidden">
          <div className="aspect-square bg-[#0f111a] grid place-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-gray-500">
              {product.categoryName} · {product.manufacturer}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{product.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-2xl font-black text-mint">{formatPrice(product.priceCents)}</span>
              {product.rating > 0 && (
                <span className="text-gray-400">
                  Rated {product.rating} of 5
                </span>
              )}
              <span className={product.inStock ? 'text-mint text-xs font-semibold uppercase' : 'text-rose-400 text-xs font-semibold uppercase'}>
                {product.inStock ? 'In stock' : 'Out of stock'}
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-300 leading-relaxed">{product.description}</p>

          {product.specs.length > 0 && (
            <ul className="panel p-5 space-y-2">
              {product.specs.map((spec) => (
                <li key={spec} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="w-1.5 h-1.5 mt-2 rounded-full bg-grape shrink-0" />
                  {spec}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <QuantityPicker value={quantity} onChange={setQuantity} />
            <button type="button" onClick={handleAddToCart} disabled={!product.inStock} className="btn-secondary">
              Add to Cart
            </button>
            <button type="button" onClick={handleBuyNow} disabled={!product.inStock} className="btn-primary">
              Buy Now
            </button>
          </div>

          {!product.inStock ? (
            <p className="text-xs text-gray-400">This item is not available right now.</p>
          ) : (
            added && (
              <p className="text-xs text-mint">
                Added to cart. <Link href="/cart" className="underline">Open cart</Link>
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const product = findProduct(params.slug);
  if (!product) return { notFound: true };
  return { props: { product } };
}
