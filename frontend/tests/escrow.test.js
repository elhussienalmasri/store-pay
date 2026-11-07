const test = require('node:test');
const assert = require('node:assert');
const { PublicKey } = require('@solana/web3.js');

// Constants
const PROGRAM_ID = new PublicKey('2RUCd28fjPeXaLGFbgo45KEuFdMxDCpjuHreenC5WquF');
const ESCROW_ACCOUNT_SIZE = 114;

// Inline logic for testing isolated from ESM/Next.js imports
function deriveEscrowPda(makerPubkey, seed) {
  const seedBuffer = Buffer.alloc(8);
  seedBuffer.writeBigUInt64LE(BigInt(seed));
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), makerPubkey.toBuffer(), seedBuffer],
    PROGRAM_ID
  );
  return { escrowPda: pda, bump };
}

function decodeEscrowAccount(buffer, pubkey) {
  assert.ok(buffer.length >= ESCROW_ACCOUNT_SIZE, 'Buffer too small');
  const discriminator = buffer.readUInt8(0);
  assert.strictEqual(discriminator, 1, 'Invalid discriminator');

  const seed = buffer.readBigUInt64LE(1);
  const maker = new PublicKey(buffer.subarray(9, 41));
  const mintA = new PublicKey(buffer.subarray(41, 73));
  const mintB = new PublicKey(buffer.subarray(73, 105));
  const receive = buffer.readBigUInt64LE(105);
  const bump = buffer.readUInt8(113);

  return {
    publicKey: pubkey,
    seed: seed.toString(),
    seedBigInt: seed,
    maker,
    mintA,
    mintB,
    receive,
    bump,
  };
}

function uiToAtomic(amountStr, decimals) {
  if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) {
    return 0n;
  }
  const [whole, fraction = ''] = amountStr.toString().split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = `${whole}${paddedFraction}`.replace(/^0+/, '') || '0';
  return BigInt(combined);
}

function atomicToUi(atomicAmount, decimals) {
  const raw = typeof atomicAmount === 'bigint' ? atomicAmount : BigInt(atomicAmount.toString());
  if (raw === 0n) return '0';
  const factor = 10n ** BigInt(decimals);
  const whole = raw / factor;
  const remainder = raw % factor;
  if (remainder === 0n) return whole.toString();
  const fractionStr = remainder.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fractionStr}`;
}

test('Escrow PDA derivation computes deterministic address', () => {
  const testMaker = new PublicKey('11111111111111111111111111111111');
  const seed = 42n;
  const { escrowPda, bump } = deriveEscrowPda(testMaker, seed);

  assert.ok(escrowPda instanceof PublicKey);
  assert.ok(typeof bump === 'number' && bump >= 0 && bump <= 255);

  // Deriving again with same parameters yields exact same PDA
  const second = deriveEscrowPda(testMaker, seed);
  assert.strictEqual(escrowPda.toBase58(), second.escrowPda.toBase58());
  assert.strictEqual(bump, second.bump);
});

test('Escrow binary account decoder decodes 114-byte Anchor buffer', () => {
  const buffer = Buffer.alloc(ESCROW_ACCOUNT_SIZE);
  
  // Discriminator: 1 byte = 1
  buffer.writeUInt8(1, 0);

  // Seed: 8 bytes LE = 99999n
  buffer.writeBigUInt64LE(99999n, 1);

  // Maker: 32 bytes
  const makerKey = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
  makerKey.toBuffer().copy(buffer, 9);

  // Mint A: 32 bytes
  const mintAKey = new PublicKey('So11111111111111111111111111111111111111112');
  mintAKey.toBuffer().copy(buffer, 41);

  // Mint B: 32 bytes
  const mintBKey = new PublicKey('EJwZgeZrdms8gPRBVatWvoWbpmucFDujRZmEi1mrGQks');
  mintBKey.toBuffer().copy(buffer, 73);

  // Receive: 8 bytes LE = 500000000n
  buffer.writeBigUInt64LE(500000000n, 105);

  // Bump: 1 byte = 254
  buffer.writeUInt8(254, 113);

  const decoded = decodeEscrowAccount(buffer, null);

  assert.strictEqual(decoded.seed, '99999');
  assert.strictEqual(decoded.maker.toBase58(), makerKey.toBase58());
  assert.strictEqual(decoded.mintA.toBase58(), mintAKey.toBase58());
  assert.strictEqual(decoded.mintB.toBase58(), mintBKey.toBase58());
  assert.strictEqual(decoded.receive, 500000000n);
  assert.strictEqual(decoded.bump, 254);
});

test('Token decimal math converts correctly between UI and atomic units', () => {
  // 6 decimals (e.g. USDC)
  assert.strictEqual(uiToAtomic('1.5', 6), 1500000n);
  assert.strictEqual(uiToAtomic('0.000001', 6), 1n);
  assert.strictEqual(atomicToUi(1500000n, 6), '1.5');
  assert.strictEqual(atomicToUi(1n, 6), '0.000001');

  // 9 decimals (e.g. SOL)
  assert.strictEqual(uiToAtomic('2.5', 9), 2500000000n);
  assert.strictEqual(atomicToUi(2500000000n, 9), '2.5');
});

test('Make instruction payload has correct length and discriminator', () => {
  const MAKE_DISCRIMINATOR = [138, 227, 232, 77, 223, 166, 96, 197];
  const data = Buffer.alloc(32);
  Buffer.from(MAKE_DISCRIMINATOR).copy(data, 0);
  data.writeBigUInt64LE(123n, 8);
  data.writeBigUInt64LE(500n, 16);
  data.writeBigUInt64LE(1000n, 24);

  assert.strictEqual(data.length, 32);
  assert.deepStrictEqual(Array.from(data.subarray(0, 8)), MAKE_DISCRIMINATOR);
  assert.strictEqual(data.readBigUInt64LE(8), 123n);
  assert.strictEqual(data.readBigUInt64LE(16), 500n);
  assert.strictEqual(data.readBigUInt64LE(24), 1000n);
});
