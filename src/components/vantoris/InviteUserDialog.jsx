import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserPlus, Loader2 } from 'lucide-react';

export default function InviteUserDialog({ open, onOpenChange, onInvited }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleInvite() {
    if (!email.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await base44.users.inviteUser(email.trim(), role);
      setSuccess(true);
      setEmail('');
      setRole('user');
      if (onInvited) onInvited();
      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
      }, 2000);
    } catch (e) {
      setError(e.message || 'Failed to send invitation');
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0E1A2B] border-[#242D38] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <UserPlus size={18} className="text-brass" /> Invite User
          </DialogTitle>
        </DialogHeader>
        {success ? (
          <div className="py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
              <UserPlus size={26} className="text-emerald-400" />
            </div>
            <p className="text-white font-medium text-sm">Invitation sent!</p>
            <p className="text-[#AAB4C3] text-xs mt-1">The user will receive an email to join Vantoris.</p>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {error && (
              <div className="p-3 rounded-lg bg-crimson/10 text-red-400 text-sm">{error}</div>
            )}
            <div>
              <label className="text-[#AAB4C3] text-xs uppercase tracking-wider mb-1.5 block">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-[#242D38] border border-[#242D38] rounded-xl px-4 py-3 text-white text-sm focus:border-brass/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[#AAB4C3] text-xs uppercase tracking-wider mb-1.5 block">Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full bg-[#242D38] border border-[#242D38] rounded-xl px-4 py-3 text-white text-sm focus:border-brass/50 focus:outline-none"
              >
                <option value="user">Member</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <button
              disabled={!email.trim() || submitting}
              onClick={handleInvite}
              className="w-full py-3 bg-brass text-[#0E1A2B] font-semibold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Sending...</>
              ) : (
                <><UserPlus size={16} /> Send Invitation</>
              )}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}