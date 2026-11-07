import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import {
  FileCheck,
  Upload,
  UserCheck,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Eye,
  FileText,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { atomicToUi, getMintDetails } from '../lib/tokens';
import { getExplorerUrl, DEFAULT_DEVNET_TOKENS } from '../lib/constants';
import { createTakeInstruction, createRefundInstruction, parseAnchorError } from '../lib/escrowProgram';

const STORAGE_KEY = 'solana_p2p_orders_v1';

export function P2PEscrowPortal({ openEscrows, openTxModal, onRefresh }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  // Role: 'buyer' or 'seller'
  const [role, setRole] = useState('buyer');
  const [traderName, setTraderName] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);

  // Orders stored locally
  const [orders, setOrders] = useState([]);
  const [selectedEscrowForTrade, setSelectedEscrowForTrade] = useState(null);

  // Evidence upload form
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidencePreview, setEvidencePreview] = useState('');
  const [transferRef, setTransferRef] = useState('');

  // Load registered user & orders
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('p2p_user_profile');
      if (savedUser) {
        setTraderName(savedUser);
        setIsRegistered(true);
      }
      const savedOrders = localStorage.getItem(STORAGE_KEY);
      if (savedOrders) {
        try {
          setOrders(JSON.parse(savedOrders));
        } catch (e) {
          setOrders([]);
        }
      }
    }
  }, []);

  function saveOrders(updated) {
    setOrders(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  }

  function handleRegister(e) {
    e.preventDefault();
    if (!traderName.trim()) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem('p2p_user_profile', traderName.trim());
    }
    setIsRegistered(true);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      setEvidenceFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEvidencePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }

  // Buyer submits payment evidence
  function handleSubmitEvidence(e) {
    e.preventDefault();
    if (!publicKey || !selectedEscrowForTrade) return;
    if (!evidencePreview && !transferRef) {
      alert('Please upload a payment receipt screenshot or enter a payment reference.');
      return;
    }

    const newOrder = {
      id: `ord_${Date.now()}`,
      createdAt: new Date().toISOString(),
      escrowAddress: selectedEscrowForTrade.address,
      makerAddress: selectedEscrowForTrade.makerAddress,
      buyerAddress: publicKey.toBase58(),
      buyerName: traderName || 'Verified Buyer',
      mintAAddress: selectedEscrowForTrade.mintAAddress,
      mintBAddress: selectedEscrowForTrade.mintBAddress,
      amountA: selectedEscrowForTrade.vaultAmount.toString(),
      amountB: selectedEscrowForTrade.receive.toString(),
      seed: selectedEscrowForTrade.seed,
      seedBigInt: selectedEscrowForTrade.seedBigInt.toString(),
      tokenProgramId: selectedEscrowForTrade.tokenProgramId.toBase58(),
      evidenceUrl: evidencePreview,
      transferRef: transferRef.trim() || 'Bank Wire Reference #98231',
      status: 'evidence_submitted', // 'evidence_submitted' -> 'seller_approved' -> 'completed' (or 'refunded')
    };

    saveOrders([newOrder, ...orders]);
    setSelectedEscrowForTrade(null);
    setEvidenceFile(null);
    setEvidencePreview('');
    setTransferRef('');
    alert('Payment evidence uploaded! Switch to the Seller account to verify and approve the payment.');
  }

  // Seller approves the evidence
  function handleSellerApprovePayment(order) {
    const updated = orders.map((o) =>
      o.id === order.id ? { ...o, status: 'seller_approved', approvedAt: new Date().toISOString() } : o
    );
    saveOrders(updated);
    alert('Payment marked as Verified! The buyer can now claim the blockchain tokens on-chain.');
  }

  // Seller rejects and cancels/refunds the escrow
  async function handleSellerRejectRefund(order) {
    if (!publicKey) {
      alert('Please connect your seller Phantom wallet.');
      return;
    }

    try {
      openTxModal({
        status: 'signing',
        title: 'Reject & Refund Escrow',
        message: 'Payment rejected. Signing transaction in Phantom to cancel escrow and reclaim tokens...',
      });

      const escrowObj = openEscrows.find((e) => e.address === order.escrowAddress);
      if (!escrowObj) {
        throw new Error('Escrow account not found or already closed.');
      }

      const ix = createRefundInstruction({
        maker: publicKey,
        seed: escrowObj.seedBigInt,
        mintA: escrowObj.mintA,
        tokenProgram: escrowObj.tokenProgramId,
      });

      const transaction = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);

      openTxModal({
        status: 'confirming',
        title: 'Refunding Escrow on Devnet',
        message: 'Broadcasting refund transaction...',
        txSignature: signature,
      });

      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

      openTxModal({
        status: 'success',
        title: 'Escrow Refunded & Cancelled',
        message: 'The escrow was cancelled and tokens returned to the seller.',
        txSignature: signature,
      });

      const updated = orders.map((o) =>
        o.id === order.id ? { ...o, status: 'refunded', txSignature: signature } : o
      );
      saveOrders(updated);

      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('P2P Reject Error:', err);
      openTxModal({
        status: 'error',
        title: 'Refund Failed',
        message: parseAnchorError(err),
      });
    }
  }

  // Buyer claims on-chain tokens once approved by seller
  async function handleBuyerClaimTokens(order) {
    if (!publicKey) {
      alert('Please connect your buyer Phantom wallet.');
      return;
    }

    try {
      openTxModal({
        status: 'signing',
        title: 'Claim Escrow Tokens',
        message: 'Seller approved payment! Please sign in Phantom to receive tokens from the custodial vault.',
      });

      const escrowObj = openEscrows.find((e) => e.address === order.escrowAddress);
      if (!escrowObj) {
        throw new Error('Escrow account is no longer open on-chain (it may have been fulfilled or refunded).');
      }

      const ix = createTakeInstruction({
        taker: publicKey,
        maker: escrowObj.maker,
        seed: escrowObj.seedBigInt,
        mintA: escrowObj.mintA,
        mintB: escrowObj.mintB,
        tokenProgram: escrowObj.tokenProgramId,
      });

      const transaction = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);

      openTxModal({
        status: 'confirming',
        title: 'Fulfilling Escrow on Solana Devnet',
        message: 'Releasing tokens from vault to buyer wallet...',
        txSignature: signature,
      });

      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

      openTxModal({
        status: 'success',
        title: 'Tokens Claimed Successfully!',
        message: 'The escrow swap completed on-chain! Tokens are now in your wallet.',
        txSignature: signature,
      });

      const updated = orders.map((o) =>
        o.id === order.id ? { ...o, status: 'completed', txSignature: signature } : o
      );
      saveOrders(updated);

      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Buyer Claim Error:', err);
      openTxModal({
        status: 'error',
        title: 'Claim Failed',
        message: parseAnchorError(err),
      });
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-[#23273a] shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#14F195]/10 text-[#14F195] border border-[#14F195]/20">
                <FileCheck className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">P2P Evidence & Verification Desk</h2>
            </div>
            <p className="text-xs text-gray-400 mt-1 max-w-xl">
              1. Buyer uploads payment proof &nbsp;→&nbsp; 2. Seller verifies receipt &nbsp;→&nbsp; 3. Blockchain escrow releases directly to buyer.
            </p>
          </div>

          {/* Role Switcher */}
          <div className="flex items-center p-1 bg-[#10121a] border border-[#23273a] rounded-xl">
            <button
              onClick={() => setRole('buyer')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
                role === 'buyer' ? 'bg-[#9945FF] text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Buyer Portal
            </button>
            <button
              onClick={() => setRole('seller')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
                role === 'seller' ? 'bg-[#14F195] text-[#0b0c10] shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Seller Portal
            </button>
          </div>
        </div>

        {/* Identity Bar */}
        <div className="mt-5 pt-4 border-t border-[#1b1f30] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#14F195]" />
            <span className="text-gray-300">
              Account: <strong className="text-white font-mono">{traderName || 'Active Trader'}</strong>
            </span>
            {publicKey && (
              <span className="font-mono text-gray-500">
                ({publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)})
              </span>
            )}
          </div>

          {!isRegistered && (
            <form onSubmit={handleRegister} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Set Trader Nickname"
                value={traderName}
                onChange={(e) => setTraderName(e.target.value)}
                className="bg-[#12141f] border border-[#23273a] text-xs px-2.5 py-1.5 rounded-lg text-white"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#9945FF] text-white font-semibold rounded-lg hover:opacity-90"
              >
                Save
              </button>
            </form>
          )}
        </div>
      </div>

      {/* BUYER VIEW */}
      {role === 'buyer' && (
        <div className="space-y-6">
          
          {/* Active Orders Track */}
          {orders.length > 0 && (
            <div className="glass-panel p-5 rounded-2xl border border-[#23273a]">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Buyer Order Tracker
              </h3>
              <div className="space-y-3">
                {orders.map((ord) => {
                  const isReadyToClaim = ord.status === 'seller_approved';

                  return (
                    <div
                      key={ord.id}
                      className="p-4 bg-[#0f111a] border border-[#1e2233] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>Order #{ord.id.slice(-6)}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              ord.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : ord.status === 'seller_approved'
                                ? 'bg-[#14F195]/20 text-[#14F195] border border-[#14F195]/40 animate-pulse'
                                : ord.status === 'refunded'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {ord.status === 'completed'
                              ? 'Escrow Released ✅'
                              : ord.status === 'seller_approved'
                              ? 'Payment Verified by Seller ✅ Ready to Claim!'
                              : ord.status === 'refunded'
                              ? 'Escrow Cancelled / Refunded'
                              : 'Evidence Uploaded — Awaiting Seller Verification'}
                          </span>
                        </div>
                        <p className="text-gray-400 mt-1">Ref: {ord.transferRef}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        {ord.evidenceUrl && (
                          <a
                            href={ord.evidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-gray-300 hover:text-white hover:underline"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#14F195]" />
                            Receipt
                          </a>
                        )}

                        {/* Claim Button for Buyer */}
                        {isReadyToClaim && (
                          <button
                            onClick={() => handleBuyerClaimTokens(ord)}
                            className="px-4 py-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c10] font-bold rounded-xl shadow hover:opacity-95 flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Claim Tokens Now
                          </button>
                        )}

                        {ord.txSignature && (
                          <a
                            href={getExplorerUrl('tx', ord.txSignature)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-purple-400 hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Explorer
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Sellers / Escrows */}
          <div className="glass-panel p-6 rounded-3xl border border-[#23273a]">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-[#9945FF]" />
              Browse Sellers with Active Blockchain Escrows
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Select a seller offer, confirm your transfer, and upload receipt evidence.
            </p>

            {openEscrows.length === 0 ? (
              <div className="p-8 text-center bg-[#0d0e15] rounded-2xl border border-[#1b1f30] text-gray-400 text-xs">
                No active seller escrows found on Devnet. Create an escrow in the "Create Escrow" tab to test this flow!
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {openEscrows.map((escrow) => (
                  <div
                    key={escrow.address}
                    className="p-4 bg-[#0e1017] border border-[#1e2233] hover:border-[#2d3248] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        Seller: <span className="font-mono text-purple-400">{escrow.makerAddress.slice(0, 6)}...{escrow.makerAddress.slice(-4)}</span>
                      </div>
                      <div className="text-gray-400 mt-1">
                        Offering: <span className="text-white font-mono font-bold">{atomicToUi(escrow.vaultAmount, 6)} tokens</span> (Mint: {escrow.mintAAddress.slice(0, 6)}...)
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedEscrowForTrade(escrow)}
                      className="px-4 py-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c10] font-bold rounded-xl hover:opacity-95"
                    >
                      Buy & Upload Evidence
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* EVIDENCE UPLOAD FORM */}
          {selectedEscrowForTrade && (
            <div className="glass-panel p-6 rounded-3xl border border-[#14F195]/40 shadow-2xl relative">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#1f2436]">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#14F195]" />
                  Upload Payment Evidence for Escrow
                </h4>
                <button
                  onClick={() => setSelectedEscrowForTrade(null)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleSubmitEvidence} className="space-y-4">
                <div className="p-3 bg-[#0a0b10] border border-[#1b1e2c] rounded-xl text-xs space-y-1 font-mono text-gray-400">
                  <div>Seller Address: <span className="text-white">{selectedEscrowForTrade.makerAddress}</span></div>
                  <div>Escrow Contract: <span className="text-purple-400">{selectedEscrowForTrade.address}</span></div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">
                    Payment Transfer Reference / Note
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bank Wire Ref #398402, Wise ID, or Revolut payment tag"
                    value={transferRef}
                    onChange={(e) => setTransferRef(e.target.value)}
                    className="w-full bg-[#10121a] border border-[#23273a] text-xs text-white rounded-xl p-3 focus:outline-none focus:border-[#14F195]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">
                    Upload Transfer Proof / Receipt Image
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#9945FF]/20 file:text-purple-300 hover:file:bg-[#9945FF]/30 cursor-pointer"
                  />
                </div>

                {evidencePreview && (
                  <div className="p-3 bg-[#0a0b10] border border-[#1e2233] rounded-xl">
                    <div className="text-[11px] text-gray-400 mb-1 font-semibold">Evidence Preview:</div>
                    <img
                      src={evidencePreview}
                      alt="Proof of payment"
                      className="max-h-48 rounded-lg object-contain border border-[#22273a]"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!publicKey}
                  className="w-full py-3.5 bg-gradient-to-r from-[#14F195] to-[#0eb570] text-[#0b0c10] font-bold text-sm rounded-xl hover:opacity-95 shadow-lg"
                >
                  Submit Payment Evidence to Seller
                </button>
              </form>
            </div>
          )}

        </div>
      )}

      {/* SELLER VIEW */}
      {role === 'seller' && (
        <div className="glass-panel p-6 rounded-3xl border border-[#23273a] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-[#14F195]" />
              Seller Verification Queue
            </h3>
            <span className="text-xs text-gray-400">
              Orders requiring evidence confirmation
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="p-8 text-center bg-[#0d0e15] rounded-2xl border border-[#1b1f30] text-gray-400 text-xs">
              No orders with payment evidence currently awaiting review.
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((ord) => {
                return (
                  <div
                    key={ord.id}
                    className="p-5 bg-[#0f111a] border border-[#23273a] rounded-2xl space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-white">Order {ord.id}</span>
                        <div className="text-gray-400 text-[11px] mt-0.5">
                          Buyer: <span className="text-white font-mono">{ord.buyerAddress}</span> ({ord.buyerName})
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          ord.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : ord.status === 'seller_approved'
                            ? 'bg-[#14F195]/20 text-[#14F195] border border-[#14F195]/40'
                            : ord.status === 'refunded'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse'
                        }`}
                      >
                        {ord.status === 'completed'
                          ? 'Completed & Released ✅'
                          : ord.status === 'seller_approved'
                          ? 'Payment Approved (Awaiting Buyer Claim)'
                          : ord.status === 'refunded'
                          ? 'Escrow Cancelled / Refunded'
                          : 'Action Required: Verify Receipt'}
                      </span>
                    </div>

                    <div className="p-3 bg-[#0a0b10] border border-[#1a1c2b] rounded-xl text-xs space-y-1">
                      <div className="text-gray-300 font-semibold">Payment Reference: {ord.transferRef}</div>
                      <div className="text-gray-400 text-[11px]">Submitted: {new Date(ord.createdAt).toLocaleString()}</div>
                    </div>

                    {ord.evidenceUrl && (
                      <div className="p-3 bg-[#0a0b10] border border-[#1a1c2b] rounded-xl">
                        <div className="text-xs font-bold text-gray-300 mb-2 flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-[#14F195]" />
                          Uploaded Payment Evidence:
                        </div>
                        <a href={ord.evidenceUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={ord.evidenceUrl}
                            alt="Evidence"
                            className="max-h-56 rounded-lg border border-[#24293d] object-contain hover:opacity-90 transition cursor-zoom-in"
                          />
                        </a>
                      </div>
                    )}

                    {ord.status === 'evidence_submitted' && (
                      <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                        <button
                          onClick={() => handleSellerApprovePayment(ord)}
                          className="w-full sm:flex-1 py-3 bg-gradient-to-r from-[#14F195] to-[#0eb570] text-[#0b0c10] font-bold text-xs rounded-xl hover:opacity-95 shadow-md flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve Payment Received
                        </button>

                        <button
                          onClick={() => handleSellerRejectRefund(ord)}
                          className="w-full sm:w-auto py-3 px-4 bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reject & Refund Escrow
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
