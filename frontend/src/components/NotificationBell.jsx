import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Bell, CheckCheck, ShoppingBag, Trash2, X } from 'lucide-react';
import { getStoredSecret } from '../lib/merchantApi';

function timeAgo(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() || '';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  const request = useCallback(
    async (path, options = {}) => {
      const secret = getStoredSecret();
      const response = await fetch(path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
          ...(options.headers || {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      return data;
    },
    []
  );

  const load = useCallback(async () => {
    try {
      const data = await request(
        `/api/v1/notifications${wallet ? `?wallet=${encodeURIComponent(wallet)}` : ''}`
      );
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [request, wallet]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (!open || unread === 0) return;
    setUnread(0);
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    request('/api/v1/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ wallet }),
    }).catch(() => {});
  }, [open, unread, request, wallet]);

  async function handleDelete(id) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    try {
      await request(
        `/api/v1/notifications/${encodeURIComponent(id)}${
          wallet ? `?wallet=${encodeURIComponent(wallet)}` : ''
        }`,
        { method: 'DELETE' }
      );
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  async function handleClear() {
    if (!window.confirm('Clear all activity?')) return;
    setItems([]);
    setUnread(0);
    try {
      await request(
        `/api/v1/notifications${wallet ? `?wallet=${encodeURIComponent(wallet)}` : ''}`,
        { method: 'DELETE' }
      );
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative inline-flex p-2.5 rounded-xl bg-[#141624] border border-[#23273a] text-gray-400 hover:text-white transition"
        title="Activity"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#14F195] text-[#0b0c12] text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[#23273a] bg-[#0d0e14] shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#1e2233]">
            <span className="text-xs font-bold text-white">Activity</span>
            <div className="flex items-center gap-1">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-gray-400 hover:text-red-300 hover:bg-white/5"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-[11px] text-gray-500">
                No activity yet. Orders and payments will show up here.
              </p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-start gap-2.5 px-3.5 py-2.5 border-b border-[#171b28] last:border-0 hover:bg-white/[0.03]"
                >
                  <span className="mt-0.5 w-7 h-7 shrink-0 rounded-lg bg-purple-500/15 text-[#c4a3ff] flex items-center justify-center">
                    {item.read ? (
                      <CheckCheck className="w-3.5 h-3.5" />
                    ) : (
                      <ShoppingBag className="w-3.5 h-3.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-white leading-snug">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-gray-400 leading-snug mt-0.5 break-words">
                      {item.body}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-1">
                      {timeAgo(item.createdAt)}
                      {item.email?.sent ? ' · emailed' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-500 hover:text-red-300"
                    title="Delete"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {error && (
            <p className="px-3.5 py-2 text-[10px] text-red-300 border-t border-[#1e2233]">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
