import React from 'react';
import Link from 'next/link';
import { ArrowLeftRight, ShoppingBag, Store } from 'lucide-react';

export const PLATFORM_TABS = [
  { id: 'widgets', label: 'Widgets', href: '/merchant', icon: Store },
  { id: 'marketplace', label: 'Marketplace', href: '/marketplace', icon: ShoppingBag },
  { id: 'escrow', label: 'Escrow', href: '/escrow', icon: ArrowLeftRight },
];

export function PlatformNav({ active, compact = false, hideLabelsOnMobile = false, className = '' }) {
  return (
    <nav
      className={`flex items-center gap-1 p-1 bg-[#12141f] border border-[#212538] rounded-xl ${className}`}
    >
      {PLATFORM_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-lg font-semibold transition whitespace-nowrap ${
              compact ? 'px-2.5 py-2 text-[11px]' : 'px-3.5 py-2 text-xs'
            } ${
              isActive
                ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className={hideLabelsOnMobile ? 'hidden sm:inline' : ''}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
