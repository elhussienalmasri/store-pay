import React, { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  LAMPORTS_PER_SOL,
  Keypair,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  createInitializeMintInstruction,
  createMintToInstruction,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Droplet,
  ExternalLink,
  Check,
  AlertCircle,
  Copy,
  Coins,
  Sparkles,
  RefreshCw,
  ArrowRightLeft
} from 'lucide-react';
import { DEFAULT_DEVNET_TOKENS } from '../lib/constants';

export function DevnetFaucetHelper() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [isAirdropping, setIsAirdropping] = useState(false);
  const [isWrapping, setIsWrapping] = useState(false);
  const [isMintingTestToken, setIsMintingTestToken] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);
  const [copiedMint, setCopiedMint] = useState(null);
  const [createdTestMint, setCreatedTestMint] = useState(null);

  // 1. Airdrop SOL
  async function handleAirdropSol() {
    if (!publicKey) {
      alert('Please connect your wallet first.');
      return;
    }

    try {
      setIsAirdropping(true);
      setActionStatus({ type: 'loading', message: 'Requesting 1 SOL Devnet airdrop...' });

      const sig = await connection.requestAirdrop(publicKey, 1 * LAMPORTS_PER_SOL);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

      setActionStatus({
        type: 'success',
        message: '1 SOL airdropped to your Devnet wallet successfully!',
      });
    } catch (err) {
      console.warn('Airdrop rate limit:', err);
      setActionStatus({
        type: 'error',
        message: 'Devnet airdrop was rate-limited by Solana faucet. Transfer 0.5 SOL from Account 1, or use https://faucet.solana.com',
      });
    } finally {
      setIsAirdropping(false);
    }
  }

  // 2. Wrap 1 Native SOL into WSOL (SPL Token)
  async function handleWrapSol() {
    if (!publicKey) {
      alert('Please connect your wallet first.');
      return;
    }

    try {
      setIsWrapping(true);
      setActionStatus({ type: 'loading', message: 'Wrapping 1 SOL into WSOL...' });

      const wsolAta = getAssociatedTokenAddressSync(
        NATIVE_MINT,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const transaction = new Transaction();

      // Check if ATA already exists
      const ataInfo = await connection.getAccountInfo(wsolAta);
      if (!ataInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            wsolAta,
            publicKey,
            NATIVE_MINT,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // Transfer 1 SOL to ATA and sync native
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: wsolAta,
          lamports: 1 * LAMPORTS_PER_SOL,
        }),
        createSyncNativeInstruction(wsolAta, TOKEN_PROGRAM_ID)
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const sig = await sendTransaction(transaction, connection);
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

      setActionStatus({
        type: 'success',
        message: 'Successfully wrapped 1 SOL into 1.0 WSOL! You now have WSOL tokens to trade.',
      });
    } catch (err) {
      console.error('Wrap SOL Error:', err);
      setActionStatus({
        type: 'error',
        message: `Failed to wrap SOL: ${err.message || err.toString()}`,
      });
    } finally {
      setIsWrapping(false);
    }
  }

  // 3. Create a Custom Demo SPL Token and Mint 100 to wallet
  async function handleCreateDemoToken() {
    if (!publicKey) {
      alert('Please connect your wallet first.');
      return;
    }

    try {
      setIsMintingTestToken(true);
      setActionStatus({ type: 'loading', message: 'Creating new Devnet token mint and minting 100 tokens to your wallet...' });

      const mintKeypair = Keypair.generate();
      const mintPubkey = mintKeypair.publicKey;
      const decimals = 6;
      const amountToMint = 100n * (10n ** BigInt(decimals)); // 100 tokens

      const userAta = getAssociatedTokenAddressSync(
        mintPubkey,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const rentLamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

      const transaction = new Transaction().add(
        // Create mint account
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintPubkey,
          space: MINT_SIZE,
          lamports: rentLamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        // Initialize mint
        createInitializeMintInstruction(
          mintPubkey,
          decimals,
          publicKey, // mint authority
          publicKey, // freeze authority
          TOKEN_PROGRAM_ID
        ),
        // Create user's ATA
        createAssociatedTokenAccountInstruction(
          publicKey,
          userAta,
          publicKey,
          mintPubkey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        ),
        // Mint 100 tokens
        createMintToInstruction(
          mintPubkey,
          userAta,
          publicKey,
          amountToMint,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Partial sign with mintKeypair
      transaction.partialSign(mintKeypair);

      const sig = await sendTransaction(transaction, connection);
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

      setCreatedTestMint(mintPubkey.toBase58());
      setActionStatus({
        type: 'success',
        message: `Minted 100 Demo Tokens to your wallet! Mint: ${mintPubkey.toBase58()}`,
      });
    } catch (err) {
      console.error('Demo Token Mint Error:', err);
      setActionStatus({
        type: 'error',
        message: `Failed to create demo token: ${err.message || err.toString()}`,
      });
    } finally {
      setIsMintingTestToken(false);
    }
  }

  function handleCopy(mint) {
    navigator.clipboard.writeText(mint);
    setCopiedMint(mint);
    setTimeout(() => setCopiedMint(null), 2000);
  }

  return (
    <div className="w-full max-w-4xl mx-auto glass-panel p-6 rounded-3xl border border-[#23273a] shadow-xl text-xs space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#14F195]" />
            Test Faucet & 1-Click Token Minter
          </h3>
          <p className="text-gray-400 mt-0.5">
            Fund test accounts with Devnet SOL, wrap SOL into WSOL, or mint demo SPL tokens for escrow testing.
          </p>
        </div>

        {/* 1-Click Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Airdrop Button */}
          <button
            onClick={handleAirdropSol}
            disabled={!publicKey || isAirdropping}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1b1f30] hover:bg-[#252a42] text-gray-200 font-semibold rounded-xl active:scale-95 transition disabled:opacity-40 border border-[#2c324c]"
            title="Airdrop 1 Devnet SOL"
          >
            <Droplet className={`w-3.5 h-3.5 text-cyan-400 ${isAirdropping ? 'animate-bounce' : ''}`} />
            {isAirdropping ? 'Airdropping...' : 'Airdrop SOL'}
          </button>

          {/* Wrap SOL Button */}
          <button
            onClick={handleWrapSol}
            disabled={!publicKey || isWrapping}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-semibold rounded-xl active:scale-95 transition disabled:opacity-40 border border-purple-500/30"
            title="Wrap 1 SOL into 1 Wrapped SOL (WSOL) SPL token"
          >
            <ArrowRightLeft className={`w-3.5 h-3.5 ${isWrapping ? 'animate-spin' : ''}`} />
            {isWrapping ? 'Wrapping...' : 'Wrap 1 SOL → WSOL'}
          </button>

          {/* Mint Demo Token */}
          <button
            onClick={handleCreateDemoToken}
            disabled={!publicKey || isMintingTestToken}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c10] font-bold rounded-xl active:scale-95 transition disabled:opacity-40 shadow-sm"
            title="Create a new SPL token and mint 100 to your wallet"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isMintingTestToken ? 'animate-spin' : ''}`} />
            {isMintingTestToken ? 'Minting...' : 'Mint 100 Demo Tokens'}
          </button>
        </div>
      </div>

      {actionStatus && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            actionStatus.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : actionStatus.type === 'loading'
              ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
          }`}
        >
          {actionStatus.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          )}
          <span className="break-all">{actionStatus.message}</span>
        </div>
      )}

      {/* Newly Created Test Token Banner */}
      {createdTestMint && (
        <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-center justify-between gap-2 font-mono">
          <div className="truncate">
            <span className="text-purple-300 font-bold mr-1">New Demo Mint:</span>
            <span className="text-white text-[11px]">{createdTestMint}</span>
          </div>
          <button
            onClick={() => handleCopy(createdTestMint)}
            className="px-2 py-1 bg-purple-500/20 text-purple-200 rounded-lg hover:bg-purple-500/30 flex items-center gap-1 shrink-0"
          >
            {copiedMint === createdTestMint ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            Copy Mint
          </button>
        </div>
      )}

      {/* Preset Token Addresses for testing */}
      <div className="pt-2">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">
          Verified Devnet Token Mints:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
          {DEFAULT_DEVNET_TOKENS.map((token) => (
            <div
              key={token.mint}
              className="p-2.5 bg-[#0e1017] border border-[#1e2233] rounded-xl flex items-center justify-between gap-2"
            >
              <div>
                <span className="font-bold text-white mr-1.5">{token.logo} {token.symbol}</span>
                <span className="text-gray-400 text-[10px] block">{token.mint.slice(0, 6)}...{token.mint.slice(-6)}</span>
              </div>
              <button
                onClick={() => handleCopy(token.mint)}
                className="p-1.5 rounded-lg bg-[#181b28] hover:bg-[#222638] text-gray-400 hover:text-white transition"
                title="Copy mint address"
              >
                {copiedMint === token.mint ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
