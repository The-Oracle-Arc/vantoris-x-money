import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency } from '@/lib/formatCurrency';
import OperationsPageLayout from '@/components/vantoris/OperationsPageLayout';
import { ArrowLeftRight } from 'lucide-react';

export default function Transfers() {
  const [transactions, setTransactions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyRequestId, setBusyRequestId] = useState(null);

  async function actOnRequest(requestId, action) {
    const note = action === 'reject' ? (window.prompt('Reason for rejection (required):') || '').trim() : (window.prompt('Review note (optional):') || '').trim();
    if (action === 'reject' && !note) return;
    setBusyRequestId(requestId);
    try {
      await base44.functions.invoke('reviewTransferRequest', { request_id: requestId, action, note });
      const refreshed = await base44.entities.TransferRequest.list('-created_date', 200);
      setRequests(refreshed);
    } catch (error) {
      window.alert(error?.message || 'The review action could not be recorded. No bank transfer was executed.');
    } finally { setBusyRequestId(null); }
  }

  useEffect(() => {
    (async () => {
      try {
        const [txns, transferRequests] = await Promise.all([
          base44.entities.Transaction.list('-created_date', 200),
          base44.entities.TransferRequest.list('-created_date', 200),
        ]);
        setTransactions(txns.filter(t => t.type === 'adjustment'));
        setRequests(transferRequests);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  return (
    <OperationsPageLayout title="Transfers" description="Internal transfers and balance adjustments" icon={ArrowLeftRight}>
      <section className="vantoris-card p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div><h2 className="text-white font-semibold">Bank transfer requests</h2><p className="text-[#AAB4C3] text-xs mt-1">ACH and domestic Fedwire · member requests only</p></div>
          <span className="text-xs text-[#AAB4C3]">{requests.length} total</span>
        </div>
        {loading ? <p className="text-[#AAB4C3] text-sm">Loading requests…</p> : requests.length === 0 ? (
          <p className="text-[#AAB4C3] text-sm">No bank transfer requests recorded.</p>
        ) : (
          <div className="space-y-3">{requests.map(r => (
            <article key={r.id} className="rounded-xl border border-[#2B3543] p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-white font-semibold text-sm">{r.rail} · {r.beneficiary_name || 'Beneficiary not supplied'}</p><p className="text-[#AAB4C3] text-xs mt-1">{r.beneficiary_bank_name || 'Bank not supplied'} · •••• {r.beneficiary_account_last4 || '----'}</p><p className="text-[#AAB4C3] text-[11px] mt-1">{r.user_id} · {r.created_date ? new Date(r.created_date).toLocaleString() : 'Date unavailable'}</p></div>
                <div className="text-right shrink-0"><p className="text-white font-semibold">{formatCurrency((r.amount_cents || 0)/100)}</p><span className="inline-block mt-1 rounded-full bg-amber-500/10 text-amber-300 px-2 py-1 text-[10px] uppercase">{r.status}</span></div>
              </div>
              <p className="mt-3 text-xs text-amber-300">Not submitted to bank. Review and separate approvals required.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status === 'awaiting_bank_review' && <button disabled={busyRequestId === r.id} onClick={() => actOnRequest(r.id, 'review')} className="rounded-lg bg-sky-500/15 text-sky-200 px-3 py-2 text-xs font-semibold disabled:opacity-50">Mark reviewed</button>}
                {r.status === 'awaiting_dual_approval' && <button disabled={busyRequestId === r.id} onClick={() => actOnRequest(r.id, 'approve_second')} className="rounded-lg bg-emerald-500/15 text-emerald-200 px-3 py-2 text-xs font-semibold disabled:opacity-50">Second wire approval</button>}
                {['awaiting_bank_review', 'awaiting_dual_approval'].includes(r.status) && <button disabled={busyRequestId === r.id} onClick={() => actOnRequest(r.id, 'reject')} className="rounded-lg bg-red-500/15 text-red-200 px-3 py-2 text-xs font-semibold disabled:opacity-50">Reject</button>}
              </div>
            </article>
          ))}</div>
        )}
      </section>
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-brass/30 border-t-brass rounded-full animate-spin" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="vantoris-card p-12 text-center">
          <ArrowLeftRight size={32} className="text-[#AAB4C3] mx-auto mb-3 opacity-50" />
          <p className="text-white font-medium mb-1">No transfers recorded</p>
          <p className="text-[#AAB4C3] text-sm">Internal transfers and adjustments will appear here.</p>
        </div>
      ) : (
        <div className="vantoris-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#242D38] bg-[#1a2535]">
                <th className="text-left text-[#AAB4C3] text-xs font-medium uppercase tracking-wider px-5 py-3">Date</th>
                <th className="text-left text-[#AAB4C3] text-xs font-medium uppercase tracking-wider px-5 py-3">Description</th>
                <th className="text-left text-[#AAB4C3] text-xs font-medium uppercase tracking-wider px-5 py-3">Reference</th>
                <th className="text-right text-[#AAB4C3] text-xs font-medium uppercase tracking-wider px-5 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="border-b border-[#242D38]/40 hover:bg-[#242D38]/20 transition-all">
                  <td className="px-5 py-3 text-[#AAB4C3] text-xs">{(t.transaction_date || t.created_date).split('T')[0]}</td>
                  <td className="px-5 py-3 text-white text-xs">{t.description || '—'}</td>
                  <td className="px-5 py-3 text-[#AAB4C3] text-xs font-mono">{t.reference || '—'}</td>
                  <td className={`px-5 py-3 text-right font-semibold text-xs ${t.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OperationsPageLayout>
  );
}