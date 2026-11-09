import { useEffect, useRef, useState } from 'react';

const CLIENT_PAY_CALLBACK = '__shopAppClientPaySuccess';

export function ClientPay({ origin, payment, onPaid, onError }) {
  const host = useRef(null);
  const handlers = useRef({});
  const paymentRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  handlers.current = { onPaid, onError };
  paymentRef.current = payment;

  useEffect(() => {
    const node = host.current;
    if (!origin) return undefined;
    const script = document.createElement('script');
    script.src = `${origin}/widget/v1.js`;
    script.async = true;
    script.onload = () => {
      if (typeof window.EscrowPay?.open !== 'function') {
        handlers.current.onError?.('Client Pay could not start. Reload the page and try again.');
        return;
      }
      setLoaded(true);
    };
    script.onerror = () => handlers.current.onError?.('Client Pay could not load. Check your connection and reload the page.');
    node.appendChild(script);
    return () => {
      script.remove();
    };
  }, [origin]);

  useEffect(() => {
    if (!payment || !loaded) return undefined;
    let active = true;
    window[CLIENT_PAY_CALLBACK] = () => {
      const current = paymentRef.current;
      if (active && current) handlers.current.onPaid?.(current);
    };
    try {
      window.EscrowPay.open({
        checkoutUrl: payment.session.checkoutUrl,
        onSuccessName: CLIENT_PAY_CALLBACK,
      });
    } catch (error) {
      handlers.current.onError?.(error.message || 'Client Pay could not open.');
    }
    return () => {
      active = false;
      if (window[CLIENT_PAY_CALLBACK]) delete window[CLIENT_PAY_CALLBACK];
    };
  }, [payment, loaded]);

  return <div ref={host} aria-hidden="true" style={{ display: 'none' }} />;
}
