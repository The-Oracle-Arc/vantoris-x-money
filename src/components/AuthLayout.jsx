import React from "react";
import ShieldLogo from "@/components/vantoris/ShieldLogo";

export default function AuthLayout({ title, subtitle, footer, children, bare = false }) {
  return (
    <div className="min-h-screen flex flex-col bg-background vantoris-mesh-bg">
      <div className="h-1 bg-gradient-to-r from-navy via-gold to-navy" />
      <div className="flex-1 flex items-start sm:items-center justify-center px-6 py-12 safe-top safe-bottom overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 animate-fade-up">
            <ShieldLogo size={48} className="mx-auto mb-4" />
            <h1 className="text-2xl font-bold tracking-[0.18em] text-foreground mb-1">VANTORIS</h1>
            <p className="text-gray text-[10px] tracking-[0.3em] uppercase">Private Investment & Payments</p>
          </div>
          {bare ? (
            <div className="animate-scale-in">{children}</div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-lg animate-scale-in">
              {title && (
                <div className="mb-6 text-center">
                  <h2 className="text-xl font-semibold text-foreground">{title}</h2>
                  {subtitle && <p className="text-gray text-sm mt-1">{subtitle}</p>}
                </div>
              )}
              {children}
            </div>
          )}
          {footer && <p className="text-center text-sm text-gray mt-6">{footer}</p>}
          <p className="text-center text-[10px] text-gray/50 mt-8 tracking-[0.2em] uppercase">
            Deposits insured to regulatory limits · Equal Housing Lender
          </p>
        </div>
      </div>
    </div>
  );
}