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
  Sparkles,
  Tag,
  Landmark,
  Plus,
  Trash2,
  Copy,
  Check
} from 'lucide-react';
import { atomicToUi, getMintDetails, getWalletSolBalance, getWalletTokenBalance, uiToAtomic } from '../lib/tokens';
import { getExplorerUrl, DEFAULT_DEVNET_TOKENS, WSOL_MINT } from '../lib/constants';
import { buildSolWrapInstructions, createMakeInstruction, createTakeInstruction, createTakeSameMintInstruction, createRefundInstruction, isSolMint, parseAnchorError, withDeadline, waitConfirmed } from '../lib/escrowProgram';
import { PAYOUT_LIMITS, PAYOUT_METHOD_KINDS, LISTING_DOMAIN, buildPayoutMessage, normalizePayoutProfile, sha256HexOf } from '../lib/payoutCore.mjs';

const STORAGE_KEY = 'solana_p2p_orders_v1';

function offerSymbol(mintAddress, fallback = 'Token') {
  return DEFAULT_DEVNET_TOKENS.find((token) => token.mint === mintAddress)?.symbol || fallback;
}

export function P2PEscrowPortal({ openEscrows, openTxModal, onRefresh }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signMessage } = useWallet();

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

  // Create offer form (the seller's escrow that shows up in the buyers' browse list)
  const [offerMintA, setOfferMintA] = useState(DEFAULT_DEVNET_TOKENS[0].mint);
  const [offerCustomA, setOfferCustomA] = useState('');
  const [offerAmountA, setOfferAmountA] = useState('');
  const [offerDetailsA, setOfferDetailsA] = useState(null);
  const [offerBalanceA, setOfferBalanceA] = useState('0');
  const [offerMintB, setOfferMintB] = useState(DEFAULT_DEVNET_TOKENS[1].mint);
  const [offerCustomB, setOfferCustomB] = useState('');
  const [offerAmountB, setOfferAmountB] = useState('');
  const [offerDetailsB, setOfferDetailsB] = useState(null);
  const [isCreatingOffer, setIsCreatingOffer] = useState(false);
  const [offerSettlement, setOfferSettlement] = useState('crypto');
  const [listings, setListings] = useState([]);

  const isOffChainOffer = offerSettlement === 'offchain';

  const activeOfferA = offerMintA === 'custom' ? offerCustomA.trim() : offerMintA;
  const activeOfferB = offerMintB === 'custom' ? offerCustomB.trim() : offerMintB;

  useEffect(() => {
    let isCancelled = false;

    async function loadOfferMints() {
      setOfferDetailsA(null);
      setOfferDetailsB(null);
      setOfferBalanceA('0');
      if (!publicKey || !activeOfferA || !activeOfferB) return;

      const [detailsA, detailsB] = await Promise.all([
        getMintDetails(connection, activeOfferA).catch(() => null),
        getMintDetails(connection, activeOfferB).catch(() => null),
      ]);

      let balance = '0';
      if (detailsA) {
        balance = isSolMint(detailsA.mint)
          ? (await getWalletSolBalance(connection, publicKey)).uiAmount
          : (await getWalletTokenBalance(connection, publicKey, detailsA.mint, detailsA.programId)).uiAmount;
      }

      if (!isCancelled) {
        setOfferDetailsA(detailsA);
        setOfferDetailsB(detailsB);
        setOfferBalanceA(balance);
      }
    }

    loadOfferMints();
    return () => { isCancelled = true; };
  }, [activeOfferA, activeOfferB, publicKey, connection]);

  // Payout details: where the buyer sends the off-chain money behind this seller's offers
  const [payoutName, setPayoutName] = useState('');
  const [payoutMethods, setPayoutMethods] = useState([{ kind: 'bank', value: '', note: '' }]);
  const [payoutInstructions, setPayoutInstructions] = useState('');
  const [savedPayout, setSavedPayout] = useState(null);
  const [isSavingPayout, setIsSavingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState('');
  const [copiedPayout, setCopiedPayout] = useState('');
  const [sellerPayout, setSellerPayout] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadOwnPayout() {
      setSavedPayout(null);
      setPayoutName('');
      setPayoutMethods([{ kind: 'bank', value: '', note: '' }]);
      setPayoutInstructions('');
      if (!publicKey) return;

      try {
        const res = await fetch(`/api/v1/p2p/payouts?wallet=${publicKey.toBase58()}`);
        const data = await res.json();
        if (isCancelled || !res.ok || !data.profile) return;
        setSavedPayout(data);
        setPayoutName(data.profile.displayName || '');
        setPayoutMethods(data.profile.methods.map((m) => ({ kind: m.kind, value: m.value, note: m.note || '' })));
        setPayoutInstructions(data.profile.instructions || '');
      } catch (err) {
        // If the lookup fails the panel simply shows the details as not saved yet.
      }
    }

    loadOwnPayout();
    return () => { isCancelled = true; };
  }, [publicKey]);

  useEffect(() => {
    let isCancelled = false;

    async function loadSellerPayout() {
      setSellerPayout(null);
      const maker = selectedEscrowForTrade?.makerAddress;
      if (!maker) return;
      try {
        const res = await fetch(`/api/v1/p2p/payouts?wallet=${maker}`);
        const data = await res.json();
        if (!isCancelled && res.ok) setSellerPayout(data);
      } catch (err) {
        if (!isCancelled) setSellerPayout(null);
      }
    }

    loadSellerPayout();
    return () => { isCancelled = true; };
  }, [selectedEscrowForTrade]);

  async function loadListings() {
    try {
      const res = await fetch('/api/v1/p2p/listings');
      const data = await res.json();
      if (res.ok) setListings(data.listings || []);
    } catch (err) {
      setListings([]);
    }
  }

  useEffect(() => {
    loadListings();
  }, []);

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

    const baseOrder = {
      id: `ord_${Date.now()}`,
      createdAt: new Date().toISOString(),
      makerAddress: selectedEscrowForTrade.makerAddress,
      buyerAddress: publicKey.toBase58(),
      buyerName: traderName || 'Verified Buyer',
      evidenceUrl: evidencePreview,
      transferRef: transferRef.trim() || 'Reference not provided',
      status: 'evidence_submitted', // 'evidence_submitted' -> 'seller_approved' -> 'completed' (or 'refunded')
    };

    const newOrder = selectedEscrowForTrade.offchain
      ? {
          ...baseOrder,
          offchain: true,
          escrowAddress: null,
          listingId: selectedEscrowForTrade.listingId,
          offeredLabel: selectedEscrowForTrade.offeredLabel,
        }
      : {
          ...baseOrder,
          escrowAddress: selectedEscrowForTrade.address,
          mintAAddress: selectedEscrowForTrade.mintAAddress,
          mintBAddress: selectedEscrowForTrade.mintBAddress,
          amountA: selectedEscrowForTrade.vaultAmount.toString(),
          amountB: selectedEscrowForTrade.receive.toString(),
          seed: selectedEscrowForTrade.seed,
          seedBigInt: selectedEscrowForTrade.seedBigInt.toString(),
          tokenProgramId: selectedEscrowForTrade.tokenProgramId.toBase58(),
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
    alert(
      order.offchain
        ? 'Payment marked as Verified! Send the offered tokens from your wallet to the buyer.'
        : 'Payment marked as Verified! The buyer can now claim the blockchain tokens on-chain.'
    );
  }

  // Seller rejects and cancels/refunds the escrow
  async function handleSellerRejectRefund(order) {
    if (order.offchain) {
      saveOrders(orders.map((o) => (o.id === order.id ? { ...o, status: 'refunded' } : o)));
      alert('Payment marked as not received. Nothing was sent to the buyer.');
      return;
    }

    if (!publicKey) {
      alert('Please connect your seller wallet.');
      return;
    }

    try {
      openTxModal({
        status: 'signing',
        title: 'Reject & Refund Escrow',
        message: 'Payment rejected. Approving the transaction in your wallet to cancel escrow and reclaim tokens...',
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
      alert('Please connect your buyer wallet.');
      return;
    }

    try {
      openTxModal({
        status: 'signing',
        title: 'Claim Escrow Tokens',
        message: 'Seller approved payment! Please approve in your wallet to receive tokens from the custodial vault.',
      });

      const escrowObj = openEscrows.find((e) => e.address === order.escrowAddress);
      if (!escrowObj) {
        throw new Error('Escrow account is no longer open on-chain (it may have been fulfilled or refunded).');
      }

      const ix = escrowObj.mintA.equals(escrowObj.mintB)
        ? createTakeSameMintInstruction({
            taker: publicKey,
            maker: escrowObj.maker,
            seed: escrowObj.seedBigInt,
            mint: escrowObj.mintA,
            tokenProgram: escrowObj.tokenProgramId,
          })
        : createTakeInstruction({
            taker: publicKey,
            maker: escrowObj.maker,
            seed: escrowObj.seedBigInt,
            mintA: escrowObj.mintA,
            mintB: escrowObj.mintB,
            tokenProgram: escrowObj.tokenProgramId,
          });

      // Paying in SOL means wrapping it first; both happen in this one transaction.
      const paysInSol = !escrowObj.mintA.equals(escrowObj.mintB) && isSolMint(escrowObj.mintB);
      const wrap = paysInSol
        ? buildSolWrapInstructions({
            wallet: publicKey,
            amountAtomic: escrowObj.receive,
            tokenProgram: escrowObj.tokenProgramId,
          })
        : null;

      const transaction = wrap
        ? new Transaction().add(...wrap.instructions, ix)
        : new Transaction().add(ix);
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

  // Seller posts a new offer: either locks the offered tokens in a vault, or lists them for an off-chain payment
  async function handleCreateOffer(e) {
    e.preventDefault();
    if (!publicKey) {
      alert('Please connect your wallet first.');
      return;
    }

    if (!activeOfferA) {
      alert('Choose the token you offer.');
      return;
    }

    if (!offerDetailsA) {
      alert(`The offered token ${activeOfferA} does not exist on Devnet, so it cannot be priced. Pick another token or use a mint that exists on Devnet.`);
      return;
    }

    const depositAtomic = uiToAtomic(offerAmountA, offerDetailsA.decimals);
    if (depositAtomic <= 0n) {
      alert('The amount you offer must be greater than zero.');
      return;
    }

    if (Number(offerAmountA) > Number(offerBalanceA)) {
      alert(`You only hold ${offerBalanceA} of the offered token.`);
      return;
    }

    if (isOffChainOffer) {
      await postOffChainOffer();
      return;
    }

    if (!activeOfferB) {
      alert('Choose the token you want.');
      return;
    }

    if (activeOfferA === activeOfferB) {
      alert('Offered and requested tokens must be different.');
      return;
    }

    if (!offerDetailsB) {
      alert(`The requested token ${activeOfferB} does not exist on Devnet, so it cannot be priced. Pick another token or use a mint that exists on Devnet.`);
      return;
    }

    if (!offerDetailsA.programId.equals(offerDetailsB.programId)) {
      alert('The offered and requested tokens must belong to the same token program.');
      return;
    }

    const receiveAtomic = uiToAtomic(offerAmountB, offerDetailsB.decimals);
    if (receiveAtomic <= 0n) {
      alert('The amount you want to receive must be greater than zero.');
      return;
    }

    const seed = Math.floor(Math.random() * 10000000).toString();

    try {
      setIsCreatingOffer(true);

      try {
        setIsSavingPayout(true);
        setPayoutError('');
        await publishPayoutForOffer();
      } catch (payoutErr) {
        setPayoutError(payoutErr.message);
        return;
      } finally {
        setIsSavingPayout(false);
      }

      const isSolOffer = isSolMint(offerDetailsA.mint);
      openTxModal({
        status: 'signing',
        title: 'Approve Offer Creation',
        message: isSolOffer
          ? `Please approve the transaction in your wallet. It wraps ${offerAmountA} SOL and locks it in the escrow vault in one step.`
          : `Please approve the transaction in your wallet to lock ${offerAmountA} tokens in the escrow vault.`,
      });

      const ix = createMakeInstruction({
        maker: publicKey,
        seed: BigInt(seed),
        depositAmount: depositAtomic,
        receiveAmount: receiveAtomic,
        mintA: offerDetailsA.mint,
        mintB: offerDetailsB.mint,
        tokenProgram: offerDetailsA.programId,
      });

      const wrap = isSolOffer
        ? buildSolWrapInstructions({ wallet: publicKey, amountAtomic: depositAtomic, tokenProgram: offerDetailsA.programId })
        : null;

      const transaction = wrap
        ? new Transaction().add(...wrap.instructions, ix)
        : new Transaction().add(ix);
      const { blockhash } = await withDeadline(
        connection.getLatestBlockhash('confirmed'),
        'The blockhash request'
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);

      openTxModal({
        status: 'confirming',
        title: 'Confirming Offer on Devnet',
        message: 'Broadcasting the offer...',
        txSignature: signature,
      });

      await waitConfirmed(connection, signature);

      openTxModal({
        status: 'success',
        title: 'Offer Is Live',
        message: `Buyers now see your ${offerAmountA} offer in the P2P Desk and you are asking for ${offerAmountB} in return.`,
        txSignature: signature,
      });

      setOfferAmountA('');
      setOfferAmountB('');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Create Offer Error:', err);
      openTxModal({
        status: 'error',
        title: 'Failed to Post Offer',
        message: parseAnchorError(err),
      });
    } finally {
      setIsCreatingOffer(false);
    }
  }

  function updatePayoutMethod(index, patch) {
    setPayoutMethods((prev) => prev.map((method, i) => (i === index ? { ...method, ...patch } : method)));
  }

  function addPayoutMethod() {
    setPayoutMethods((prev) =>
      prev.length >= PAYOUT_LIMITS.methods ? prev : [...prev, { kind: 'other', value: '', note: '' }]
    );
  }

  function removePayoutMethod(index) {
    setPayoutMethods((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  // The wallet signs the exact text the route re-reads, so only this seller can publish or clear these details.
  async function signAndSendPayout(profileJson) {
    const wallet = publicKey.toBase58();
    const detailsHash = await sha256HexOf(profileJson);
    const message = buildPayoutMessage({ wallet, updatedAt: new Date().toISOString(), detailsHash });
    const signature = await signMessage(new TextEncoder().encode(message));

    const res = await fetch('/api/v1/p2p/payouts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, message, signature: Array.from(signature), profileJson }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save the payout details.');
    return data;
  }

  function applySavedPayout(data) {
    setSavedPayout(data?.profile ? data : null);
    setPayoutName(data?.profile?.displayName || '');
    setPayoutMethods(
      data?.profile?.methods
        ? data.profile.methods.map((method) => ({ kind: method.kind, value: method.value, note: method.note || '' }))
        : [{ kind: 'bank', value: '', note: '' }]
    );
    setPayoutInstructions(data?.profile?.instructions || '');
  }

  // Posting an offer also publishes these details, so the buyer sees them straight away.
  async function publishPayoutForOffer() {
    const methods = payoutMethods
      .map((method) => ({ kind: method.kind, value: method.value.trim(), note: method.note.trim() }))
      .filter((method) => method.value);

    if (!methods.length) return false;

    if (!signMessage) {
      throw new Error('This wallet cannot sign messages, so payout details cannot be published. Try another wallet.');
    }

    const profile = normalizePayoutProfile({
      displayName: payoutName.trim(),
      methods,
      instructions: payoutInstructions.trim(),
    });
    const profileJson = JSON.stringify(profile);

    if (savedPayout && JSON.stringify(savedPayout.profile) === profileJson) return false;

    applySavedPayout(await signAndSendPayout(profileJson));
    return true;
  }

  // The wallet signs the exact listing text the route re-reads, so only this seller can publish or withdraw it.
  async function signAndSendListing(listingJson) {
    const wallet = publicKey.toBase58();
    const detailsHash = await sha256HexOf(listingJson);
    const message = buildPayoutMessage({
      wallet,
      updatedAt: new Date().toISOString(),
      detailsHash,
      domain: LISTING_DOMAIN,
    });
    const signature = await signMessage(new TextEncoder().encode(message));

    const res = await fetch('/api/v1/p2p/listings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, message, signature: Array.from(signature), listingJson }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not publish the offer.');
    return data;
  }

  // No vault: the seller signs the token they sell plus their payout details, and settles by sending the tokens later.
  async function postOffChainOffer() {
    const methods = payoutMethods
      .map((method) => ({ kind: method.kind, value: method.value.trim(), note: method.note.trim() }))
      .filter((method) => method.value);

    if (!methods.length) {
      setPayoutError('Add at least one way for the buyer to pay you.');
      return;
    }

    if (!signMessage) {
      setPayoutError('This wallet cannot sign messages, so offers cannot be published. Try another wallet.');
      return;
    }

    try {
      setIsCreatingOffer(true);
      setIsSavingPayout(true);
      setPayoutError('');

      const listing = {
        id: `off_${Date.now()}`,
        mint: offerDetailsA.mint.toBase58(),
        symbol: offerSymbol(activeOfferA),
        amount: String(offerAmountA),
        decimals: offerDetailsA.decimals,
        payout: normalizePayoutProfile({
          displayName: payoutName.trim(),
          methods,
          instructions: payoutInstructions.trim(),
        }),
      };

      await signAndSendListing(JSON.stringify(listing));
      await loadListings();

      setOfferAmountA('');
      openTxModal({
        status: 'success',
        title: 'Offer Is Live',
        message: `Buyers now see your ${listing.amount} ${listing.symbol} offer in the P2P Desk. They pay you with the details you added, and you send the tokens once you approve their receipt.`,
      });
    } catch (err) {
      console.error('Create Off-Chain Offer Error:', err);
      setPayoutError(err.message);
    } finally {
      setIsSavingPayout(false);
      setIsCreatingOffer(false);
    }
  }

  async function handleWithdrawListing(listingId) {
    if (!publicKey || !signMessage) {
      alert('Connect the wallet that published this offer to withdraw it.');
      return;
    }
    if (!confirm('Withdraw this offer? Buyers will no longer see it.')) return;

    try {
      setIsSavingPayout(true);
      setPayoutError('');
      await signAndSendListing(JSON.stringify({ removed: true, id: listingId }));
      await loadListings();
    } catch (err) {
      console.error('Withdraw Offer Error:', err);
      setPayoutError(err.message);
    } finally {
      setIsSavingPayout(false);
    }
  }

  function listingToTrade(record) {
    return {
      address: record.id,
      listingId: record.id,
      makerAddress: record.wallet,
      offchain: true,
      mintAAddress: record.listing.mint,
      offeredLabel: `${record.listing.amount} ${offerSymbol(record.listing.mint, record.listing.symbol)}`,
      payout: record.listing.payout,
    };
  }

  async function handleRemovePayout() {
    if (!publicKey || !signMessage) {
      alert('Connect the wallet that published these details to remove them.');
      return;
    }
    if (!confirm('Remove your payout details? Buyers will no longer see where to send the payment.')) return;

    try {
      setIsSavingPayout(true);
      setPayoutError('');
      applySavedPayout(await signAndSendPayout(JSON.stringify({ removed: true })));
      setSavedPayout(null);
    } catch (err) {
      console.error('Remove Payout Error:', err);
      setPayoutError(err.message);
    } finally {
      setIsSavingPayout(false);
    }
  }

  function handleCopyPayout(text) {
    navigator.clipboard.writeText(text);
    setCopiedPayout(text);
    setTimeout(() => setCopiedPayout(''), 2000);
  }

  const connectedWallet = publicKey ? publicKey.toBase58() : '';
  const ownListings = listings.filter((record) => record.wallet === connectedWallet);
  const payoutMethodsFilled = payoutMethods.some((method) => method.value.trim());
  const activeTradePayout = selectedEscrowForTrade?.offchain
    ? { profile: selectedEscrowForTrade.payout }
    : sellerPayout;

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
                  const isReadyToClaim = ord.status === 'seller_approved' && !ord.offchain;

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
                              ? ord.offchain
                                ? 'Payment Verified by Seller ✅ Tokens on the way'
                                : 'Payment Verified by Seller ✅ Ready to Claim!'
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
                        Offering: <span className="text-white font-mono font-bold">{atomicToUi(escrow.vaultAmount, escrow.vaultDecimals ?? 6)} tokens</span> (Mint: {escrow.mintAAddress.slice(0, 6)}...)
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

          {/* OFF-CHAIN LISTINGS */}
          {listings.length > 0 && (
            <div className="glass-panel p-6 rounded-3xl border border-[#23273a]">
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#9945FF]" />
                Sellers Taking a Bank or App Transfer
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                These offers hold nothing in a vault. You pay with the seller's details, the seller approves your receipt, then sends the tokens from their own wallet.
              </p>

              <div className="grid grid-cols-1 gap-3">
                {listings.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 bg-[#0e1017] border border-[#1e2233] hover:border-[#2d3248] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        Seller: <span className="font-mono text-purple-400">{record.wallet.slice(0, 6)}...{record.wallet.slice(-4)}</span>
                        {record.wallet === connectedWallet && (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-[#9945FF]/20 text-purple-300 border border-[#9945FF]/40 text-[10px] font-semibold">
                            Your offer
                          </span>
                        )}
                      </div>
                      <div className="text-gray-400 mt-1">
                        Selling: <span className="text-white font-mono font-bold">{record.listing.amount} {offerSymbol(record.listing.mint, record.listing.symbol)}</span>
                      </div>
                      {record.listing.note && <div className="text-gray-400 mt-1">{record.listing.note}</div>}
                    </div>

                    <button
                      onClick={() => setSelectedEscrowForTrade(listingToTrade(record))}
                      className="px-4 py-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c10] font-bold rounded-xl hover:opacity-95"
                    >
                      Pay & Upload Evidence
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EVIDENCE UPLOAD FORM */}
          {selectedEscrowForTrade && (
            <div className="glass-panel p-6 rounded-3xl border border-[#14F195]/40 shadow-2xl relative">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#1f2436]">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#14F195]" />
                  {selectedEscrowForTrade.offchain
                    ? 'Upload Payment Evidence for this Offer'
                    : 'Upload Payment Evidence for Escrow'}
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
                  {selectedEscrowForTrade.offchain ? (
                    <>
                      <div>You receive: <span className="text-white">{selectedEscrowForTrade.offeredLabel}</span></div>
                      <div>The seller sends these from their own wallet once they verify your payment.</div>
                    </>
                  ) : (
                    <div>Escrow Contract: <span className="text-purple-400">{selectedEscrowForTrade.address}</span></div>
                  )}
                </div>

                {/* SELLER PAYOUT DETAILS */}
                <div
                  className={`p-3 rounded-xl border text-xs space-y-2 ${
                    activeTradePayout?.profile
                      ? 'bg-[#0a0b10] border-[#14F195]/30'
                      : 'bg-amber-500/10 border-amber-500/30'
                  }`}
                >
                  {activeTradePayout?.profile ? (
                    <>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <Landmark className="w-4 h-4 text-[#14F195]" />
                        Send your payment to{activeTradePayout.profile.displayName ? ` ${activeTradePayout.profile.displayName}` : ''}
                      </div>

                      <div className="space-y-1.5">
                        {activeTradePayout.profile.methods.map((method) => (
                          <div
                            key={method.value}
                            className="p-2.5 bg-[#0f111a] border border-[#1e2233] rounded-lg flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-[10px] uppercase tracking-wider text-gray-500">{method.label}</div>
                              <div className="font-mono text-white break-all">{method.value}</div>
                              {method.note && <div className="text-gray-400 text-[11px] mt-0.5">{method.note}</div>}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyPayout(method.value)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#181b28] hover:bg-[#222638] text-gray-300 hover:text-white shrink-0"
                              title="Copy payment details"
                            >
                              {copiedPayout === method.value ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              Copy
                            </button>
                          </div>
                        ))}
                      </div>

                      {activeTradePayout.profile.instructions && (
                        <div className="text-gray-300 leading-relaxed pt-2 border-t border-[#1b1f30]">
                          {activeTradePayout.profile.instructions}
                        </div>
                      )}

                      <div className="text-[11px] text-gray-500 pt-1">
                        These details were signed by the seller wallet shown above.
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start gap-2 text-amber-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        This seller has not published payout details yet. Do not transfer anything until they add
                        them in the Seller Portal.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">
                    Payment Transfer Reference / Note
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Reference or transaction ID for the transfer"
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
        <div className="space-y-6">

          {/* POST OFFER */}
          <div className="glass-panel p-6 rounded-3xl border border-[#23273a] space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Tag className="w-5 h-5 text-[#9945FF]" />
                  Post a P2P Offer
                </h3>
                <p className="text-xs text-gray-400 mt-1 max-w-xl">
                  {isOffChainOffer
                    ? 'Lists the tokens you sell against the payment details you add. Nothing reaches the buyer until you approve their payment evidence.'
                    : 'Locks the tokens you offer in a vault and lists them for buyers. Nothing reaches you until you approve their payment evidence.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateOffer} className="space-y-3">
              <div className="p-4 bg-[#0e1017] border border-[#1e2233] rounded-2xl space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">You offer</span>
                    {publicKey && (
                      <span className="text-[11px] font-mono text-gray-400">Balance: {offerBalanceA}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={offerMintA}
                      onChange={(e) => setOfferMintA(e.target.value)}
                      className="bg-[#161825] border border-[#272b40] text-white text-xs font-semibold rounded-xl p-3 focus:outline-none focus:border-[#9945FF]"
                    >
                      {DEFAULT_DEVNET_TOKENS.map((t) => (
                        <option key={t.mint} value={t.mint}>
                          {t.logo} {t.symbol}
                        </option>
                      ))}
                      <option value="custom">⚙️ Custom Mint...</option>
                    </select>

                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder={isOffChainOffer ? 'Amount you sell' : 'Amount to lock'}
                      value={offerAmountA}
                      onChange={(e) => setOfferAmountA(e.target.value)}
                      required
                      className="bg-[#161825] border border-[#272b40] text-white text-sm font-mono font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-[#9945FF]"
                    />
                  </div>

                  {offerMintA === 'custom' && (
                    <input
                      type="text"
                      placeholder="Mint address of the token you offer"
                      value={offerCustomA}
                      onChange={(e) => setOfferCustomA(e.target.value)}
                      className="w-full bg-[#161825] border border-[#272b40] text-white text-xs font-mono rounded-xl p-2.5 focus:outline-none focus:border-[#9945FF]"
                    />
                  )}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono">
                    {offerDetailsA && <span className="text-gray-400">Decimals: {offerDetailsA.decimals}</span>}
                    {offerMintA === WSOL_MINT &&
                      (isOffChainOffer ? (
                        <span className="text-gray-400">You send this SOL yourself after approving the buyer's receipt.</span>
                      ) : Number(offerBalanceA) === 0 ? (
                        <span className="text-amber-300">No SOL available in this wallet. Airdrop devnet SOL first.</span>
                      ) : (
                        <span className="text-gray-400">Taken from your SOL balance and wrapped into the vault in the same transaction.</span>
                      ))}
                  </div>
                </div>

                <div className="border-t border-[#1b1f30]" />

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#14F195]">You want</span>

                    <div className="flex items-center p-1 bg-[#10121a] border border-[#23273a] rounded-xl">
                      <button
                        type="button"
                        onClick={() => setOfferSettlement('crypto')}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition ${
                          !isOffChainOffer ? 'bg-[#14F195] text-[#0b0c10] shadow' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Crypto token
                      </button>
                      <button
                        type="button"
                        onClick={() => setOfferSettlement('offchain')}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition ${
                          isOffChainOffer ? 'bg-[#14F195] text-[#0b0c10] shadow' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Bank / app transfer
                      </button>
                    </div>
                  </div>

                  {isOffChainOffer ? (
                    <p className="text-xs text-gray-400">
                      Nothing is locked in a vault. The buyer pays you outside the blockchain, then you send the tokens you offer from your own wallet once you approve their receipt. Fill the payment details below — they are part of this offer.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={offerMintB}
                          onChange={(e) => setOfferMintB(e.target.value)}
                          className="bg-[#161825] border border-[#272b40] text-white text-xs font-semibold rounded-xl p-3 focus:outline-none focus:border-[#14F195]"
                        >
                          {DEFAULT_DEVNET_TOKENS.map((t) => (
                            <option key={t.mint} value={t.mint}>
                              {t.logo} {t.symbol}
                            </option>
                          ))}
                          <option value="custom">⚙️ Custom Mint...</option>
                        </select>

                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Amount to receive"
                          value={offerAmountB}
                          onChange={(e) => setOfferAmountB(e.target.value)}
                          required
                          className="bg-[#161825] border border-[#272b40] text-white text-sm font-mono font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-[#14F195]"
                        />
                      </div>

                      {offerMintB === 'custom' && (
                        <input
                          type="text"
                          placeholder="Mint address of the token you want"
                          value={offerCustomB}
                          onChange={(e) => setOfferCustomB(e.target.value)}
                          className="w-full bg-[#161825] border border-[#272b40] text-white text-xs font-mono rounded-xl p-2.5 focus:outline-none focus:border-[#14F195]"
                        />
                      )}

                      {offerDetailsB && (
                        <div className="text-[11px] text-gray-400 font-mono">Decimals: {offerDetailsB.decimals}</div>
                      )}
                    </>
                  )}
                </div>
              </div>

            <div className="pt-4 border-t border-[#1f2436] flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-[#14F195]" />
                  How the buyer pays you
                </h4>
                <p className="text-xs text-gray-400 mt-1 max-w-xl">
                  {isOffChainOffer
                    ? 'Bank, wallet app or anything else. Signed into this offer, so the buyer sees it before they pay.'
                    : 'Bank, wallet app, crypto address or anything else. Published with the offer, against your wallet, so it shows on every offer you post.'}
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${
                  (isOffChainOffer ? payoutMethodsFilled : savedPayout)
                    ? 'bg-[#14F195]/20 text-[#14F195] border border-[#14F195]/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {isOffChainOffer
                  ? payoutMethodsFilled
                    ? 'In this offer'
                    : 'Required'
                  : savedPayout
                  ? 'Published'
                  : 'Not published'}
              </span>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Name the buyer should pay to (optional)"
                value={payoutName}
                onChange={(e) => setPayoutName(e.target.value)}
                maxLength={PAYOUT_LIMITS.displayName}
                className="w-full bg-[#161825] border border-[#272b40] text-white text-xs rounded-xl p-3 focus:outline-none focus:border-[#14F195]"
              />

              <div className="space-y-2">
                {payoutMethods.map((method, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-[9rem_1fr_1fr_auto] gap-2 items-center">
                    <select
                      value={method.kind}
                      onChange={(e) => updatePayoutMethod(index, { kind: e.target.value })}
                      className="bg-[#161825] border border-[#272b40] text-white text-xs font-semibold rounded-xl p-3 focus:outline-none focus:border-[#14F195]"
                    >
                      {PAYOUT_METHOD_KINDS.map((entry) => (
                        <option key={entry.kind} value={entry.kind}>
                          {entry.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Account, wallet or address details"
                      value={method.value}
                      onChange={(e) => updatePayoutMethod(index, { value: e.target.value })}
                      maxLength={PAYOUT_LIMITS.value}
                      className="bg-[#161825] border border-[#272b40] text-white text-xs font-mono rounded-xl p-3 focus:outline-none focus:border-[#14F195]"
                    />

                    <input
                      type="text"
                      placeholder="Note for the buyer (optional)"
                      value={method.note}
                      onChange={(e) => updatePayoutMethod(index, { note: e.target.value })}
                      maxLength={PAYOUT_LIMITS.note}
                      className="bg-[#161825] border border-[#272b40] text-white text-xs rounded-xl p-3 focus:outline-none focus:border-[#272b40]"
                    />

                    <button
                      type="button"
                      onClick={() => removePayoutMethod(index)}
                      disabled={payoutMethods.length === 1}
                      title="Remove this payment method"
                      className="p-2.5 rounded-xl bg-[#161825] border border-[#272b40] text-gray-400 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-gray-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addPayoutMethod}
                  disabled={payoutMethods.length >= PAYOUT_LIMITS.methods}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-300 hover:text-purple-200 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add another way to pay
                </button>
              </div>

              <textarea
                placeholder="Anything the buyer needs to know before transferring (optional)"
                value={payoutInstructions}
                onChange={(e) => setPayoutInstructions(e.target.value)}
                rows={3}
                maxLength={PAYOUT_LIMITS.instructions}
                className="w-full bg-[#161825] border border-[#272b40] text-white text-xs rounded-xl p-3 focus:outline-none focus:border-[#14F195] resize-y"
              />

              {payoutError && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{payoutError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!publicKey || isCreatingOffer}
                className="w-full py-3 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c10] font-bold text-sm rounded-xl hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
              >
                {!publicKey
                  ? 'Connect your wallet to post an offer'
                  : isCreatingOffer
                  ? isSavingPayout
                  ? isOffChainOffer
                    ? 'Publishing offer...'
                    : 'Publishing payout details...'
                  : 'Posting Offer...'
                  : isOffChainOffer
                  ? 'Publish Offer & Payment Details'
                  : 'Post Offer & Publish Payout Details'}
              </button>

              {isOffChainOffer ? (
                ownListings.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-[#1f2436]">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Your live offers</div>
                    {ownListings.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between gap-2 p-2.5 bg-[#0f111a] border border-[#1e2233] rounded-xl text-xs"
                      >
                        <div className="min-w-0">
                          <span className="text-white font-mono font-bold">
                            {record.listing.amount} {offerSymbol(record.listing.mint, record.listing.symbol)}
                          </span>
                          <span className="text-gray-500 ml-2">{new Date(record.createdAt).toLocaleString()}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleWithdrawListing(record.id)}
                          disabled={isSavingPayout}
                          className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 disabled:opacity-40"
                        >
                          Withdraw
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {savedPayout?.updatedAt && (
                    <p className="text-[11px] text-gray-500">
                      Last saved {new Date(savedPayout.updatedAt).toLocaleString()}
                    </p>
                  )}

                  {savedPayout && (
                    <button
                      type="button"
                      onClick={handleRemovePayout}
                      disabled={isCreatingOffer}
                      className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 disabled:opacity-40"
                    >
                      Remove payout details
                    </button>
                  )}
                </div>
              )}
            </div>
            </form>
          </div>

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
                            ? ord.offchain
                              ? 'Payment Approved (Send the Tokens Now)'
                              : 'Payment Approved (Awaiting Buyer Claim)'
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
                            {ord.offchain ? 'Mark Payment Not Received' : 'Reject & Refund Escrow'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
