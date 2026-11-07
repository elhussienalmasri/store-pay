import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Package,
  Receipt,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Panel } from './WidgetUi';

function StatCard({ label, value, detail, accent = '#14F195' }) {
  return (
    <div className="rounded-2xl bg-[#0e1017] border border-[#1e2233] p-4">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-2xl font-black text-white mt-1">{value}</p>
      {detail && <p className="text-[11px] mt-0.5" style={{ color: accent }}>{detail}</p>}
    </div>
  );
}

export function OverviewPanel({ merchant, stats, products, onNavigate }) {
  const counts = stats?.counts || {};
  const steps = [
    {
      id: 'products',
      title: 'Add your first product',
      detail: 'Prices are stored on the server so checkout amounts cannot be tampered with.',
      done: products.length > 0,
      action: 'Open catalog',
    },
    {
      id: 'widget',
      title: 'Copy the embed snippet',
      detail: 'Paste the script and button into your storefront, or create a payment link.',
      done: false,
      action: 'Open widget studio',
    },
    {
      id: 'orders',
      title: 'Claim your first payment',
      detail: 'Connect the payout wallet and settle escrow orders from the Orders tab.',
      done: (counts.claimed || 0) > 0,
      action: 'View orders',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Orders" value={counts.total || 0} detail="all time" />
        <StatCard
          label="In escrow"
          value={counts.funded || 0}
          detail={counts.funded ? 'waiting to claim' : 'nothing pending'}
          accent="#fbbf24"
        />
        <StatCard
          label="Settled"
          value={stats?.settledDisplay || '0 SOL'}
          detail={`${counts.claimed || 0} payments`}
        />
        <StatCard
          label="Products"
          value={products.length}
          detail={`${products.filter((product) => product.active).length} active`}
          accent="#c4a3ff"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 items-start">
        <Panel className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">Launch checklist</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Three steps to your first escrow-protected payment.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-[#9945FF]/10 border border-[#9945FF]/30">
              <ShieldCheck className="w-4 h-4 text-[#c4a3ff]" />
            </div>
          </div>

          <div className="space-y-2">
            {steps.map((step) => (
              <button
                key={step.id}
                onClick={() => onNavigate(step.id)}
                className="w-full text-left rounded-2xl bg-[#0e1017] border border-[#1e2233] hover:border-[#3a405c] p-3.5 flex items-start gap-3 transition"
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    step.done
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-[#181b28] text-gray-500'
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <span className="text-[10px] font-bold">•</span>
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-white">{step.title}</span>
                  <span className="block text-[11px] text-gray-500 mt-0.5">
                    {step.detail}
                  </span>
                </span>
                <span className="text-[10px] font-semibold text-[#14F195] flex items-center gap-0.5 shrink-0 mt-1">
                  {step.action}
                  <ArrowRight className="w-3 h-3" />
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#14F195]" />
              Store snapshot
            </h3>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Store</span>
                <span className="text-gray-200 font-semibold">{merchant.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Plan</span>
                <span className="text-gray-200 capitalize">{merchant.plan}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Payout wallet</span>
                <span className="font-mono text-gray-300">
                  {merchant.payoutWallet.slice(0, 4)}…{merchant.payoutWallet.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Domains</span>
                <span className="text-gray-300 text-right">
                  {(merchant.domains || []).join(', ')}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Mode</span>
                <span className="text-gray-200 capitalize">
                  {merchant.config?.mode === 'both'
                    ? 'escrow or instant'
                    : merchant.config?.mode || 'escrow'}
                </span>
              </div>
            </div>
          </Panel>

          <Panel className="space-y-3">
            <h3 className="text-sm font-bold text-white">Quick actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onNavigate('products')}
                className="rounded-xl bg-[#181b28] border border-[#2a2f45] p-3 text-left hover:border-[#3a405c]"
              >
                <Package className="w-4 h-4 text-[#14F195] mb-1.5" />
                <span className="block text-[11px] font-semibold text-white">
                  Add product
                </span>
              </button>
              <button
                onClick={() => onNavigate('widget')}
                className="rounded-xl bg-[#181b28] border border-[#2a2f45] p-3 text-left hover:border-[#3a405c]"
              >
                <Code2 className="w-4 h-4 text-[#c4a3ff] mb-1.5" />
                <span className="block text-[11px] font-semibold text-white">
                  Get snippet
                </span>
              </button>
              <button
                onClick={() => onNavigate('orders')}
                className="rounded-xl bg-[#181b28] border border-[#2a2f45] p-3 text-left hover:border-[#3a405c]"
              >
                <Receipt className="w-4 h-4 text-amber-400 mb-1.5" />
                <span className="block text-[11px] font-semibold text-white">
                  View orders
                </span>
              </button>
              <button
                onClick={() => onNavigate('settings')}
                className="rounded-xl bg-[#181b28] border border-[#2a2f45] p-3 text-left hover:border-[#3a405c]"
              >
                <Wallet className="w-4 h-4 text-cyan-400 mb-1.5" />
                <span className="block text-[11px] font-semibold text-white">
                  Payout settings
                </span>
              </button>
            </div>
            {counts.funded > 0 && (
              <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
                {counts.funded} payment{counts.funded === 1 ? '' : 's'} waiting in
                escrow. Claim from the Orders tab to settle.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
