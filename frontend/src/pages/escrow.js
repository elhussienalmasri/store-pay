import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useConnection } from '@solana/wallet-adapter-react';
import { Navbar } from '../components/Navbar';
import { MakeEscrowCard } from '../components/MakeEscrowCard';
import { OpenEscrowsList } from '../components/OpenEscrowsList';
import { P2PEscrowPortal } from '../components/P2PEscrowPortal';
import { DevnetFaucetHelper } from '../components/DevnetFaucetHelper';
import { TransactionModal } from '../components/TransactionModal';
import { fetchOpenEscrows } from '../lib/escrowProgram';
import { SiteFooter } from '../components/SiteFooter';
import { Sparkles } from 'lucide-react';

export default function EscrowApp() {
  const { connection } = useConnection();

  // Active escrow tab: 'make' | 'explore' | 'p2p'
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
      <Head>
        <title>Escrow App · EscrowPay</title>
      </Head>

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

      </main>

      <SiteFooter />

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
