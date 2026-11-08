import React from 'react';

export function BrandName({ className = 'text-lg font-black tracking-tight text-white' }) {
  return (
    <span className={className}>
      Store<span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">Pay</span>
    </span>
  );
}
