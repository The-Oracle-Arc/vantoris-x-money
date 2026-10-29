import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductShell from './ProductShell';
import { PROVIDERS, isConnected } from '@/lib/providers';
import { askPrivateModel, privateLlmConfigured } from '@/lib/privateLlm';

/**
 * Ask prepares money and flight actions. It executes only after an explicit
 * confirm, and only if the provider is connected. It never claims success
 * without a provider result.
 */
function parseSend(text) {
  const amount = text.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  const to = text.match(/\bto\s+([A-Za-z0-9 .@_-]{2,40})/i);
  if (!/send|transfer|pay/i.test(text) || !amount) return null;
  return { type: 'send', amount: Number(amount[1]), to: (to?.[1] || '').trim() || 'recipient not named' };
}

function parseFlight(text) {
  if (!/book|flight/i.test(text)) return null;
  const route = text.match(/([A-Za-z]{3})\s*(?:to|-)\s*([A-Za-z]{3})/i);
  return { type: 'flight', from: route?.[1]?.toUpperCase() || 'origin not set', to: route?.[2]?.toUpperCase() || 'destination not set' };
}

export default function Ask() {
  const [input, setInput] = useState('');
  const [log, setLog] = useState([]);
  const [draft, setDraft] = useState(null);

  const status = useMemo(
    () => Object.values(PROVIDERS).map((p) => `${p.label}: ${p.status}`),
    []
  );

  function push(role, text, extra) {
    setLog((prev) => [...prev, { role, text, ...extra }]);
  }

  async function ask() {
    const q = input.trim();
    if (!q) return;
    setInput('');
    push('you', q);
    const send = parseSend(q);
    const flight = parseFlight(q);
    if (send) {
      setDraft(send);
      push('vantoris', `Prepared send of $${send.amount.toFixed(2)} to ${send.to}. Nothing has been sent. Confirm to continue.`);
      return;
    }
    if (flight) {
      setDraft(flight);
      push('vantoris', `Prepared flight search ${flight.from} to ${flight.to}. Nothing is booked. Confirm to continue.`);
      return;
    }
    let text = 'I can prepare a send or a flight, or open Money, Cards, Travel, Homes, and HeroBox. I do not execute until you confirm.';
    if (privateLlmConfigured()) {
      try {
        const out = await askPrivateModel(q);
        if (out.text) text = out.text;
      } catch (e) {
        text = e.message || 'Private model unavailable.';
      }
    }
    push('vantoris', text);
  }

  function confirm() {
    if (!draft) return;
    if (draft.type === 'send') {
      if (!isConnected('payments')) {
        push('vantoris', `Not sent. Payments provider is not connected, so $${draft.amount.toFixed(2)} to ${draft.to} was not submitted.`, { to: '/move-money?action=send' });
      } else {
        push('vantoris', 'Payments provider is connected. Open Pay to authenticate and submit. This chat has not sent the money.', { to: '/move-money?action=send' });
      }
    }
    if (draft.type === 'flight') {
      if (!isConnected('flights')) {
        push('vantoris', `Not booked. No flight inventory provider is connected for ${draft.from} to ${draft.to}.`, { to: '/travel' });
      } else {
        push('vantoris', 'Open Travel to review the fare. This chat has not booked the flight.', { to: '/travel' });
      }
    }
    setDraft(null);
  }

  return (
    <ProductShell kicker="Ask Vantoris" title="Ask" subtitle="The agent can prepare a send or a booking. It executes only after you confirm, and only if the provider accepts it.">
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-[11px] text-slate-500 space-y-1">
        {status.map((s) => <p key={s}>{s}</p>)}
      </div>
      <div className="space-y-2 mb-4">
        {log.map((m, i) => (
          <div key={i} className={`rounded-2xl px-4 py-3 text-sm ${m.role === 'you' ? 'bg-navy text-white' : 'bg-white border border-slate-200'}`}>
            <p>{m.text}</p>
            {m.to && <Link to={m.to} className="mt-2 inline-block text-xs font-semibold underline">Open</Link>}
          </div>
        ))}
      </div>
      {draft && (
        <div className="mb-4 rounded-2xl border border-brass/40 bg-brass/10 p-4 text-sm">
          <p className="font-semibold text-navy">{draft.type === 'send' ? `Send $${draft.amount.toFixed(2)}` : `Flight ${draft.from} → ${draft.to}`}</p>
          <p className="mt-1 text-slate-600">Confirm does not mean completed. A provider has to accept it.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={confirm} className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white">Confirm</button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold">Cancel</button>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="Send $25 to Ada  ·  Book flight LOS to LHR"
          className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <button type="button" onClick={ask} className="rounded-xl bg-navy px-4 text-sm font-semibold text-white">Ask</button>
      </div>
    </ProductShell>
  );
}
