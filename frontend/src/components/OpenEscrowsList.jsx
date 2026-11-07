import React, { useState, useEffect, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import {
  Layers,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Filter,
  User,
  Clock,
  Coins,
  RefreshCw
} from 'lucide-react';
import { getExplorerUrl, DEFAULT_DEVNET_TOKENS } from '../lib/constants';
import { atomicToUi, getMintDetails, getWalletTokenBalance } from '../lib/tokens';
import {
  createTakeInstruction,
  createRefundInstruction,
  parseAnchorError,
} from '../lib/escrowProgram';

export function OpenEscrowsList({ escrows, isLoading, onRefresh, openTxModal }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [filterMakerOnly, setFilterMakerOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState(null);

  // Mint metadata cache (decimals, symbols)
  const [mintMetadata, setMintMetadata] = useState({});

  // Fetch mint details for any un-cached mints in the escrow list
  useEffect(() => {
    let isMounted = true;
    async function loadMints() {
      const mintsToFetch = new Set();
      escrows.forEach((e) => {
        if (!mintMetadata[e.mintAAddress]) mintsToFetch.add(e.mintAAddress);
        if (!mintMetadata[e.mintBAddress]) mintsToFetch.add(e.mintBAddress);
      });

      if (mintsToFetch.size === 0) return;

      const newMeta = { ...mintMetadata };
      for (const m of mintsToFetch) {
        // Check if known default token
        const known = DEFAULT_DEVNET_TOKENS.find((t) => t.mint === m);
        if (known) {
          newMeta[m] = { decimals: known.decimals, symbol: known.symbol, logo: known.logo };
        } else {
          try {
            const details = await getMintDetails(connection, m);
            newMeta[m] = {
              decimals: details.decimals,
              symbol: `${m.slice(0, 4)}...`,
              logo: '🪙',
            };
          } catch (e) {
            newMeta[m] = { decimals: 6, symbol: 'Token', logo: '🪙' };
          }
        }
      }

      if (isMounted) {
        setMintMetadata(newMeta);
      }
    }

    if (escrows.length > 0) {
      loadMints();
    }

    return () => { isMounted = false; };
  }, [escrows, connection]);

  // Filtered escrows
  const filteredEscrows = useMemo(() => {
    return escrows.filter((e) => {
      if (filterMakerOnly && publicKey) {
        if (e.makerAddress !== publicKey.toBase58()) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesMaker = e.makerAddress.toLowerCase().includes(q);
        const matchesMintA = e.mintAAddress.toLowerCase().includes(q);
        const matchesMintB = e.mintBAddress.toLowerCase().includes(q);
        const matchesPda = e.address.toLowerCase().includes(q);
        return matchesMaker || matchesMintA || matchesMintB || matchesPda;
      }
      return true;
    });
  }, [escrows, filterMakerOnly, searchQuery, publicKey]);

  // Handle Take / Fulfill Escrow
  async function handleTake(escrow) {
    if (!publicKey) {
      alert('Please connect your Phantom wallet.');
      return;
    }

    try {
      setProcessingId(escrow.address);
      openTxModal({
        status: 'signing',
        title: 'Fulfill Escrow Swap',
        message: 'Please approve the swap transaction in your Phantom wallet.',
      });

      const ix = createTakeInstruction({
        taker: publicKey,
        maker: escrow.maker,
        seed: escrow.seedBigInt,
        mintA: escrow.mintA,
        mintB: escrow.mintB,
        tokenProgram: escrow.tokenProgramId,
      });

      const transaction = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);

      openTxModal({
        status: 'confirming',
        title: 'Settling Swap on Devnet',
        message: 'Transaction sent! Tokens are transferring atomically on-chain...',
        txSignature: signature,
      });

      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction confirmation error on-chain.');
      }

      openTxModal({
        status: 'success',
        title: 'Escrow Swap Completed!',
        message: 'Tokens transferred successfully! Escrow and vault accounts closed and rent returned.',
        txSignature: signature,
      });

      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Take Escrow Error:', err);
      openTxModal({
        status: 'error',
        title: 'Failed to Complete Swap',
        message: parseAnchorError(err),
      });
    } finally {
      setProcessingId(null);
    }
  }

  // Handle Refund / Cancel Escrow
  async function handleRefund(escrow) {
    if (!publicKey) {
      alert('Please connect your Phantom wallet.');
      return;
    }

    if (escrow.makerAddress !== publicKey.toBase58()) {
      alert('Only the original maker can refund this escrow.');
      return;
    }

    try {
      setProcessingId(escrow.address);
      openTxModal({
        status: 'signing',
        title: 'Refund Escrow',
        message: 'Please approve the refund transaction in Phantom to recover your tokens and account rent.',
      });

      const ix = createRefundInstruction({
        maker: publicKey,
        seed: escrow.seedBigInt,
        mintA: escrow.mintA,
        tokenProgram: escrow.tokenProgramId,
      });

      const transaction = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);

      openTxModal({
        status: 'confirming',
        title: 'Reclaiming Tokens on Devnet',
        message: 'Transaction sent! Unlocking vault tokens and closing account...',
        txSignature: signature,
      });

      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction confirmation error on-chain.');
      }

      openTxModal({
        status: 'success',
        title: 'Escrow Refunded!',
        message: 'Deposited tokens returned to your wallet and rent SOL reclaimed.',
        txSignature: signature,
      });

      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Refund Escrow Error:', err);
      openTxModal({
        status: 'error',
        title: 'Failed to Refund Escrow',
        message: parseAnchorError(err),
      });
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 glass-panel rounded-2xl border border-[#23273a]">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Layers className="w-5 h-5 text-[#9945FF]" />
          <h2 className="text-lg font-bold text-white">Open Escrows</h2>
          <span className="px-2 py-0.5 rounded-full bg-[#1b1f30] text-xs font-mono text-gray-300">
            {filteredEscrows.length} Active
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search maker or token mint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 bg-[#10121a] border border-[#23273a] text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-[#9945FF]"
          />

          {publicKey && (
            <button
              onClick={() => setFilterMakerOnly(!filterMakerOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition ${
                filterMakerOnly
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-[#10121a] text-gray-400 border-[#23273a] hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              My Escrows
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 bg-[#10121a] border border-[#23273a] rounded-xl text-gray-400 hover:text-white transition disabled:opacity-50"
            title="Refresh escrows"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#14F195]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Escrow Items List */}
      {isLoading ? (
        <div className="p-12 text-center glass-panel rounded-3xl border border-[#23273a]">
          <RefreshCw className="w-8 h-8 mx-auto text-[#14F195] animate-spin mb-3" />
          <p className="text-sm text-gray-300">Scanning Solana Devnet for open escrow accounts...</p>
        </div>
      ) : filteredEscrows.length === 0 ? (
        <div className="p-12 text-center glass-panel rounded-3xl border border-[#23273a]">
          <Coins className="w-12 h-12 mx-auto text-gray-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No Open Escrows Found</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto mb-5 leading-relaxed">
            There are currently no active escrows matching your filter on Solana Devnet. You can create the first one using the Create Escrow tab!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredEscrows.map((escrow) => {
            const metaA = mintMetadata[escrow.mintAAddress] || { decimals: 6, symbol: 'Token A', logo: '🪙' };
            const metaB = mintMetadata[escrow.mintBAddress] || { decimals: 6, symbol: 'Token B', logo: '🪙' };

            const displayOffered = atomicToUi(escrow.vaultAmount, metaA.decimals);
            const displayReceive = atomicToUi(escrow.receive, metaB.decimals);

            const isMaker = publicKey && escrow.makerAddress === publicKey.toBase58();
            const isProcessing = processingId === escrow.address;

            return (
              <div
                key={escrow.address}
                className="glass-panel p-5 sm:p-6 rounded-2xl border border-[#222638] hover:border-[#323850] transition shadow-lg relative"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-[#1b1f30] text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-400">Escrow:</span>
                    <a
                      href={getExplorerUrl('address', escrow.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-purple-400 hover:underline flex items-center gap-1"
                    >
                      {escrow.address.slice(0, 6)}...{escrow.address.slice(-6)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-gray-400 font-mono">
                      <span>Maker:</span>
                      <a
                        href={getExplorerUrl('address', escrow.makerAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-300 hover:text-white flex items-center gap-0.5"
                      >
                        {escrow.makerAddress.slice(0, 4)}...{escrow.makerAddress.slice(-4)}
                      </a>
                    </div>

                    {isMaker && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30 text-[10px]">
                        You are Maker
                      </span>
                    )}
                  </div>
                </div>

                {/* Offer vs Request Flow */}
                <div className="grid grid-cols-1 sm:grid-cols-5 items-center gap-4 my-2">
                  
                  {/* Token A Offered */}
                  <div className="sm:col-span-2 p-3.5 bg-[#0f111a] border border-[#1e2233] rounded-xl">
                    <div className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Vault Deposits (Token A)</div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-bold font-mono text-white">{displayOffered}</span>
                      <span className="text-xs font-semibold text-purple-400 flex items-center gap-1">
                        {metaA.logo} {metaA.symbol}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-gray-500 truncate mt-1">
                      Mint: {escrow.mintAAddress.slice(0, 8)}...
                    </div>
                  </div>

                  {/* Arrow Icon */}
                  <div className="sm:col-span-1 flex justify-center">
                    <div className="w-8 h-8 rounded-full bg-[#181a28] border border-[#272b40] flex items-center justify-center text-[#14F195]">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Token B Expected */}
                  <div className="sm:col-span-2 p-3.5 bg-[#0f111a] border border-[#1e2233] rounded-xl">
                    <div className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Maker Requests (Token B)</div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-bold font-mono text-white">{displayReceive}</span>
                      <span className="text-xs font-semibold text-[#14F195] flex items-center gap-1">
                        {metaB.logo} {metaB.symbol}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-gray-500 truncate mt-1">
                      Mint: {escrow.mintBAddress.slice(0, 8)}...
                    </div>
                  </div>

                </div>

                {/* Action Footer */}
                <div className="flex items-center justify-between pt-4 mt-3 border-t border-[#1b1f30]">
                  <div className="text-[11px] font-mono text-gray-400">
                    Seed: <span className="text-gray-300">{escrow.seed}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isMaker ? (
                      <button
                        onClick={() => handleRefund(escrow)}
                        disabled={isProcessing}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 active:scale-95 transition disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {isProcessing ? 'Processing...' : 'Refund & Cancel'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTake(escrow)}
                        disabled={!publicKey || isProcessing}
                        className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c10] hover:opacity-95 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {!publicKey ? 'Connect to Swap' : isProcessing ? 'Swapping...' : `Fulfill Swap (${displayReceive} ${metaB.symbol})`}
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
