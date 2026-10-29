import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency } from '@/lib/formatCurrency';
import OperationsPageLayout from '@/components/vantoris/OperationsPageLayout';
import { ArrowLeftRight } from 'lucide-react';

export default function Transfers() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const txns = await base44.entities.Transaction.list('-created_date', 200);
        setTransactions(txns.filter(t => t.type === 'adjustment'));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  return (
    <OperationsPageLayout title="Transfers" description="Internal transfers and balance adjustments" icon={ArrowLeftRight}>
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