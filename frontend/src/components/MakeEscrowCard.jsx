import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { ArrowDown, AlertTriangle, Shield, Check, Info, Sparkles, RefreshCw } from 'lucide-react';
import { DEFAULT_DEVNET_TOKENS, ERROR_MESSAGES } from '../lib/constants';
import { getMintDetails, getWalletTokenBalance, uiToAtomic, atomicToUi } from '../lib/tokens';
import { createMakeInstruction, deriveEscrowPda, deriveVaultAta, parseAnchorError } from '../lib/escrowProgram';

export function MakeEscrowCard({ onEscrowCreated, openTxModal }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  // Selected Token A (Offered)
  const [selectedTokenA, setSelectedTokenA] = useState(DEFAULT_DEVNET_TOKENS[0].mint);
  const [customMintA, setCustomMintA] = useState('');
  const [mintADetails, setMintADetails] = useState(null);
  const [balanceA, setBalanceA] = useState('0');
  const [amountA, setAmountA] = useState('');

  // Selected Token B (Requested)
  const [selectedTokenB, setSelectedTokenB] = useState(DEFAULT_DEVNET_TOKENS[1].mint);
  const [customMintB, setCustomMintB] = useState('');
  const [mintBDetails, setMintBDetails] = useState(null);
  const [balanceB, setBalanceB] = useState('0');
  const [amountB, setAmountB] = useState('');

  // Seed & Derivations
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 10000000).toString());
  const [escrowPdaPreview, setEscrowPdaPreview] = useState('');
  const [vaultAtaPreview, setVaultAtaPreview] = useState('');

  // UI state
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active mint strings
  const activeMintA = selectedTokenA === 'custom' ? customMintA : selectedTokenA;
  const activeMintB = selectedTokenB === 'custom' ? customMintB : selectedTokenB;

  // Load Mint A details and balance
  useEffect(() => {
    let isCancelled = false;
    async function loadMintA() {
      if (!activeMintA) {
        setMintADetails(null);
        return;
      }
      try {
        setIsLoadingDetails(true);
        const details = await getMintDetails(connection, activeMintA);
        if (!isCancelled) {
          setMintADetails(details);
          if (publicKey) {
            const bal = await getWalletTokenBalance(connection, publicKey, details.mint, details.programId);
            if (!isCancelled) setBalanceA(bal.uiAmount);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setMintADetails(null);
          setBalanceA('0');
        }
      } finally {
        if (!isCancelled) setIsLoadingDetails(false);
      }
    }
    loadMintA();
    return () => { isCancelled = true; };
  }, [activeMintA, publicKey, connection]);

  // Load Mint B details and balance
  useEffect(() => {
    let isCancelled = false;
    async function loadMintB() {
      if (!activeMintB) {
        setMintBDetails(null);
        return;
      }
      try {
        const details = await getMintDetails(connection, activeMintB);
        if (!isCancelled) {
          setMintBDetails(details);
          if (publicKey) {
            const bal = await getWalletTokenBalance(connection, publicKey, details.mint, details.programId);
            if (!isCancelled) setBalanceB(bal.uiAmount);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setMintBDetails(null);
          setBalanceB('0');
        }
      }
    }
    loadMintB();
    return () => { isCancelled = true; };
  }, [activeMintB, publicKey, connection]);

  // Derive PDA and Vault previews
  useEffect(() => {
    if (publicKey && seed && mintADetails) {
      try {
        const { escrowPda } = deriveEscrowPda(publicKey, seed);
        setEscrowPdaPreview(escrowPda.toBase58());
        const vault = deriveVaultAta(escrowPda, mintADetails.mint, mintADetails.programId);
        setVaultAtaPreview(vault.toBase58());
      } catch (err) {
        setEscrowPdaPreview('');
        setVaultAtaPreview('');
      }
    } else {
      setEscrowPdaPreview('');
      setVaultAtaPreview('');
    }
  }, [publicKey, seed, mintADetails]);

  // Validation Checks
  useEffect(() => {
    setValidationError('');

    if (!activeMintA || !activeMintB) {
      setValidationError('Please select both tokens.');
      return;
    }

    if (activeMintA === activeMintB) {
      setValidationError('Offering and requested tokens must be different.');
      return;
    }

    if (mintADetails && mintBDetails) {
      if (!mintADetails.programId.equals(mintBDetails.programId)) {
        setValidationError(ERROR_MESSAGES.TokenProgramMismatch);
        return;
      }
    }

    if (amountA && Number(amountA) <= 0) {
      setValidationError('Deposit amount must be greater than zero.');
      return;
    }

    if (amountB && Number(amountB) <= 0) {
      setValidationError('Requested receive amount must be greater than zero.');
      return;
    }

    if (amountA && Number(amountA) > Number(balanceA)) {
      setValidationError(`Insufficient ${mintADetails ? 'token' : ''} balance (You have ${balanceA}).`);
      return;
    }
  }, [activeMintA, activeMintB, mintADetails, mintBDetails, amountA, amountB, balanceA]);

  // Handle Submit Make Escrow
  async function handleMakeEscrow(e) {
    e.preventDefault();
    if (!publicKey) {
      alert('Please connect your Phantom wallet first.');
      return;
    }

    if (!mintADetails || !mintBDetails) {
      alert('Token details could not be verified on Devnet.');
      return;
    }

    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      openTxModal({
        status: 'signing',
        title: 'Approve Escrow Creation',
        message: `Please sign the transaction in Phantom to deposit ${amountA} tokens into the escrow vault.`,
      });

      const depositAtomic = uiToAtomic(amountA, mintADetails.decimals);
      const receiveAtomic = uiToAtomic(amountB, mintBDetails.decimals);

      const ix = createMakeInstruction({
        maker: publicKey,
        seed: BigInt(seed),
        depositAmount: depositAtomic,
        receiveAmount: receiveAtomic,
        mintA: mintADetails.mint,
        mintB: mintBDetails.mint,
        tokenProgram: mintADetails.programId,
      });

      const transaction = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);

      openTxModal({
        status: 'confirming',
        title: 'Confirming Escrow on Devnet',
        message: 'Transaction broadcasted. Awaiting block confirmation...',
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
        title: 'Escrow Created Successfully!',
        message: `Deposited ${amountA} into the vault. Escrow is now open for takers on Devnet!`,
        txSignature: signature,
      });

      // Clear input and generate new random seed
      setAmountA('');
      setAmountB('');
      setSeed(Math.floor(Math.random() * 10000000).toString());

      if (onEscrowCreated) {
        onEscrowCreated();
      }
    } catch (err) {
      console.error('Make Escrow Error:', err);
      openTxModal({
        status: 'error',
        title: 'Failed to Create Escrow',
        message: parseAnchorError(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#23273a] shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#14F195]" />
              Create Escrow
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Lock Token A in a custodial PDA vault & specify expected Token B
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSeed(Math.floor(Math.random() * 10000000).toString())}
            className="flex items-center gap-1 text-[11px] font-mono text-purple-400 hover:text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20"
            title="Generate a new arbitrary seed"
          >
            <RefreshCw className="w-3 h-3" />
            Seed: {seed}
          </button>
        </div>

        <form onSubmit={handleMakeEscrow} className="space-y-5">
          
          {/* TOKEN A SECTION (DEPOSIT) */}
          <div className="p-4 rounded-2xl bg-[#0f111a] border border-[#1e2233]">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              <span>You Deposit (Token A)</span>
              <span className="flex items-center gap-1 font-mono text-gray-300">
                Balance: {balanceA}
                {balanceA !== '0' && (
                  <button
                    type="button"
                    onClick={() => setAmountA(balanceA)}
                    className="ml-1 text-[10px] text-[#14F195] hover:underline"
                  >
                    MAX
                  </button>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={selectedTokenA}
                onChange={(e) => setSelectedTokenA(e.target.value)}
                className="col-span-1 bg-[#161825] border border-[#272b40] text-white text-xs font-semibold rounded-xl p-3 focus:outline-none focus:border-[#9945FF]"
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
                placeholder="0.00"
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                required
                className="col-span-2 bg-[#161825] border border-[#272b40] text-white text-lg font-mono font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#9945FF] text-right"
              />
            </div>

            {selectedTokenA === 'custom' && (
              <input
                type="text"
                placeholder="Custom Devnet Mint Address"
                value={customMintA}
                onChange={(e) => setCustomMintA(e.target.value)}
                className="mt-3 w-full bg-[#161825] border border-[#272b40] text-white text-xs font-mono rounded-xl p-2.5 focus:outline-none focus:border-[#9945FF]"
              />
            )}

            {mintADetails && (
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-400 font-mono">
                <span>Decimals: {mintADetails.decimals}</span>
                <span className="text-purple-400">
                  {mintADetails.isToken2022 ? 'Token-2022' : 'SPL Token Standard'}
                </span>
              </div>
            )}
          </div>

          {/* SWAP ICON DIVIDER */}
          <div className="flex justify-center -my-2 relative z-10">
            <div className="w-9 h-9 rounded-full bg-[#161826] border border-[#2c3148] flex items-center justify-center text-gray-300 shadow-md">
              <ArrowDown className="w-4 h-4 text-[#14F195]" />
            </div>
          </div>

          {/* TOKEN B SECTION (RECEIVE) */}
          <div className="p-4 rounded-2xl bg-[#0f111a] border border-[#1e2233]">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              <span>You Expect to Receive (Token B)</span>
              <span className="font-mono text-gray-300">
                Your Wallet: {balanceB}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={selectedTokenB}
                onChange={(e) => setSelectedTokenB(e.target.value)}
                className="col-span-1 bg-[#161825] border border-[#272b40] text-white text-xs font-semibold rounded-xl p-3 focus:outline-none focus:border-[#14F195]"
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
                placeholder="0.00"
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                required
                className="col-span-2 bg-[#161825] border border-[#272b40] text-white text-lg font-mono font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#14F195] text-right"
              />
            </div>

            {selectedTokenB === 'custom' && (
              <input
                type="text"
                placeholder="Custom Devnet Mint Address"
                value={customMintB}
                onChange={(e) => setCustomMintB(e.target.value)}
                className="mt-3 w-full bg-[#161825] border border-[#272b40] text-white text-xs font-mono rounded-xl p-2.5 focus:outline-none focus:border-[#14F195]"
              />
            )}

            {mintBDetails && (
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-400 font-mono">
                <span>Decimals: {mintBDetails.decimals}</span>
                <span className="text-[#14F195]">
                  {mintBDetails.isToken2022 ? 'Token-2022' : 'SPL Token Standard'}
                </span>
              </div>
            )}
          </div>

          {/* ESCROW PDA & VAULT PREVIEW */}
          {escrowPdaPreview && (
            <div className="p-3 bg-[#0c0d14] border border-[#1b1e2c] rounded-xl text-left space-y-1.5 text-[11px] font-mono text-gray-400">
              <div className="flex items-center justify-between">
                <span>Escrow PDA:</span>
                <span className="text-gray-300">{escrowPdaPreview.slice(0, 10)}...{escrowPdaPreview.slice(-8)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Vault ATA (PDA Owned):</span>
                <span className="text-gray-300">{vaultAtaPreview.slice(0, 10)}...{vaultAtaPreview.slice(-8)}</span>
              </div>
            </div>
          )}

          {/* VALIDATION WARNING */}
          {validationError && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* ACTION BUTTON */}
          <button
            type="submit"
            disabled={!publicKey || !!validationError || isSubmitting || !amountA || !amountB}
            className="w-full py-3.5 px-4 font-bold text-sm rounded-xl transition duration-200 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c10] hover:opacity-95 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-500/10"
          >
            {!publicKey
              ? 'Connect Phantom to Create Escrow'
              : isSubmitting
              ? 'Preparing Transaction...'
              : 'Create Escrow & Deposit'}
          </button>

        </form>
      </div>
    </div>
  );
}
