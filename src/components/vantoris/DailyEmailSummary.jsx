import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency } from '@/lib/formatCurrency';
import { Mail, Loader2, Check } from 'lucide-react';

export default function DailyEmailSummary() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [showInput, setShowInput] = useState(false);
  const [email, setEmail] = useState('');

  async function handleSend() {
    if (!email) return;
    setSending(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [accounts, transactions, withdrawals, serviceRequests, users] = await Promise.all([
        base44.entities.Account.list('-created_date', 200),
        base44.entities.Transaction.list('-created_date', 200),
        base44.entities.WithdrawalRequest.list('-created_date', 200),
        base44.entities.ServiceRequest.list('-created_date', 200),
        base44.entities.User.list('-created_date', 200),
      ]);

      const todayDeposits = transactions.filter(t => {
        const d = new Date(t.transaction_date || t.created_date);
        return d >= today && d < tomorrow && t.type === 'deposit';
      });
      const totalDeposits = todayDeposits.reduce((s, t) => s + Math.abs(t.amount || 0), 0);

      const todayWithdrawals = withdrawals.filter(w => {
        const d = new Date(w.created_date);
        return d >= today && d < tomorrow;
      });
      const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
      const totalPendingWithdrawals = pendingWithdrawals.reduce((s, w) => s + Math.abs(w.amount || 0), 0);

      const todayServiceRequests = serviceRequests.filter(r => {
        const d = new Date(r.created_date);
        return d >= today && d < tomorrow;
      });
      function getUserName(id) { return users.find(u => u.id === id)?.full_name || '—'; }

      const totalAum = accounts.reduce((s, a) => s + (a.balance || 0), 0);

      const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

      const subject = `Vantoris Daily Summary — ${dateStr}`;
      const depositsList = todayDeposits.length > 0
        ? todayDeposits.map(t => `  - ${formatCurrency(Math.abs(t.amount || 0))} · ${t.description || 'Deposit'}`).join('\n')
        : '  (none)';
      const withdrawalsList = todayWithdrawals.length > 0
        ? todayWithdrawals.map(w => `  - ${formatCurrency(Math.abs(w.amount || 0))} · ${w.method} · ${w.status}`).join('\n')
        : '  (none)';
      const serviceList = todayServiceRequests.length > 0
        ? todayServiceRequests.map(r => `  - ${r.service_type} · ${getUserName(r.user_id)}${r.details ? ' · ' + r.details.slice(0, 80) : ''}`).join('\n')
        : '  (none)';
      const body = `
VANTORIS — DAILY OPERATIONS SUMMARY
${dateStr}

═══════════════════════════════════════════════

NEW DEPOSITS (LAST 24H)
  Count:           ${todayDeposits.length}
  Total Amount:    ${formatCurrency(totalDeposits)}
${depositsList}

NEW WITHDRAWALS (LAST 24H)
  Count:           ${todayWithdrawals.length}
${withdrawalsList}

NEW SERVICE REQUESTS (LAST 24H)
  Count:           ${todayServiceRequests.length}
${serviceList}

PENDING WITHDRAWALS (ALL)
  Count:           ${pendingWithdrawals.length}
  Total Amount:    ${formatCurrency(totalPendingWithdrawals)}

TOTAL AUM:         ${formatCurrency(totalAum)}
  Active Accounts: ${accounts.filter(a => a.status === 'active').length}

═══════════════════════════════════════════════

This is an automated summary generated from the Vantoris Operations Center.
      `.trim();

      await base44.integrations.Core.SendEmail({
        to: email,
        subject,
        body,
        from_name: 'Vantoris Operations',
      });

      setResult({ deposits: totalDeposits, depositCount: todayDeposits.length, pendingCount: pendingWithdrawals.length, pendingTotal: totalPendingWithdrawals });
      setShowInput(false);
      setEmail('');
    } catch (e) {
      console.error(e);
      setResult({ error: e.message || 'Failed to send' });
    }
    setSending(false);
  }

  return (
    <div className="flex items-center gap-3">
      {result && !result.error && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
          <Check size={14} />
          <span>Sent: {result.depositCount} deposits ({formatCurrency(result.deposits)}), {result.pendingCount} pending withdrawals ({formatCurrency(result.pendingTotal)})</span>
        </div>
      )}
      {result?.error && (
        <span className="text-xs text-red-400">{result.error}</span>
      )}
      {showInput ? (
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="team@vantoris.com"
            className="bg-[#242D38] border border-[#242D38] rounded-xl px-3 py-2 text-white text-sm focus:border-brass/50 focus:outline-none w-56"
          />
          <button
            onClick={handleSend}
            disabled={!email || sending}
            className="flex items-center gap-1.5 px-3 py-2 bg-brass text-[#0E1A2B] rounded-xl text-xs font-semibold disabled:opacity-40"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            Send
          </button>
          <button
            onClick={() => setShowInput(false)}
            className="px-3 py-2 bg-[#242D38] text-[#AAB4C3] rounded-xl text-xs"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brass/15 text-brass rounded-xl text-sm font-medium hover:bg-brass/25 transition-all"
        >
          <Mail size={16} /> Daily Summary
        </button>
      )}
    </div>
  );
}