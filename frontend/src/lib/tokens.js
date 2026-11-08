import { PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  unpackMint,
  TOKEN_PROGRAM_ID as SPL_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID as SPL_TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, WSOL_MINT, WSOL_ATA_RENT_LAMPORTS } from './constants';

/**
 * Inspect a token mint to determine its owner program (SPL vs 2022) and decimals.
 */
export async function getMintDetails(connection, mintAddress) {
  try {
    const mintPubkey = typeof mintAddress === 'string' ? new PublicKey(mintAddress) : mintAddress;
    const info = await connection.getAccountInfo(mintPubkey);
    
    if (!info) {
      throw new Error('Mint account not found on Solana Devnet.');
    }

    const programId = info.owner;
    const isSplToken = programId.equals(TOKEN_PROGRAM_ID);
    const isToken2022 = programId.equals(TOKEN_2022_PROGRAM_ID);

    if (!isSplToken && !isToken2022) {
      throw new Error(`Account is not owned by SPL Token or Token-2022 program (Owner: ${programId.toBase58()}).`);
    }

    // Unpack mint data using spl-token
    const mintData = unpackMint(mintPubkey, info, programId);

    return {
      mint: mintPubkey,
      mintAddress: mintPubkey.toBase58(),
      decimals: mintData.decimals,
      supply: mintData.supply,
      programId: programId,
      programIdString: programId.toBase58(),
      isToken2022,
    };
  } catch (err) {
    console.error('Error fetching mint details:', err);
    throw err;
  }
}

/**
 * Fetch wallet token balance and ATA info
 */
export async function getWalletTokenBalance(connection, walletPubkey, mintPubkey, tokenProgramId) {
  if (!walletPubkey || !mintPubkey) {
    return { uiAmount: '0', atomicAmount: 0n, ata: null, exists: false };
  }

  const wallet = typeof walletPubkey === 'string' ? new PublicKey(walletPubkey) : walletPubkey;
  const mint = typeof mintPubkey === 'string' ? new PublicKey(mintPubkey) : mintPubkey;
  const progId = tokenProgramId ? (typeof tokenProgramId === 'string' ? new PublicKey(tokenProgramId) : tokenProgramId) : TOKEN_PROGRAM_ID;

  try {
    const ata = getAssociatedTokenAddressSync(
      mint,
      wallet,
      true, // allowOwnerOffCurve
      progId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const balanceInfo = await connection.getTokenAccountBalance(ata);
    return {
      uiAmount: balanceInfo.value.uiAmountString || '0',
      atomicAmount: BigInt(balanceInfo.value.amount),
      decimals: balanceInfo.value.decimals,
      ata,
      exists: true,
    };
  } catch (err) {
    // If account doesn't exist, balance is 0
    const ata = getAssociatedTokenAddressSync(
      mint,
      wallet,
      true,
      progId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return {
      uiAmount: '0',
      atomicAmount: 0n,
      decimals: 0,
      ata,
      exists: false,
    };
  }
}

/**
 * SOL the wallet can actually commit to an escrow: plain SOL plus wrapped SOL already held,
 * minus the rent a brand new wrapped-SOL account needs.
 */
export async function getWalletSolBalance(connection, walletPubkey) {
  const wallet = typeof walletPubkey === 'string' ? new PublicKey(walletPubkey) : walletPubkey;
  const mint = new PublicKey(WSOL_MINT);

  const [lamports, wrapped] = await Promise.all([
    connection.getBalance(wallet).catch(() => 0),
    getWalletTokenBalance(connection, wallet, mint, TOKEN_PROGRAM_ID),
  ]);

  let atomic = BigInt(lamports) + wrapped.atomicAmount;
  if (!wrapped.exists) atomic -= BigInt(WSOL_ATA_RENT_LAMPORTS);
  if (atomic < 0n) atomic = 0n;

  return {
    atomicAmount: atomic,
    uiAmount: atomicToUi(atomic, 9),
    solAmount: atomicToUi(BigInt(lamports), 9),
    wrappedAmount: wrapped.uiAmount,
  };
}

/**
 * Parse UI float string to atomic BigInt avoiding floating point issues
 */
export function uiToAtomic(amountStr, decimals) {
  if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) {
    return 0n;
  }

  const [whole, fraction = ''] = amountStr.toString().split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = `${whole}${paddedFraction}`.replace(/^0+/, '') || '0';
  return BigInt(combined);
}

/**
 * Format atomic BigInt/number to UI string
 */
export function atomicToUi(atomicAmount, decimals) {
  if (atomicAmount === undefined || atomicAmount === null) return '0';
  
  const raw = typeof atomicAmount === 'bigint' ? atomicAmount : BigInt(atomicAmount.toString());
  if (raw === 0n) return '0';

  const factor = 10n ** BigInt(decimals);
  const whole = raw / factor;
  const remainder = raw % factor;

  if (remainder === 0n) {
    return whole.toString();
  }

  const fractionStr = remainder.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fractionStr}`;
}
