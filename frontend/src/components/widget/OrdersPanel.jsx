import React, { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { listOrders } from '../../lib/merchantApi';
import {
  claimPayment,
  describeWalletError,
} from '../../lib/widgetCheckout';
import { getExplorerUrl } from '../../lib/constants';
import { CopyButton, Panel } from './WidgetUi';
import { StatusBadge } from './WidgetUi';

function shorten(value, size = 4) {
  if (!value) return '';
  return `${value.slice(0, size)}…${value.slice(-size)}`;
}

export function OrdersPanel({ secret, merchant, onChanged }) {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();

  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claimingId, setClaimingId] = useState(null);
  const [lastClaim, setLastClaim] = useState(null);

  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const data = await listOrders(secret);
        setOrders(data.orders || []);
        setStats(data.stats || null);
        setError('');
      } catch (err) {
        if (!silent) setError(err.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [secret]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => load(true), 20_000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleClaim(order) {
    if (!publicKey) return;
    setClaimingId(order.id);
    setError('');
    setLastClaim(null);
    try {
      const result = await claimPayment({
        connection,
        publicKey,
        sendTransaction,
        session: order,
        secretKey: secret,
      });
      setLastClaim({ orderId: order.id, signature: result.signature });
      await load(true);
      if (onChanged) await onChanged();
    } catch (err) {
      setError(describeWalletError(err));
    } finally {
      setClaimingId(null);
    }
  }

  const walletMismatch =
    connected &&
    publicKey &&
    orders.some(
      (order) =>
        order.canClaim && order.payoutWallet !== publicKey.toBase58()
    );

  return (
    <div className="space-y-5">
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Orders</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Escrow payments appear here the moment a buyer funds them. Claim to
              settle and unwrap to SOL.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {stats && (
              <span className="text-[11px] text-gray-500">
                {stats.counts.funded} in escrow · {stats.counts.claimed} settled
              </span>
            )}
            <button
              onClick={() => load()}
              className="p-2 rounded-xl bg-[#181b28] border border-[#2a2f45] text-gray-300 hover:text-white"
              title="Refresh orders"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-[#0e1017] border border-[#1e2233] p-3 text-[11px] text-gray-400 flex items-start gap-2">
          <Wallet className="w-3.5 h-3.5 text-[#14F195] shrink-0 mt-0.5" />
          <span>
            Connect the payout wallet used for the order to claim. The claim
            transaction also unwraps all WSOL in that wallet back to native SOL.
          </span>
        </div>

        {walletMismatch && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            A funded order belongs to a different payout wallet (
            {shorten(
              orders.find(
                (order) =>
                  order.canClaim && order.payoutWallet !== publicKey?.toBase58()
              )?.payoutWallet,
              6
            )}
            ). Connect that wallet to claim it.
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 break-words">
            {error}
          </div>
        )}

        {lastClaim && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[11px] text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Payment settled.</span>
            <a
              href={getExplorerUrl('tx', lastClaim.signature)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline flex items-center gap-0.5"
            >
              View transaction <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        )}

        {loading && orders.length === 0 ? (
          <div className="py-12 flex items-center justify-center gap-2 text-xs text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2a2f45] p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-white">No orders yet</p>
            <p className="text-xs text-gray-500">
              Create a payment link in the Payment tab or embed the snippet on
              your storefront to take the first escrow payment.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => {
              const canClaimHere =
                order.canClaim && publicKey?.toBase58() === order.payoutWallet;
              const reference =
                order.signatures?.claimed ||
                order.signatures?.funded ||
                order.signatures?.paid;
              return (
                <div
                  key={order.id}
                  className="rounded-2xl bg-[#0e1017] border border-[#1e2233] p-3.5 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white">
                          {order.productName}
                        </p>
                        <StatusBadge status={order.status} />
                        {order.mode === 'direct' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#181b28] border border-[#2a2f45] text-gray-400">
                            instant
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {new Date(order.createdAt).toLocaleString()} ·{' '}
                        {order.pricing.display} → {order.settlement.display}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500 mt-1 font-mono">
                        <span>order {shorten(order.id, 6)}</span>
                        {order.buyer && <span>buyer {shorten(order.buyer, 4)}</span>}
                        <span>
                          payout {shorten(order.payoutWallet, 4)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {reference && (
                        <a
                          href={getExplorerUrl('tx', reference)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                          title="View transaction"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {order.canClaim && (
                        <button
                          onClick={() => handleClaim(order)}
                          disabled={!canClaimHere || claimingId === order.id}
                          title={
                            canClaimHere
                              ? 'Claim payment and unwrap to SOL'
                              : `Connect ${order.payoutWallet} to claim`
                          }
                          className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-[11px] font-bold disabled:opacity-40 flex items-center gap-1.5"
                        >
                          {claimingId === order.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          {claimingId === order.id ? 'Claiming…' : 'Claim payment'}
                        </button>
                      )}
                    </div>
                  </div>

                  {order.canClaim && !canClaimHere && (
                    <div className="text-[10px] text-amber-300/80 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" />
                      Connect {shorten(order.payoutWallet, 6)} to claim this order.
                      <CopyButton value={order.payoutWallet} label="Copy address" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
