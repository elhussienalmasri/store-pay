import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { statusLabel } from '../../lib/widgetCore.mjs';

export const STATUS_STYLES = {
  open: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  prepared: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  funded: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  claimed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  refunded: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  paid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  expired: 'bg-red-500/10 text-red-300 border-red-500/30',
};

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
        STATUS_STYLES[status] || STATUS_STYLES.open
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}

export function CopyButton({ value, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181b28] hover:bg-[#222638] border border-[#2a2f45] text-[11px] font-semibold text-gray-300 transition ${className}`}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      {copied ? 'Copied' : label}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-gray-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full px-3 py-2.5 rounded-xl bg-[#0e1017] border border-[#242941] text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#9945FF]/70 focus:ring-1 focus:ring-[#9945FF]/30';

export function Panel({ children, className = '' }) {
  return (
    <div
      className={`glass-panel rounded-3xl border border-[#23273a] p-5 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}
