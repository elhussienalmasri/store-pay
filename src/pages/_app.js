import '../styles/globals.css';
import Head from 'next/head';
import { Layout } from '../components/ShopUi';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Shop App</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </>
  );
}
