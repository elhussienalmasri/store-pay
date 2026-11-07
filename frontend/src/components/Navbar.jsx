import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  ArrowLeftRight,
  Coins,
  FileCheck,
  Layers,
  LogIn,
  LogOut,
  RefreshCw,
  Shield,
  Store,
} from 'lucide-react';
import { getSession, logoutMerchant, clearStoredSecret } from '../lib/merchantApi';
import { PlatformNav } from './PlatformNav';

// Dynamically import WalletMultiButton to prevent SSR hydration issues
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

const ESCROW_TABS = [
  { id: 'make', label: 'Create Escrow', short: 'Create', icon: ArrowLeftRight },
  { id: 'explore', label: 'Open Escrows', short: 'Open', icon: Layers },
  { id: 'p2p', label: 'P2P Desk', short: 'P2P', icon: FileCheck },
];

export function Navbar({ activeTab, setActiveTab, onRefresh, isRefreshing }) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const router = useRouter();
  const [solBalance, setSolBalance] = useState(null);
  const [merchant, setMerchant] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((data) => {
        if (!cancelled) setMerchant(data?.merchant || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    clearStoredSecret();
    try {
      await logoutMerchant();
    } catch (err) {
      console.warn('Failed to clear session:', err);
    }
    setMerchant(null);
    router.reload();
  }

  useEffect(() => {
    let isMounted = true;

    async function fetchBalance() {
      if (!publicKey) {
        setSolBalance(null);
        return;
      }
      try {
        const bal = await connection.getBalance(publicKey);
        if (isMounted) {
          setSolBalance((bal / LAMPORTS_PER_SOL).toFixed(3));
        }
      } catch (err) {
        console.warn('Failed to fetch SOL balance:', err);
      }
    }

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [publicKey, connection]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#202436] bg-[#0b0c12]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-3">

          {/* Brand */}
          <Link href="/" className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9945FF] to-[#14F195] p-[1.5px] flex items-center justify-center shadow-lg shadow-purple-500/20">
              <div className="w-full h-full bg-[#0d0e15] rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#14F195]" />
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                Escrow<span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">Pay</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Devnet Only
              </span>
            </div>
          </Link>

          {/* Platform Tabs */}
          <PlatformNav active="escrow" className="hidden md:flex" />

          {/* Wallet Actions */}
          <div className="flex items-center space-x-3">
            {publicKey && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#131522] border border-[#23273a] text-xs font-mono text-gray-300">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{solBalance !== null ? `${solBalance} SOL` : '...'}</span>
              </div>
            )}

            {merchant ? (
              <>
                <Link
                  href="/merchant"
                  title={merchant.name}
                  className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#131522] border border-[#23273a] text-[11px] font-semibold text-gray-300 hover:text-white"
                >
                  <Store className="w-3.5 h-3.5 text-[#14F195] shrink-0" />
                  <span className="hidden lg:inline max-w-[9rem] truncate">{merchant.name}</span>
                  <span className="hidden sm:inline lg:hidden">Store</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="inline-flex p-2.5 rounded-xl bg-[#141624] border border-[#23273a] text-gray-400 hover:text-red-300 transition"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white"
                >
                  <LogIn className="w-3.5 h-3.5 sm:hidden" />
                  <span className="hidden sm:inline">Sign in</span>
                </Link>
                <Link
                  href="/signup"
                  className="hidden lg:inline-flex px-3 py-2 rounded-xl bg-[#1a1d2b] border border-[#2b3048] text-[11px] font-semibold text-white hover:bg-[#222638] transition"
                >
                  Get started
                </Link>
              </>
            )}

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2.5 rounded-xl bg-[#141624] border border-[#23273a] text-gray-400 hover:text-white hover:bg-[#1a1e30] transition disabled:opacity-50"
                title="Refresh balances & escrows"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#14F195]' : ''}`} />
              </button>
            )}

            <div className="solana-wallet-custom">
              <WalletMultiButton className="!bg-gradient-to-r !from-[#9945FF] !to-[#14F195] !text-[#0b0c12] !font-bold !text-xs !rounded-xl !h-10 !px-4 hover:!opacity-90" />
            </div>
          </div>

        </div>

        {/* Mobile Platform Tabs */}
        <div className="md:hidden flex justify-center pb-2">
          <PlatformNav active="escrow" />
        </div>

        {/* Escrow Subtabs */}
        <div className="flex items-center justify-between gap-3 py-2 border-t border-[#1b1f30]">
          <span className="hidden lg:inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            <Shield className="w-3 h-3 text-[#14F195]" />
            Escrow
          </span>
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {ESCROW_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${
                    active
                      ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="sm:hidden">{tab.short}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </header>
  );
}
