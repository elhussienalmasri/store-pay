# StorePay

## ℹ️ Description

StorePay provides:

- A payment solution for online stores, allowing store owners to accept payments from customers through external apps. To receive payment purchases, the merchant configures a payout wallet and adds their StorePay secret key in StorePay's secure payment configuration or on their server. The secret key has two server-side jobs: it authenticates payment-session creation for the client app and authorizes the merchant to unlock payments in StorePay. It must never be placed in an external website payment field or browser code.

  **How to create:** Open `/merchant`, select the `Widget Payment` tab, and create a payment method to use in an external app or website. The merchant uses the secret key to unlock eligible payment purchases, then claims them from the `Orders` tab.

  - Example of a simple app that uses StorePay payment methods: [Shop App](https://github.com/elhussienalmasri/store-pay/tree/shop-app).
- Cryptocurrency exchanges happen in two ways: direct crypto exchange or crypto exchange through a P2P desk. The exchange is created and tracked in StorePay; when an external payment method such as a bank transfer is used, the seller confirms receiving the payment before the crypto exchange is completed.
- A marketplace for buying and selling products and services. When the buyer clicks pay and approves the wallet transaction, the payment moves from the buyer's wallet into an on-chain escrow account. StorePay organizes the payment and delivery process; it does not hold the funds. After the seller fulfils the order, the buyer confirms that the product or service was received, then the seller can settle and receive the escrowed payment.

StorePay shows in-app notifications for account activity, sales, purchases, and escrow updates. Buyers and sellers also receive notifications for purchases made through an external store integration. When email notifications are enabled and the email variables are configured, the same activity messages can be delivered by email.

## ✨ What it includes

- **Solana wallet connection:** Connect a Solana wallet to authorize transactions. A Phantom Solana wallet is recommended for testing the app on devnet, though several Solana wallets are supported; private keys and seed phrases stay in the wallet.
- **On-chain escrow core (`make`, `take`, `refund`):** The maker deposits the offered token into a program-derived vault and sets the requested amount. A taker fulfils the exchange atomically, while the maker can refund an open escrow and recover the deposited token.
- **Open escrow discovery:** Finds open escrow offers through Solana RPC using the escrow account discriminator and account size, then checks vault balances as offers update.
- **P2P evidence and verification desk:** Buyers can select a seller offer, make the external payment, and submit a receipt or payment reference. Sellers review the evidence and approve release or refund.

  **Upcoming feature:** Direct buyer–seller conversation for a trade, available from the P2P Desk and other relevant StorePay screens.
- **Token compatibility and decimal precision:** Supports standard SPL Token and Token-2022 when both tokens use the same token program, and uses `BigInt` for accurate conversion between display values and on-chain atomic units.
- Merchant dashboard for managing products, orders, payout settings, and checkout configuration.
- Marketplace for discovering products and services with escrow-protected checkout.
- Payment methods for client (external) apps:

   - **InPay**, a minimal checkout flow for external stores: the customer clicks a pay button and moves to StorePay to connect a wallet and confirm the transaction.
   - **Client Pay (popup)**, an embeddable escrow-payment popup for merchant storefronts that opens StorePay for the customer to complete payment.

## ⚙️ Tech stack

- **Frontend:** Next.js, React, and Tailwind CSS
- **Blockchain:** Solana and the Solana Web3.js SDK
- **Wallet integration:** Solana Wallet Adapter with support for wallets such as Phantom.
- **Smart contracts:** Rust and Anchor
- **Server and APIs:** Next.js API routes
- **Client-store integration:** StorePay receives and manages payment requests from external client stores, such as `shop-app`.

## 🧭 Pages

| Route | Purpose |
|---|---|
| `/` | Landing page: product overview, how it works, and widget snippet. |
| `/escrow` | Escrow app: create and explore escrows, use the P2P desk, and access the merchant widget tab. |
| `/login` | Merchant sign-in with email and password. |
| `/signup` | Merchant sign-up: store name, email, password, domain, payout wallet, and plan. |
| `/merchant` | Merchant dashboard: overview, products, widget configuration, orders, and settings. |
| `/marketplace` | Public marketplace: listed products and services from every seller. |
| `/checkout/[sessionId]` | Hosted checkout for a payment session. |

### 🏪 `/merchant` dashboard tabs

- **Overview:** Shows store activity, payment statistics, products, and quick actions.
- **Products:** Creates, updates, lists, and removes products or services. Merchants can include them in the internal marketplace or use them only to generate a payment link.
- **Payment:** Generates payment links for products and services.
- **Orders:** Tracks payment sessions and lets the merchant claim eligible escrow payments with the configured payout wallet.
- **Widget Payment:** Creates an InPay or Client Pay checkout for an external store and uses the merchant secret key to unlock payment purchases in StorePay.
- **Settings:** Manages store details, payout settings, notification preferences, and merchant access.

### 🔐 `/escrow` dashboard tabs

- **Create Escrow:** Creates an on-chain escrow for a direct crypto exchange, including the offered and requested token amounts.
- **Open Escrows:** Explores open escrow offers, accepts a compatible offer, or refunds an escrow created by the connected wallet.
- **P2P Desk:** The seller creates a P2P crypto-exchange offer and can receive payment in another cryptocurrency or through an external, off-chain method. The buyer selects an offer, makes the payment, and submits payment evidence; the crypto is not transferred to the buyer until the seller confirms that payment was received.

## 🛡️ Security Best Practices

- **Zero Secret Storage**: No private keys, keypairs, or seed phrases are ever stored, logged, or handled by the frontend.
- **User Authorization**: All transactions must be explicitly signed and approved in the Phantom wallet popup.
- **Devnet Isolation**: All transactions and RPC requests are isolated to Solana Devnet.

## 🗂️ Project structure

```text
programs/anchor_escrow/   Anchor smart contract
tests/                    Rust tests for the escrow program
idls/                     Generated Anchor IDL
frontend/                 Next.js application, API routes, widgets, and local data
```

## ✉️ Email notifications

In-app activity notifications are always recorded for supported purchase, sale, and escrow events. To deliver email copies, configure one of these server-side providers in `frontend/.env.local` and enable email notifications for the merchant. The merchant's signup email is used by default, or a different notification email can be set in Settings:

```env
# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=StorePay <payments@example.com>

# Or Resend
RESEND_API_KEY=
MAIL_FROM=StorePay <payments@example.com>
```


## ✅ Requirements

- Node.js 18 or newer
- npm
- Rust and Cargo
- Solana CLI
- Anchor CLI
- A Solana wallet, such as Phantom

The checked-in Anchor configuration targets Solana devnet.

## 🚀 Deploy your own escrow program

To run a separate StorePay escrow program, deploy a new Anchor program with a wallet you control, then point the frontend to its program ID. The following example uses Solana devnet.

1. Configure and fund the deployer wallet:

   ```bash
   solana config set --url https://api.devnet.solana.com
   solana-keygen new
   solana airdrop 2
   ```

2. From the repository root, build the program and get its generated address:

   ```bash
   anchor build
   anchor keys list
   ```

3. Copy the `anchor_escrow` address from the command output. Replace the program ID in both locations below with that address, then build again:

   - `programs/anchor_escrow/src/lib.rs` in `declare_id!("...")`
   - `Anchor.toml` under `[programs.devnet]`

   ```bash
   anchor build
   ```

4. Deploy and verify the program:

   ```bash
   anchor deploy --provider.cluster devnet
   solana program show YOUR_PROGRAM_ID
   ```

5. Configure the frontend in `frontend/.env.local`:

   ```env
   NEXT_PUBLIC_SOLANA_NETWORK=devnet
   NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
   NEXT_PUBLIC_PROGRAM_ID=YOUR_PROGRAM_ID
   ```

6. Restart the frontend with `npm run dev` from `frontend`. Wallet transactions and escrow discovery now use the program identified by `NEXT_PUBLIC_PROGRAM_ID`.

## 💾 Local data

In development, the Next.js app persists local data in `frontend/data/escrowpay.json`. This is suitable for local demos only. Use a managed database and secure session configuration before deploying a production instance.


## ▶️ Run the frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).


## 🔌 Add StorePay payments to an external website

For InPay and Client Pay popup setup, environment configuration, dynamic checkout sessions, and server-side payment verification, read the [client app integration guide](docs/client-app-integration.md).

[Shop App](https://github.com/elhussienalmasri/store-pay/tree/shop-app) is the reference client application for both payment methods.
