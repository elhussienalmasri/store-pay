import React from 'react';
import { Zap } from 'lucide-react';
import { BrandName } from './BrandName';

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-[#1b1f30] bg-[#0d0e14] py-6 text-[11px] text-gray-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center gap-2">
        <Zap className="w-3.5 h-3.5 text-[#14F195] fill-current" />
        <BrandName className="font-semibold text-gray-300" />
        <span>·</span>
        <span>Solana Devnet</span>
      </div>
    </footer>
  );
}
