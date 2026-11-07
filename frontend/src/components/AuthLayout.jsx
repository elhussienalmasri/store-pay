import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Shield, Zap } from 'lucide-react';
import { PROGRAM_ID_STRING, getExplorerUrl } from '../lib/constants';

export function AuthLayout({ title, children }) {
  return (
    <>
      <Head>
        <title>{`${title} · EscrowPay`}</title>
        <meta
          name="description"
          content="EscrowPay merchant accounts: manage escrow-protected Solana payments and widget settings."
        />
      </Head>

      <div className="min-h-screen bg-[#0b0c10] text-[#e0e2ec] flex flex-col relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#9945FF]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -left-24 w-[28rem] h-[28rem] rounded-full bg-[#14F195]/10 blur-3xl" />

        <header className="relative z-10 border-b border-[#202436] bg-[#0b0c12]/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#9945FF] to-[#14F195] p-[1.5px]">
                <div className="w-full h-full bg-[#0d0e15] rounded-[9px] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#14F195] fill-current" />
                </div>
              </div>
              <span className="text-sm font-black text-white">EscrowPay</span>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/app"
                className="px-3 py-2 rounded-xl text-[11px] font-semibold text-gray-400 hover:text-white"
              >
                Escrow app
              </Link>
              <Link
                href="/signup"
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-[11px] font-bold"
              >
                Get started
              </Link>
            </div>
          </div>
        </header>

        <main className="relative z-10 flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-12">
          {children}
        </main>

        <footer className="relative z-10 border-t border-[#1b1f30] bg-[#0d0e14] py-5 text-[11px] text-gray-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#14F195]" />
              Program
            </span>
            <a
              href={getExplorerUrl('address', PROGRAM_ID_STRING)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-purple-400 hover:underline"
            >
              {PROGRAM_ID_STRING.slice(0, 4)}…{PROGRAM_ID_STRING.slice(-4)}
            </a>
            <span>•</span>
            <span>Solana Devnet</span>
          </div>
        </footer>
      </div>
    </>
  );
}
