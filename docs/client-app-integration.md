# StorePay client app integration guide

Use this guide to add StorePay payments to an external client application, such as an online store. It covers the two available checkout methods:

- **InPay:** the buyer connects a wallet and pays inside the client application's domain.
- **Client Pay popup:** the buyer completes payment in a StorePay-hosted popup.

## 1. Configure the StorePay merchant

In StorePay, open `/merchant` → `Widget Payment`. Create the payment method and configure the merchant payout wallet. Localhost client applications are allowed during development. For a deployed client application, add its domain in the merchant configuration.

StorePay generates a publishable key and merchant secret key. Add them to the client application's environment file:

```env
NEXT_PUBLIC_STOREPAY_ID=pk_your_publishable_key
NEXT_PUBLIC_STOREPAY_ORIGIN=http://localhost:3000

# Server only. Never expose this value in browser code.
STOREPAY_SECRET_KEY=sk_your_secret_key
```

The publishable key is safe for browser code. The secret key belongs only in the client application's server or serverless environment.

## 2. Add InPay

Use InPay when the buyer should stay on the client application's domain. Add the inline widget loader:

```html
<div id="storepay-inpay"></div>
<button id="storepay-inpay-button" disabled>
  Pay with InPay
</button>

<script
  src="http://localhost:3000/inpay/v1.js?escrow_id=pk_your_publishable_key"
  data-target="storepay-inpay"
  async
></script>

<script>
  const button = document.getElementById('storepay-inpay-button');

  window.addEventListener('escrowpay:ready', () => {
    button.disabled = false;
  });

  button.addEventListener('click', async () => {
    try {
      const payment = await window.EscrowPayInPay.pay({
        amountMinor: 4999,
        currency: 'USD',
        reference: 'ORDER-123',
        description: 'Example product',
      });
      console.log('StorePay payment completed:', payment.session);
    } catch (error) {
      alert(error.message || 'Payment was not completed.');
    }
  });
</script>
```

The buyer connects a Solana wallet and approves the transaction. StorePay returns the paid session data to the client application.

## 3. Another payment method: Client Pay popup

For a fixed StorePay product, add the generated button snippet to the client application:

```html
<script src="http://localhost:3000/widget/v1.js" async></script>
<button
  data-escrowpay
  data-public-key="pk_your_publishable_key"
  data-product="prd_your_storepay_product_id"
>
  Pay with StorePay
</button>
```

This simple popup integration uses only the publishable key. It is suitable when the product and price are configured in StorePay.

## 4. Support dynamic cart totals

For a cart whose total changes, create the StorePay checkout session on the client application's server. The server uses `STOREPAY_SECRET_KEY`, so the browser never receives it.

```js
const response = await fetch(
  `${process.env.NEXT_PUBLIC_STOREPAY_ORIGIN}/api/v1/sessions`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STOREPAY_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customAmountMinor: order.totalCents,
      currency: 'USD',
      description: order.description,
      merchantOrderId: order.reference,
      mode: 'escrow',
    }),
  }
);

const { session } = await response.json();
```

Pass the returned `session.checkoutUrl` to the Client Pay component or popup widget. When StorePay reports success, send the session ID and token to the client application's server for verification.

## 5. Verify the payment before fulfilling the order

Never mark a local order as paid based only on a browser success callback. On the client application's server, fetch the StorePay session and verify it:

```js
const response = await fetch(
  `${process.env.NEXT_PUBLIC_STOREPAY_ORIGIN}/api/v1/sessions/${session.id}?t=${session.token}`
);
const { session: paidSession } = await response.json();
```

Before marking the local order paid, confirm that:

- The StorePay session status is `funded` or `claimed`.
- The funded transaction signature exists.
- The amount and currency match the local order.
- `merchantOrderId` matches the local order reference.

## 6. Payment lifecycle

1. The customer starts InPay or Client Pay from your client application.
2. The customer connects a wallet and approves the transaction.
3. StorePay secures the funds in on-chain escrow and reports the paid session.
4. The client website verifies the session server-side before marking its local order paid.
5. The merchant fulfils the order; the buyer confirms delivery before settlement.

## 7. Reference implementation

[Shop App](https://github.com/elhussienalmasri/store-pay/tree/shop-app) is the reference client application. It implements both InPay and the Client Pay popup, including server-created sessions and server-side payment verification.


## Security checklist

- Use `pk_...` publishable keys only in browser code.
- Keep `sk_...` secret keys only in server or serverless environment variables.
- Register the production client application domain in StorePay.
- Verify payment server-side before fulfilling an order or releasing goods.
