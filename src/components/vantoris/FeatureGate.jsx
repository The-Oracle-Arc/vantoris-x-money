import React from 'react';
import { Lock, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMemberAccess } from '@/hooks/useMemberAccess';
import VantorisLoading from '@/components/vantoris/system/VantorisLoading';

/**
 * FeatureGate — Wraps account-dependent features. If the member has not been
 * approved (no active account), shows a locked state guiding them through
 * onboarding instead of revealing the feature.
 */
export default function FeatureGate({ children, featureName = 'This feature' }) {
  const navigate = useNavigate();
  const { loading, isApproved, application } = useMemberAccess();

  if (loading) {
    return <VantorisLoading className="h-96" />;
  }

  if (isApproved) {
    return children;
  }

  const kycPending = application && application.kyc_status === 'pending';
  const kycNotStarted = !application || application.kyc_status === 'not_started';
  const appPending = application && application.application_status === 'pending';
  const contributionPending = application && application.opening_contribution_status !== 'approved';

  let stepLabel = 'Complete your onboarding';
  let stepDesc = 'Finish your application and account opening to unlock this feature.';
  let ctaLabel = 'Continue Onboarding';
  let ctaRoute = '/apply';

  if (!application) {
    stepLabel = 'Start your application';
    stepDesc = 'You need an approved Vantoris account to access this feature. Begin your membership application to get started.';
  } else if (kycNotStarted || kycPending) {
    stepLabel = 'Complete KYC verification';
    stepDesc = 'Your identity verification is pending. Complete KYC to proceed with account opening.';
    ctaLabel = 'Complete KYC';
    ctaRoute = '/apply/kyc';
  } else if (application.kyc_status === 'rejected') {
    stepLabel = 'KYC requires attention';
    stepDesc = 'Your KYC submission was not approved. Please resubmit your documents to continue.';
    ctaLabel = 'Resubmit KYC';
    ctaRoute = '/apply/kyc';
  } else if (contributionPending) {
    stepLabel = 'Opening contribution pending';
    stepDesc = 'Your application is approved pending your opening contribution. Complete your deposit to activate your account.';
    ctaLabel = 'View Application';
    ctaRoute = '/apply';
  } else if (appPending) {
    stepLabel = 'Application under review';
    stepDesc = 'Your application is being reviewed by our team. You will be notified once approved.';
    ctaLabel = 'View Application';
    ctaRoute = '/apply';
  }

  return (
    <div className="px-5 pt-6 pb-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">{featureName}</h1>
        <p className="text-gray text-sm mt-0.5">Premium member access required</p>
      </div>

      <div className="vantoris-glass-premium p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-navy/8 border border-navy/10 flex items-center justify-center mx-auto mb-4">
          <Lock size={28} className="text-navy" strokeWidth={2} />
        </div>
        <h2 className="text-foreground font-semibold text-lg mb-2">{stepLabel}</h2>
        <p className="text-gray text-sm max-w-sm mx-auto leading-relaxed">{stepDesc}</p>

        <button
          onClick={() => navigate(ctaRoute)}
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-all"
        >
          {ctaLabel} <ArrowRight size={16} />
        </button>

        {/* Progress indicator */}
        <div className="mt-8 pt-6 border-t border-border/50">
          <div className="flex items-center justify-center gap-6 text-xs">
            <div className="flex items-center gap-1.5">
              {application ? <CheckCircle2 size={14} className="text-mint" /> : <Clock size={14} className="text-gray" />}
              <span className={application ? 'text-mint font-medium' : 'text-gray'}>Application</span>
            </div>
            <div className="w-6 h-px bg-border" />
            <div className="flex items-center gap-1.5">
              {application?.kyc_status === 'approved'
                ? <CheckCircle2 size={14} className="text-mint" />
                : <Clock size={14} className="text-brass" />}
              <span className={application?.kyc_status === 'approved' ? 'text-mint font-medium' : 'text-brass'}>KYC</span>
            </div>
            <div className="w-6 h-px bg-border" />
            <div className="flex items-center gap-1.5">
              {application?.opening_contribution_status === 'approved'
                ? <CheckCircle2 size={14} className="text-mint" />
                : <Clock size={14} className="text-gray" />}
              <span className={application?.opening_contribution_status === 'approved' ? 'text-mint font-medium' : 'text-gray'}>Funding</span>
            </div>
            <div className="w-6 h-px bg-border" />
            <div className="flex items-center gap-1.5">
              {isApproved
                ? <CheckCircle2 size={14} className="text-mint" />
                : <Lock size={14} className="text-gray" />}
              <span className={isApproved ? 'text-mint font-medium' : 'text-gray'}>Account</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}