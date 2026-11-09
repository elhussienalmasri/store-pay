import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID_STRING = process.env.NEXT_PUBLIC_PROGRAM_ID;

if (!PROGRAM_ID_STRING) {
  throw new Error('NEXT_PUBLIC_PROGRAM_ID must be configured.');
}

export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);

export const DEVNET_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
export const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');

export const ESCROW_SEED_PREFIX = 'escrow';

// Escrow account binary discriminator in Anchor 1.x: single byte [1]
export const ESCROW_ACCOUNT_DISCRIMINATOR = 1;
export const ESCROW_ACCOUNT_SIZE = 114; // 1 (disc) + 8 (seed) + 32 (maker) + 32 (mintA) + 32 (mintB) + 8 (receive) + 1 (bump)

// Instruction Discriminators from IDL
export const INSTRUCTION_DISCRIMINATORS = {
  make: [138, 227, 232, 77, 223, 166, 96, 197],
  refund: [2, 96, 183, 251, 63, 208, 46, 46],
  take: [149, 226, 52, 104, 6, 142, 230, 39],
  take_same_mint: [167, 58, 207, 0, 89, 104, 249, 221],
};

// Known Devnet Test Mints (SPL Token standard)
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

// Lamports a wrapped-SOL account must hold to stay rent exempt. Creating one costs this much SOL.
export const WSOL_ATA_RENT_LAMPORTS = 2039280;

export const DEFAULT_DEVNET_TOKENS = [
  {
    symbol: 'DevUSDC',
    name: 'Devnet USD Coin',
    mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    decimals: 6,
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    logo: '💵',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    mint: WSOL_MINT,
    decimals: 9,
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    logo: '◎',
  },
];

export const ERROR_MESSAGES = {
  6000: 'Invalid amount: Both the deposit amount and requested receive amount must be greater than zero.',
  6001: 'Invalid maker: Only the original escrow creator can cancel/refund this escrow.',
  6002: 'Invalid Mint A: The provided Token A mint does not match the escrow configuration.',
  6003: 'Invalid Mint B: The provided Token B mint does not match the escrow configuration.',
  TokenProgramMismatch: 'Token Standard Mismatch: The program constraint requires both Mint A and Mint B to belong to the same token program (either both standard SPL Token or both Token-2022).',
};

export function getExplorerUrl(type, value) {
  return `https://explorer.solana.com/${type}/${value}?cluster=devnet`;
}
