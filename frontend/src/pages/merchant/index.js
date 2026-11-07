import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, Shield, Zap } from 'lucide-react';
import { MerchantWidgetExperience } from '../../components/widget/MerchantWidgetExperience';
import { PROGRAM_ID_STRING, getExplorerUrl } from '../../lib/constants';

export default function MerchantPage() {
  return (
    <>
      <Head>
        <title>Merchant Widget · EscrowPay</title>
        <meta
          name="description"
          content="Create an escrow payment widget, embed it on your storefront, and settle Solana payments."
        />
      </Head>

      <div className="min-h-screen bg-[#0b0c10] text-[#e0e2ec]">
        <header className="sticky top-0 z-40 border-b border-[#202436] bg-[#0b0c12]/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#9945FF] to-[#14F195] p-[1.5px]">
                <div className="w-full h-full bg-[#0d0e15] rounded-[9px] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#14F195] fill-current" />
                </div>
              </div>
              <div>
                <span className="text-sm font-black text-white">EscrowPay</span>
                <span className="hidden sm:inline text-[11px] text-gray-500 ml-2">
                  Merchant Widget
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={getExplorerUrl('address', PROGRAM_ID_STRING)}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300"
              >
                <Shield className="w-3.5 h-3.5" />
                Program
              </a>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#141624] border border-[#23273a] text-[11px] font-semibold text-gray-300 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Escrow app
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <MerchantWidgetExperience />
        </main>
      </div>
    </>
  );
}
