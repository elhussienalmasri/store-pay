export function buildInPayWidgetExample({ escrowId, escrowOrigin }) {
  return `import { useEffect, useRef, useState } from 'react';

const ESCROW_ID = ${JSON.stringify(escrowId)};
const ESCROW_ORIGIN = ${JSON.stringify(escrowOrigin)};

// order = { amountMinor, currency, reference, description }
export default function EscrowPayInPay({ order }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const pay = useRef(null);
  const orderRef = useRef(order);

  orderRef.current = order;

  useEffect(() => {
    const host = document.getElementById('escrowpay-widget');
    const script = document.createElement('script');
    script.src = ESCROW_ORIGIN + '/inpay/v1.js?escrow_id=' + ESCROW_ID;
    script.async = true;
    script.dataset.target = 'escrowpay-widget';
    script.onload = () => {
      pay.current = window.EscrowPayInPay.pay;
      if (orderRef.current) pay.current(orderRef.current).then(({ session: paidSession }) => setSession(paidSession)).catch((paymentError) => setError(paymentError.message));
    };
    host.appendChild(script);
    return () => {
      host.replaceChildren();
      script.remove();
    };
  }, []);

  useEffect(() => {
    if (!order || !pay.current) return;
    pay.current(order).then(({ session: paidSession }) => setSession(paidSession)).catch((paymentError) => setError(paymentError.message));
  }, [order]);

  return (
    <>
      <div id="escrowpay-widget" />
      {session && <p>Payment received: {session.id}</p>}
      {error && <p>Payment not completed: {error}</p>}
    </>
  );
}
`;
}
