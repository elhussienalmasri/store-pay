import React from 'react';
import Head from 'next/head';
import { WalletContextProvider } from '../components/WalletContextProvider';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Solana Anchor Escrow | Devnet Token Swap & P2P Portal</title>
        <meta
          name="description"
          content="Trustless token swap escrow and P2P verification portal built on Solana Devnet with Anchor framework."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <WalletContextProvider>
        <Component {...pageProps} />
      </WalletContextProvider>
    </>
  );
}
