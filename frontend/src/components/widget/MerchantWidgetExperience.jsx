import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  Code2,
  LayoutDashboard,
  Loader2,
  Package,
  PlusCircle,
  Receipt,
  RefreshCw,
  Settings,
  Zap,
} from 'lucide-react';
import {
  clearStoredSecret,
  getMerchant,
  getStoredSecret,
  logoutMerchant,
} from '../../lib/merchantApi';
import { OverviewPanel } from './OverviewPanel';
import { ProductsPanel } from './ProductsPanel';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import { MerchantOnboarding } from './MerchantOnboarding';
import { OrdersPanel } from './OrdersPanel';
import { SettingsPanel } from './SettingsPanel';
import { CopyButton, Panel } from './WidgetUi';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'widget', label: 'Payment', icon: Code2 },
  { id: 'orders', label: 'Orders', icon: Receipt },
  { id: 'create-store', label: 'Widget Payment', icon: PlusCircle },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function CenteredLoader({ label }) {
  return (
    <div className="py-20 flex flex-col items-center justify-center gap-3 text-sm text-gray-500">
      <Loader2 className="w-6 h-6 animate-spin text-[#14F195]" />
      {label}
    </div>
  );
}

export function MerchantWidgetExperience() {
  const [secret, setSecret] = useState(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState('overview');

  useEffect(() => {
    let cancelled = false;
    const stored = getStoredSecret();
    setSecret(stored);
    setLoading(true);

    (async () => {
      try {
        let payload;
        try {
          payload = await getMerchant(stored || undefined);
        } catch (err) {
          // A stale local key should not hide a valid session cookie.
          if (err.status === 401 && stored) {
            clearStoredSecret();
            if (!cancelled) setSecret(null);
            payload = await getMerchant();
          } else {
            throw err;
          }
        }
        if (cancelled) return;
        setData(payload);
        setError('');
      } catch (err) {
        if (cancelled) return;
        if (err.status === 401) {
          if (stored) {
            clearStoredSecret();
            setSecret(null);
          }
          setError('');
        } else {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      let payload;
      try {
        payload = await getMerchant(secret || undefined);
      } catch (err) {
        if (err.status === 401 && secret) {
          clearStoredSecret();
          setSecret(null);
          payload = await getMerchant();
        } else {
          throw err;
        }
      }
      setData(payload);
      setError('');
    } catch (err) {
      if (err.status === 401) {
        clearStoredSecret();
        setSecret(null);
        setData(null);
        setError('');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [secret]);

  async function handleSecretChanged(newSecret) {
    setSecret(newSecret);
    setLoading(true);
    try {
      const payload = await getMerchant(newSecret);
      setData(payload);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOnboarded(merchant, secretKey) {
    setSecret(secretKey);
    setError('');
    setSection('overview');
    setLoading(true);
    try {
      const payload = await getMerchant(secretKey);
      setData(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    clearStoredSecret();
    try {
      await logoutMerchant();
    } catch (err) {
      console.warn('Failed to clear session:', err);
    }
    setSecret(null);
    setData(null);
    setError('');
    setSection('overview');
  }

  if (!ready) {
    return <CenteredLoader label="Loading merchant workspace…" />;
  }

  if (!data) {
    if (loading) {
      return (
        <Panel className="max-w-xl mx-auto">
          <CenteredLoader label="Opening your store…" />
        </Panel>
      );
    }
    return (
      <div className="space-y-5">
        {error && (
          <div className="max-w-xl mx-auto rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        <MerchantOnboarding onReady={handleOnboarded} />
      </div>
    );
  }

  const { merchant, products, stats } = data;
  const activeSection = SECTIONS.some((item) => item.id === section)
    ? section
    : 'overview';

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-3xl border border-[#23273a] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9945FF] to-[#14F195] p-[1.5px] shrink-0">
                <div className="w-full h-full bg-[#0d0e15] rounded-[10px] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#14F195] fill-current" />
                </div>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-black text-white truncate">
                  {merchant.name}
                </h2>
                <p className="text-[11px] text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="capitalize">{merchant.plan} plan</span>
                  <span>•</span>
                  <span>{products.length} item(s)</span>
                  <span>•</span>
                  <span>{stats?.counts?.funded || 0} awaiting claim</span>
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-gray-500">Publishable key</span>
              <code className="font-mono text-gray-300 bg-[#0e1017] border border-[#23273a] px-2 py-1 rounded-lg">
                {merchant.publishableKey}
              </code>
              <CopyButton value={merchant.publishableKey} label="Copy" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSection('widget')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 h-10 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-xs font-bold"
            >
              <Code2 className="w-3.5 h-3.5" />
              Payment
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="p-2.5 rounded-xl bg-[#141624] border border-[#23273a] text-gray-400 hover:text-white disabled:opacity-50"
              title="Refresh merchant data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#14F195]' : ''}`} />
            </button>
            <div className="solana-wallet-custom">
              <WalletMultiButton className="!bg-[#1a1d2b] !border !border-[#2b3048] !text-white !font-semibold !text-xs !rounded-xl !h-10 !px-4" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-0.5">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  active
                    ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12]'
                    : 'bg-[#12141f] border border-[#212538] text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {activeSection === 'overview' && (
        <OverviewPanel
          merchant={merchant}
          stats={stats}
          products={products}
          onNavigate={setSection}
        />
      )}

      {activeSection === 'products' && (
        <ProductsPanel
          secret={secret}
          products={products}
          onChanged={refresh}
        />
      )}

      {activeSection === 'widget' && (
        <WidgetConfigPanel
          secret={secret}
          merchant={merchant}
          products={products}
          onChanged={refresh}
        />
      )}

      {activeSection === 'orders' && (
        <OrdersPanel
          secret={secret}
          merchant={merchant}
          onChanged={refresh}
        />
      )}

      {activeSection === 'create-store' && (
        <MerchantOnboarding onReady={handleOnboarded} />
      )}

      {activeSection === 'settings' && (
        <SettingsPanel
          secret={secret}
          merchant={merchant}
          onChanged={refresh}
          onSignOut={handleSignOut}
          onSecretChanged={handleSecretChanged}
        />
      )}

    </div>
  );
}
