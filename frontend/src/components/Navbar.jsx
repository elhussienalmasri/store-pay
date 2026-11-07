import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Shield, ExternalLink, RefreshCw, Layers, ArrowLeftRight, FileCheck, Coins, Zap } from 'lucide-react';
import { PROGRAM_ID_STRING, getExplorerUrl } from '../lib/constants';

// Dynamically import WalletMultiButton to prevent SSR hydration issues
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export function Navbar({ activeTab, setActiveTab, onRefresh, isRefreshing }) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [solBalance, setSolBalance] = useState(null);

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
        <div className="flex items-center justify-between h-20">
          
          {/* Brand & Devnet Badge */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9945FF] to-[#14F195] p-[1.5px] flex items-center justify-center shadow-lg shadow-purple-500/20">
                <div className="w-full h-full bg-[#0d0e15] rounded-[10px] flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[#14F195]" />
                </div>
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  Anchor <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">Escrow</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Devnet Only
                  </span>
                  <a
                    href={getExplorerUrl('address', PROGRAM_ID_STRING)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-gray-400 hover:text-white flex items-center gap-0.5 transition"
                    title="View deployed Anchor program on Solana Explorer"
                  >
                    <span>ID: {PROGRAM_ID_STRING.slice(0, 4)}...{PROGRAM_ID_STRING.slice(-4)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 p-1 bg-[#12141f] border border-[#212538] rounded-xl">
            <button
              onClick={() => setActiveTab('make')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'make'
                  ? 'bg-gradient-to-r from-[#9945FF] to-[#7427d1] text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              Create Escrow
            </button>

            <button
              onClick={() => setActiveTab('explore')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'explore'
                  ? 'bg-gradient-to-r from-[#9945FF] to-[#7427d1] text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="w-4 h-4" />
              Open Escrows
            </button>

            <button
              onClick={() => setActiveTab('p2p')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'p2p'
                  ? 'bg-gradient-to-r from-[#14F195] to-[#0eb570] text-[#0b0c10] shadow-md font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              P2P Evidence Desk
            </button>

            <button
              onClick={() => setActiveTab('widget')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'widget'
                  ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c10] shadow-md font-extrabold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Zap className="w-4 h-4 fill-current" />
              Merchant Widget
            </button>
          </nav>

          {/* Wallet Actions */}
          <div className="flex items-center space-x-3">
            {publicKey && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#131522] border border-[#23273a] text-xs font-mono text-gray-300">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{solBalance !== null ? `${solBalance} SOL` : '...'}</span>
              </div>
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

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-[#1b1f30]">
          <button
            onClick={() => setActiveTab('make')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${
              activeTab === 'make' ? 'text-white bg-purple-600/30' : 'text-gray-400'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Create
          </button>
          <button
            onClick={() => setActiveTab('explore')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${
              activeTab === 'explore' ? 'text-white bg-purple-600/30' : 'text-gray-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Escrows
          </button>
          <button
            onClick={() => setActiveTab('p2p')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${
              activeTab === 'p2p' ? 'text-[#14F195] bg-[#14F195]/20 font-bold' : 'text-gray-400'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            P2P Desk
          </button>
          <button
            onClick={() => setActiveTab('widget')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${
              activeTab === 'widget' ? 'text-[#14F195] bg-[#14F195]/20 font-bold' : 'text-gray-400'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Widget
          </button>
        </div>

      </div>
    </header>
  );
}
