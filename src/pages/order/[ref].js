import Head from 'next/head';
import Link from 'next/link';
import { formatPrice } from '../../lib/money';
import { getOrder } from '../../lib/db';

export default function OrderPage({ order }) {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Head>
        <title>{`Order ${order.reference} · Shop App`}</title>
      </Head>

      <div className="panel p-8 space-y-3 text-center">
        <p className="text-xs uppercase tracking-wider text-mint font-bold">{order.status}</p>
        <h1 className="text-2xl font-extrabold text-white">Order placed</h1>
        <p className="text-sm text-gray-400">
          Reference <span className="font-mono text-white">{order.reference}</span> ·{' '}
          {new Date(order.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="panel divide-y divide-line">
        {order.items.map((item) => (
          <div key={item.slug} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{item.title}</p>
              <p className="text-xs text-gray-500">
                {formatPrice(item.unitPriceCents)} × {item.quantity}
              </p>
            </div>
            <span className="text-sm font-black text-white">{formatPrice(item.lineTotalCents)}</span>
          </div>
        ))}
        <div className="p-4 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-gray-500">Total</span>
          <span className="text-xl font-black text-mint">{formatPrice(order.totalCents)}</span>
        </div>
      </div>

      <div className="panel p-5 space-y-1.5 text-sm">
        <p className="text-xs uppercase tracking-wider text-gray-500">Delivery details</p>
        <p className="text-white">{order.customer.name}</p>
        <p className="text-gray-400">{order.customer.email}</p>
        <p className="text-gray-400">{order.customer.phone}</p>
        <p className="text-gray-400 whitespace-pre-line">{order.customer.address}</p>
      </div>

      <Link href="/" className="btn-primary w-full">
        Back to Catalogue
      </Link>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const order = getOrder(params.ref);
  if (!order) return { notFound: true };
  return { props: { order } };
}
