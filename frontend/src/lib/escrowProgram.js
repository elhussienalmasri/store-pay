import {
  PublicKey,
  TransactionInstruction,
  Transaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  unpackAccount,
} from '@solana/spl-token';
import {
  PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ESCROW_SEED_PREFIX,
  ESCROW_ACCOUNT_SIZE,
  INSTRUCTION_DISCRIMINATORS,
  ERROR_MESSAGES,
} from './constants';

/**
 * Derive the Escrow PDA address and bump
 */
export function deriveEscrowPda(makerPubkey, seed) {
  const maker = typeof makerPubkey === 'string' ? new PublicKey(makerPubkey) : makerPubkey;
  const seedBigInt = typeof seed === 'bigint' ? seed : BigInt(seed.toString());
  
  const seedBuffer = Buffer.alloc(8);
  seedBuffer.writeBigUInt64LE(seedBigInt);

  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_SEED_PREFIX), maker.toBuffer(), seedBuffer],
    PROGRAM_ID
  );

  return { escrowPda: pda, bump, seedBuffer };
}

/**
 * Derive the Vault ATA for the escrow PDA and Mint A
 */
export function deriveVaultAta(escrowPda, mintAPubkey, tokenProgramId = TOKEN_PROGRAM_ID) {
  const escrow = typeof escrowPda === 'string' ? new PublicKey(escrowPda) : escrowPda;
  const mintA = typeof mintAPubkey === 'string' ? new PublicKey(mintAPubkey) : mintAPubkey;
  const progId = typeof tokenProgramId === 'string' ? new PublicKey(tokenProgramId) : tokenProgramId;

  return getAssociatedTokenAddressSync(
    mintA,
    escrow,
    true, // allowOwnerOffCurve = true (Escrow is a PDA)
    progId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

/**
 * Build the `make` instruction
 */
export function createMakeInstruction({
  maker,
  seed,
  receiveAmount, // BigInt atomic
  depositAmount, // BigInt atomic
  mintA,
  mintB,
  tokenProgram = TOKEN_PROGRAM_ID,
}) {
  const makerPubkey = typeof maker === 'string' ? new PublicKey(maker) : maker;
  const mintAPubkey = typeof mintA === 'string' ? new PublicKey(mintA) : mintA;
  const mintBPubkey = typeof mintB === 'string' ? new PublicKey(mintB) : mintB;
  const tokenProgramId = typeof tokenProgram === 'string' ? new PublicKey(tokenProgram) : tokenProgram;

  const { escrowPda } = deriveEscrowPda(makerPubkey, seed);
  const vault = deriveVaultAta(escrowPda, mintAPubkey, tokenProgramId);
  const makerAtaA = getAssociatedTokenAddressSync(
    mintAPubkey,
    makerPubkey,
    false,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Layout: discriminator(8) + seed(8) + receive(8) + amount(8) = 32 bytes
  const data = Buffer.alloc(32);
  Buffer.from(INSTRUCTION_DISCRIMINATORS.make).copy(data, 0);
  data.writeBigUInt64LE(BigInt(seed), 8);
  data.writeBigUInt64LE(BigInt(receiveAmount), 16);
  data.writeBigUInt64LE(BigInt(depositAmount), 24);

  const keys = [
    { pubkey: makerPubkey, isSigner: true, isWritable: true },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
    { pubkey: mintAPubkey, isSigner: false, isWritable: false },
    { pubkey: mintBPubkey, isSigner: false, isWritable: false },
    { pubkey: makerAtaA, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: tokenProgramId, isSigner: false, isWritable: false },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Build the `take` instruction
 */
export function createTakeInstruction({
  taker,
  maker,
  seed,
  mintA,
  mintB,
  tokenProgram = TOKEN_PROGRAM_ID,
}) {
  const takerPubkey = typeof taker === 'string' ? new PublicKey(taker) : taker;
  const makerPubkey = typeof maker === 'string' ? new PublicKey(maker) : maker;
  const mintAPubkey = typeof mintA === 'string' ? new PublicKey(mintA) : mintA;
  const mintBPubkey = typeof mintB === 'string' ? new PublicKey(mintB) : mintB;
  const tokenProgramId = typeof tokenProgram === 'string' ? new PublicKey(tokenProgram) : tokenProgram;

  const { escrowPda } = deriveEscrowPda(makerPubkey, seed);
  const vault = deriveVaultAta(escrowPda, mintAPubkey, tokenProgramId);

  const takerAtaA = getAssociatedTokenAddressSync(
    mintAPubkey,
    takerPubkey,
    true,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const takerAtaB = getAssociatedTokenAddressSync(
    mintBPubkey,
    takerPubkey,
    true,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const makerAtaB = getAssociatedTokenAddressSync(
    mintBPubkey,
    makerPubkey,
    true,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Layout: discriminator(8) = 8 bytes
  const data = Buffer.from(INSTRUCTION_DISCRIMINATORS.take);

  const keys = [
    { pubkey: takerPubkey, isSigner: true, isWritable: true },
    { pubkey: makerPubkey, isSigner: false, isWritable: true },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
    { pubkey: mintAPubkey, isSigner: false, isWritable: false },
    { pubkey: mintBPubkey, isSigner: false, isWritable: false },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: takerAtaA, isSigner: false, isWritable: true },
    { pubkey: takerAtaB, isSigner: false, isWritable: true },
    { pubkey: makerAtaB, isSigner: false, isWritable: true },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: tokenProgramId, isSigner: false, isWritable: false },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Build the `take_same_mint` instruction
 *
 * Used when mintA === mintB: `take` would pass the taker's token account twice
 * (taker_ata_a / taker_ata_b), which Anchor rejects with 2040.
 * Account order matches TakeSameMint in the program.
 */
export function createTakeSameMintInstruction({
  taker,
  maker,
  seed,
  mint,
  tokenProgram = TOKEN_PROGRAM_ID,
}) {
  const takerPubkey = typeof taker === 'string' ? new PublicKey(taker) : taker;
  const makerPubkey = typeof maker === 'string' ? new PublicKey(maker) : maker;
  const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
  const tokenProgramId = typeof tokenProgram === 'string' ? new PublicKey(tokenProgram) : tokenProgram;

  const { escrowPda } = deriveEscrowPda(makerPubkey, seed);
  const vault = deriveVaultAta(escrowPda, mintPubkey, tokenProgramId);

  const takerAta = getAssociatedTokenAddressSync(
    mintPubkey,
    takerPubkey,
    true,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const makerAta = getAssociatedTokenAddressSync(
    mintPubkey,
    makerPubkey,
    true,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const data = Buffer.from(INSTRUCTION_DISCRIMINATORS.take_same_mint);

  const keys = [
    { pubkey: takerPubkey, isSigner: true, isWritable: true },
    { pubkey: makerPubkey, isSigner: false, isWritable: true },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
    { pubkey: mintPubkey, isSigner: false, isWritable: false },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: takerAta, isSigner: false, isWritable: true },
    { pubkey: makerAta, isSigner: false, isWritable: true },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: tokenProgramId, isSigner: false, isWritable: false },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Build the `refund` instruction
 */
export function createRefundInstruction({
  maker,
  seed,
  mintA,
  tokenProgram = TOKEN_PROGRAM_ID,
}) {
  const makerPubkey = typeof maker === 'string' ? new PublicKey(maker) : maker;
  const mintAPubkey = typeof mintA === 'string' ? new PublicKey(mintA) : mintA;
  const tokenProgramId = typeof tokenProgram === 'string' ? new PublicKey(tokenProgram) : tokenProgram;

  const { escrowPda } = deriveEscrowPda(makerPubkey, seed);
  const vault = deriveVaultAta(escrowPda, mintAPubkey, tokenProgramId);
  const makerAtaA = getAssociatedTokenAddressSync(
    mintAPubkey,
    makerPubkey,
    true,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Layout: discriminator(8) = 8 bytes
  const data = Buffer.from(INSTRUCTION_DISCRIMINATORS.refund);

  const keys = [
    { pubkey: makerPubkey, isSigner: true, isWritable: true },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
    { pubkey: mintAPubkey, isSigner: false, isWritable: false },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: makerAtaA, isSigner: false, isWritable: true },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: tokenProgramId, isSigner: false, isWritable: false },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Decode an Escrow account buffer
 */
export function decodeEscrowAccount(buffer, pubkey) {
  if (!buffer || buffer.length < ESCROW_ACCOUNT_SIZE) {
    throw new Error(`Invalid escrow account buffer size (${buffer ? buffer.length : 0} bytes)`);
  }

  // First byte is discriminator [1]
  const discriminator = buffer.readUInt8(0);
  if (discriminator !== 1) {
    throw new Error(`Invalid discriminator: expected 1, found ${discriminator}`);
  }

  const seed = buffer.readBigUInt64LE(1);
  const maker = new PublicKey(buffer.subarray(9, 41));
  const mintA = new PublicKey(buffer.subarray(41, 73));
  const mintB = new PublicKey(buffer.subarray(73, 105));
  const receive = buffer.readBigUInt64LE(105);
  const bump = buffer.readUInt8(113);

  return {
    publicKey: pubkey,
    address: pubkey ? pubkey.toBase58() : '',
    seed: seed.toString(),
    seedBigInt: seed,
    maker,
    makerAddress: maker.toBase58(),
    mintA,
    mintAAddress: mintA.toBase58(),
    mintB,
    mintBAddress: mintB.toBase58(),
    receive,
    bump,
  };
}

/**
 * Discover and parse all open escrows on Solana Devnet
 */
export async function fetchOpenEscrows(connection) {
  try {
    // Escrow account has size 114 and discriminator 1 at offset 0
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          dataSize: ESCROW_ACCOUNT_SIZE,
        },
      ],
    });

    const parsedEscrows = [];

    for (const { pubkey, account } of accounts) {
      try {
        const decoded = decodeEscrowAccount(account.data, pubkey);

        // Check if the corresponding vault token account exists and has balance
        // We find the mint program ID
        let tokenProgramId = TOKEN_PROGRAM_ID;
        try {
          const mintInfo = await connection.getAccountInfo(decoded.mintA);
          if (mintInfo && mintInfo.owner) {
            tokenProgramId = mintInfo.owner;
          }
        } catch (e) {
          // ignore
        }

        const vaultAta = deriveVaultAta(pubkey, decoded.mintA, tokenProgramId);
        let vaultAmount = 0n;
        let vaultExists = false;

        try {
          const vaultBalance = await connection.getTokenAccountBalance(vaultAta);
          vaultAmount = BigInt(vaultBalance.value.amount);
          vaultExists = true;
        } catch (e) {
          // Vault might already be closed if in transit
        }

        parsedEscrows.push({
          ...decoded,
          vault: vaultAta,
          vaultAddress: vaultAta.toBase58(),
          vaultAmount,
          vaultExists,
          tokenProgramId,
        });
      } catch (err) {
        console.warn('Skipping unparsable program account:', pubkey.toBase58(), err.message);
      }
    }

    return parsedEscrows;
  } catch (err) {
    console.error('Error fetching open escrows:', err);
    throw err;
  }
}

/**
 * Parse Solana/Anchor transaction errors into friendly human-readable messages
 */
export function parseAnchorError(error) {
  if (!error) return 'Unknown transaction error.';

  const message = error.message || error.toString();

  // Check custom error codes
  for (const [code, desc] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(code) || message.includes(`0x${Number(code).toString(16)}`)) {
      return desc;
    }
  }

  if (/InstructionFallbackNotFound|Instruction fallback not found|0x65/.test(message)) {
    return 'The escrow program deployed on devnet does not include the same-mint claim instruction yet. Redeploy the updated program, or refund this order from the buyer checkout link.';
  }

  if (message.includes('User rejected the request') || message.includes('rejected')) {
    return 'Transaction was cancelled in the wallet.';
  }

  if (/simulat/i.test(message)) {
    return 'Phantom could not simulate this transaction. Switch Phantom to Solana Devnet (Settings → Developer Settings → Change Network) and make sure the wallet holds devnet SOL.';
  }

  if (
    message.includes('Attempt to load a program that does not exist') ||
    message.includes('ProgramAccountNotFound')
  ) {
    return 'The escrow program is not available on the network Phantom is using. Switch Phantom to Solana Devnet.';
  }

  if (
    message.includes('Attempt to debit an account but found no record of a prior credit') ||
    message.includes('insufficient lamports')
  ) {
    return 'Your wallet needs devnet SOL for the deposit, rent and fees. Airdrop devnet SOL at faucet.solana.com.';
  }

  if (message.includes('insufficient funds') || message.includes('custom program error: 0x1')) {
    return 'Insufficient token balance for this swap.';
  }

  return message;
}
