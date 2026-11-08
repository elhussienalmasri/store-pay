import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { DEPRECATED_getWallets } from '@wallet-standard/app';
import { clusterApiUrl } from '@solana/web3.js';
import { DEVNET_RPC_URL } from '../lib/constants';

import '@solana/wallet-adapter-react-ui/styles.css';

const SIGN_FEATURES = ['solana:signAndSendTransaction', 'solana:signTransaction'];

// WalletProvider builds an adapter for every registered Wallet Standard wallet while it renders, and reads
// supportedTransactionVersions and accounts while doing it. A wallet that registers without those fields
// throws inside that render, which unmounts the whole app and leaves the buyer a blank page. Filling in the
// spec defaults the moment the wallet registers keeps every wallet available without one bad wallet sinking
// checkout.
function completeWallet(wallet) {
  try {
    if (!Array.isArray(wallet.accounts)) wallet.accounts = [];
    for (const name of SIGN_FEATURES) {
      const feature = wallet.features?.[name];
      if (feature && !Array.isArray(feature.supportedTransactionVersions)) {
        feature.supportedTransactionVersions = ['legacy'];
      }
    }
  } catch (err) {
    // Some wallets freeze themselves; an unwritable field is left as the wallet published it.
  }
}

function watchWalletRegistrations() {
  if (typeof window === 'undefined') return;
  try {
    // Same entry point WalletProvider uses: it flushes wallets that registered through the older
    // navigator.wallets push protocol, so those extensions keep showing up.
    const { get, on } = DEPRECATED_getWallets();
    get().forEach(completeWallet);
    on('register', (...wallets) => wallets.forEach(completeWallet));
  } catch (err) {
    // Without the registry there is nothing to normalize; built-in adapters still work.
  }
}

watchWalletRegistrations();

export function WalletContextProvider({ children }) {
  const endpoint = useMemo(() => DEVNET_RPC_URL || clusterApiUrl('devnet'), []);

  // Any other wallet that registers through Wallet Standard is added by WalletProvider itself.
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new BackpackWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
