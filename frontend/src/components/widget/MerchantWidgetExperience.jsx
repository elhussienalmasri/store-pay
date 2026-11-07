import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  Code2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Package,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  clearStoredSecret,
  getMerchant,
  getStoredSecret,
} from '../../lib/merchantApi';
import { MerchantOnboarding } from './MerchantOnboarding';
import { OverviewPanel } from './OverviewPanel';
import { ProductsPanel } from './ProductsPanel';
import { WidgetConfigPanel } from './WidgetConfigPanel';
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
  { id: 'widget', label: 'Widget', icon: Code2 },
  { id: 'orders', label: 'Orders', icon: Receipt },
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
    const stored = getStoredSecret();
    setSecret(stored);
    setReady(true);

    if (!stored) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getMerchant(stored)
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setError('');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          clearStoredSecret();
          setSecret(null);
          setError('Your saved merchant key is no longer valid. Create a store or paste a key again.');
        } else {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!secret) return;
    setLoading(true);
    try {
      const payload = await getMerchant(secret);
      setData(payload);
      setError('');
    } catch (err) {
      if (err.status === 401) {
        clearStoredSecret();
        setSecret(null);
        setData(null);
        setError('Your saved merchant key is no longer valid. Create a store or paste a key again.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [secret]);

  function handleSignOut() {
    clearStoredSecret();
    setSecret(null);
    setData(null);
    setError('');
    setSection('overview');
  }

  async function handleOnboarded(merchant, secretKey) {
    setSecret(secretKey);
    setError('');
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

  if (!ready) {
    return <CenteredLoader label="Loading merchant workspace…" />;
  }

  if (!secret) {
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

  if (!data) {
    if (loading) {
      return (
        <Panel className="max-w-xl mx-auto">
          <CenteredLoader label="Opening your store…" />
        </Panel>
      );
    }
    return (
      <Panel className="max-w-xl mx-auto space-y-4 text-center">
        <AlertTriangle className="w-9 h-9 text-amber-400 mx-auto" />
        <h2 className="text-lg font-black text-white">Could not load your store</h2>
        <p className="text-xs text-gray-400 break-words">{error || 'Unknown error'}</p>
        <div className="flex justify-center gap-2">
          <button
            onClick={refresh}
            className="px-4 h-10 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-xs font-bold"
          >
            Try again
          </button>
          <button
            onClick={handleSignOut}
            className="px-4 h-10 rounded-xl bg-[#181b28] border border-[#2a2f45] text-xs font-semibold text-gray-300"
          >
            Use another key
          </button>
        </div>
      </Panel>
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
                  <span>{products.length} product(s)</span>
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
            <button
              onClick={handleSignOut}
              className="p-2.5 rounded-xl bg-[#141624] border border-[#23273a] text-gray-400 hover:text-red-300"
              title="Sign out of this device"
            >
              <LogOut className="w-4 h-4" />
            </button>
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

      {activeSection === 'settings' && (
        <SettingsPanel
          secret={secret}
          merchant={merchant}
          onChanged={refresh}
          onSignOut={handleSignOut}
        />
      )}

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-gray-600 pb-2">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          Non-custodial escrow on Solana Devnet
        </span>
        <span>•</span>
        <span className="inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Prices and quotes are computed server-side
        </span>
      </div>
    </div>
  );
}
