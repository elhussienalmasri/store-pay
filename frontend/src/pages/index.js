import React, { useState, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Navbar } from '../components/Navbar';
import { MakeEscrowCard } from '../components/MakeEscrowCard';
import { OpenEscrowsList } from '../components/OpenEscrowsList';
import { P2PEscrowPortal } from '../components/P2PEscrowPortal';
import { MerchantWidgetExperience } from '../components/widget/MerchantWidgetExperience';
import { DevnetFaucetHelper } from '../components/DevnetFaucetHelper';
import { TransactionModal } from '../components/TransactionModal';
import { fetchOpenEscrows } from '../lib/escrowProgram';
import { PROGRAM_ID_STRING, getExplorerUrl } from '../lib/constants';
import { Shield, Sparkles, ExternalLink, Code2 } from 'lucide-react';

export default function Home() {
  const { connection } = useConnection();

  // Active view tab: 'make' | 'explore' | 'p2p' | 'widget'
  const [activeTab, setActiveTab] = useState('make');

  // Escrow state
  const [escrows, setEscrows] = useState([]);
  const [isLoadingEscrows, setIsLoadingEscrows] = useState(false);

  // Transaction Modal State
  const [txModalState, setTxModalState] = useState({
    isOpen: false,
    status: 'signing', // 'signing' | 'confirming' | 'success' | 'error'
    title: '',
    message: '',
    txSignature: '',
  });

  const openTxModal = useCallback((state) => {
    setTxModalState((prev) => ({
      ...prev,
      isOpen: true,
      ...state,
    }));
  }, []);

  const closeTxModal = useCallback(() => {
    setTxModalState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  // Fetch open escrows from Solana Devnet RPC
  const loadEscrows = useCallback(async () => {
    try {
      setIsLoadingEscrows(true);
      const data = await fetchOpenEscrows(connection);
      setEscrows(data);
    } catch (err) {
      console.warn('Failed to fetch open escrows from RPC:', err);
    } finally {
      setIsLoadingEscrows(false);
    }
  }, [connection]);

  useEffect(() => {
    loadEscrows();
    // Poll every 15 seconds for updates
    const interval = setInterval(loadEscrows, 15000);
    return () => clearInterval(interval);
  }, [loadEscrows]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0c10] text-[#e0e2ec]">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={loadEscrows}
        isRefreshing={isLoadingEscrows}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-semibold text-purple-300">
            <Sparkles className="w-3.5 h-3.5 text-[#14F195]" />
            Solana Anchor Custodial Vaults & P2P Portal
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Trustless Escrow on{' '}
            <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">
              Solana Devnet
            </span>
          </h1>
          <p className="text-sm text-gray-400">
            Deposit tokens into program-derived vaults, swap atomically, or use our P2P desk with proof-of-payment evidence verification.
          </p>
        </div>

        {/* View Switcher Content */}
        {activeTab === 'make' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <MakeEscrowCard
              onEscrowCreated={loadEscrows}
              openTxModal={openTxModal}
            />
            <DevnetFaucetHelper />
          </div>
        )}

        {activeTab === 'explore' && (
          <div className="animate-in fade-in duration-300">
            <OpenEscrowsList
              escrows={escrows}
              isLoading={isLoadingEscrows}
              onRefresh={loadEscrows}
              openTxModal={openTxModal}
            />
          </div>
        )}

        {activeTab === 'p2p' && (
          <div className="animate-in fade-in duration-300">
            <P2PEscrowPortal
              openEscrows={escrows}
              openTxModal={openTxModal}
              onRefresh={loadEscrows}
            />
          </div>
        )}

        {activeTab === 'widget' && (
          <div className="animate-in fade-in duration-300">
            <MerchantWidgetExperience />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#1b1f30] bg-[#0d0e14] py-8 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#14F195]" />
            <span>Program ID:</span>
            <a
              href={getExplorerUrl('address', PROGRAM_ID_STRING)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-purple-400 hover:underline flex items-center gap-1"
            >
              {PROGRAM_ID_STRING}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Devnet Cluster
            </span>
            <span>•</span>
            <span>Phantom Wallet Ready</span>
          </div>
        </div>
      </footer>

      {/* Global Transaction Modal */}
      <TransactionModal
        isOpen={txModalState.isOpen}
        status={txModalState.status}
        title={txModalState.title}
        message={txModalState.message}
        txSignature={txModalState.txSignature}
        onClose={closeTxModal}
      />
    </div>
  );
}
