import React from 'react';
import { CheckCircle2, XCircle, Loader2, ExternalLink, ShieldCheck } from 'lucide-react';
import { getExplorerUrl } from '../lib/constants';

export function TransactionModal({ isOpen, status, title, message, txSignature, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md p-6 bg-[#141622] border border-[#262a3d] rounded-2xl shadow-2xl text-center glow-solana">
        {/* Status Icon */}
        <div className="flex justify-center mb-4">
          {status === 'signing' && (
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/30">
                <ShieldCheck className="w-8 h-8 animate-pulse" />
              </div>
            </div>
          )}

          {status === 'confirming' && (
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/30">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          )}

          {status === 'error' && (
            <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/30">
              <XCircle className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-2">
          {title || (
            status === 'signing' ? 'Approve in your wallet' :
            status === 'confirming' ? 'Confirming on Devnet' :
            status === 'success' ? 'Transaction Confirmed' :
            'Transaction Failed'
          )}
        </h3>

        {/* Message */}
        <p className="text-sm text-gray-300 mb-5 leading-relaxed break-words">
          {message || (
            status === 'signing' ? 'Please review and approve the transaction in your wallet.' :
            status === 'confirming' ? 'Broadcasting to Solana Devnet validators. Usually takes 1–3 seconds.' :
            status === 'success' ? 'Your escrow instruction has been executed and confirmed on-chain!' :
            'An error occurred while executing the transaction.'
          )}
        </p>

        {/* Explorer Link if available */}
        {txSignature && (
          <div className="mb-6 p-3 bg-[#0d0e15] border border-[#212435] rounded-xl text-left">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Transaction Signature</div>
            <a
              href={getExplorerUrl('tx', txSignature)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-xs font-mono text-[#14F195] hover:underline break-all"
            >
              <span>{txSignature.slice(0, 16)}...{txSignature.slice(-16)}</span>
              <ExternalLink className="w-3.5 h-3.5 ml-2 shrink-0" />
            </a>
          </div>
        )}

        {/* Action Button */}
        {(status === 'success' || status === 'error') && (
          <button
            onClick={onClose}
            className="w-full py-3 px-4 font-semibold text-sm rounded-xl transition duration-200 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white hover:opacity-95 active:scale-[0.98]"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
