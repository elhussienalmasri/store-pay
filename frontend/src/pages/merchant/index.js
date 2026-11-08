import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { LogOut, Zap } from 'lucide-react';
import { MerchantWidgetExperience } from '../../components/widget/MerchantWidgetExperience';
import { NotificationBell } from '../../components/NotificationBell';
import { PlatformNav } from '../../components/PlatformNav';
import { BrandName } from '../../components/BrandName';
import { SiteFooter } from '../../components/SiteFooter';
import { useSignedInMerchant } from '../../lib/useSignedInMerchant';

export default function MerchantPage({ signedIn: initialSignedIn = false }) {
  const { signedIn, signOut } = useSignedInMerchant(initialSignedIn);

  async function handleSignOut() {
    await signOut();
    window.location.reload();
  }

  return (
    <>
      <Head>
        <title>Widgets · StorePay</title>
        <meta
          name="description"
          content="Create an escrow payment widget, embed it on your storefront, and settle Solana payments."
        />
      </Head>

      <div className="min-h-screen flex flex-col bg-[#0b0c10] text-[#e0e2ec]">
        <header className="sticky top-0 z-40 border-b border-[#202436] bg-[#0b0c12]/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-16 flex items-center justify-between gap-3">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#9945FF] to-[#14F195] p-[1.5px]">
                  <div className="w-full h-full bg-[#0d0e15] rounded-[9px] flex items-center justify-center">
                    <Zap className="w-4 h-4 text-[#14F195] fill-current" />
                  </div>
                </div>
                <div>
                  <BrandName className="text-sm font-black text-white" />
                  <span className="hidden sm:inline text-[11px] text-gray-500 ml-2">
                    Widgets
                  </span>
                </div>
              </Link>

              <PlatformNav
                active="widgets"
                compact
                hideLabelsOnMobile
                className="hidden md:flex"
              />

              {signedIn ? (
                <>
                  <NotificationBell />
                  <button
                    onClick={handleSignOut}
                    className="inline-flex p-2.5 rounded-xl bg-[#141624] border border-[#23273a] text-gray-400 hover:text-red-300 transition"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <NotificationBell />
                  <Link
                    href="/login"
                    className="hidden sm:inline-flex px-3 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-flex items-center px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-xs font-bold hover:opacity-90 transition"
                  >
                    Get started
                  </Link>
                </div>
              )}
            </div>

            <div className="md:hidden flex justify-center pb-2">
              <PlatformNav active="widgets" compact />
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <MerchantWidgetExperience />
        </main>

        <SiteFooter />
      </div>
    </>
  );
}

export async function getServerSideProps({ req }) {
  let signedIn = false;
  try {
    const { merchantFromSession } = await import('../../lib/server/auth');
    const merchant = await merchantFromSession(req);
    signedIn = Boolean(merchant);
  } catch (err) {
    console.warn('[escrowpay] could not read widgets session:', err.message);
  }

  return { props: { signedIn } };
}
