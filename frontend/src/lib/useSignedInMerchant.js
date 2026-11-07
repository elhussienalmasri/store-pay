import { useCallback, useEffect, useState } from 'react';
import {
  clearStoredSecret,
  getMerchant,
  getSession,
  getStoredSecret,
  logoutMerchant,
} from './merchantApi';

export function useSignedInMerchant(initialSignedIn = false) {
  const [signedIn, setSignedIn] = useState(initialSignedIn);
  const [hasStoredKey, setHasStoredKey] = useState(false);

  useEffect(() => {
    setHasStoredKey(Boolean(getStoredSecret()));
  }, []);

  useEffect(() => {
    if (signedIn) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const session = await getSession();
        if (!cancelled && session?.merchant) {
          setSignedIn(true);
          return;
        }
      } catch (err) {
        // Fall through to the stored-key check below.
      }

      const stored = getStoredSecret();
      if (!stored) {
        if (!cancelled) setHasStoredKey(false);
        return;
      }
      try {
        const data = await getMerchant(stored);
        if (cancelled) return;
        if (data?.merchant) setSignedIn(true);
        else setHasStoredKey(false);
      } catch (err) {
        if (!cancelled) setHasStoredKey(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const signOut = useCallback(async () => {
    clearStoredSecret();
    try {
      await logoutMerchant();
    } catch (err) {
      console.warn('Failed to clear session:', err);
    }
    setSignedIn(false);
    setHasStoredKey(false);
  }, []);

  return { signedIn: signedIn || hasStoredKey, signOut };
}
