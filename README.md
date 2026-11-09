# Shop App

Shop App is a sample online store that demonstrates StorePay integration for product purchases.

## StorePay payments

- **InPay:** lets a customer connect a Solana wallet and pay inside Shop App.
- **Client Pay popup:** opens the StorePay-hosted checkout popup for a purchase.

Shop App creates and verifies StorePay sessions on the server before marking a local order as paid.

## Configuration

Create the payment method in StorePay under `/merchant` → `Widget Payment`. For a deployed Shop App, add its domain to the StorePay merchant configuration.

Set these values in `.env.local`:

```env
# Server only. Never expose this in browser code.
STOREPAY_SECRET_KEY=sk_your_storepay_secret_key

# Safe to expose to the browser.
NEXT_PUBLIC_STOREPAY_ID=pk_your_storepay_publishable_key
NEXT_PUBLIC_STOREPAY_ORIGIN=http://localhost:3000
```

## Run locally

Requirements: Node.js 22 or newer and a running StorePay app.

```bash
npm install
cp .env.example .env.local
npm run setup:db  # Create the local SQLite database
npm run dev
```

Open the local URL printed by Next.js.

## Test payments

1. Start StorePay from `escrow/frontend` on `http://localhost:3000`.
2. Start Shop App on a different port, for example:

   ```bash
   npm run dev -- -p 3001
   ```

3. Use a Solana devnet wallet with test SOL and add a product to the Shop App cart.
4. Complete the checkout form, then test either **Pay with InPay** or **Pay with Client Pay popup**.
5. Approve the wallet transaction. Shop App verifies the StorePay session and marks the local order as paid.
