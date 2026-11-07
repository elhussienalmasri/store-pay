import Head from 'next/head';
import Link from 'next/link';
import { ProductCard } from '../components/ShopUi';
import { countProducts, listProducts } from '../lib/db';

export default function HomePage({ products, total }) {
  return (
    <div className="space-y-10">
      <Head>
        <title>Shop App · Electronics</title>
      </Head>

      <section className="panel p-8 sm:p-10 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-mint">{total} products</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Everyday electronics, priced in the open
        </h1>
        <p className="text-sm text-gray-400 max-w-xl">
          Pick a product, add it to the cart or order it straight away. Checkout collects delivery details only —
          no payment is taken on this store.
        </p>
        <a href="#catalogue" className="btn-secondary w-fit">
          Browse catalogue
        </a>
      </section>

      <section id="catalogue" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-lg font-bold text-white">Catalogue</h2>
          <Link href="/cart" className="text-sm text-gray-400 hover:text-white transition">
            View cart
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="panel p-10 text-center text-sm text-gray-400">
            No products yet. Run <code className="text-mint">npm run setup:db</code> to load the catalogue.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export async function getServerSideProps() {
  const products = listProducts();
  return { props: { products, total: countProducts() } };
}
