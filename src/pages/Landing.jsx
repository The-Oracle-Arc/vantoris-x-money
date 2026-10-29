import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Shield,
  CreditCard,
  Landmark,
  TrendingUp,
  Heart,
  Users,
  Globe2,
  Sparkles,
  ChevronRight,
  Play,
  CheckCircle2,
  Plane,
  HandHeart,
  Lock,
  Smartphone,
  Building2,
  MapPin,
  Ban,
  BookOpen,
  Wallet,
  BadgeCheck,
  FileText,
  MessageCircle,
  Image,
  Share2,
  Fingerprint,
  ShieldCheck,
} from 'lucide-react';
import ShieldLogo from '@/components/vantoris/ShieldLogo';

const NAV = [
  { label: 'Verified', href: '#verified' },
  { label: 'Wallets', href: '#wallets' },
  { label: 'Cards', href: '#card-gallery' },
  { label: 'Statements', href: '#statements' },
  { label: 'About', href: '#about' },
  { label: 'Banking', href: '#banking' },
  { label: 'Invest', href: '#invest' },
  { label: 'Travel', href: '#travel' },
  { label: 'Property', href: '#property' },
  { label: 'AI & Chat', href: '#ai-ops' },
  { label: 'Community', href: '#community' },
  { label: 'Safety', href: '#fraud' },
  { label: 'Contact', href: '#contact' },
];

const BOA_PARITY = [
  ['Checking & savings', 'Everyday accounts with clear balances and statements'],
  ['Transfers & payments', 'Send, request, deposit, and move money between accounts'],
  ['Debit cards', 'Request, manage, and monitor eligible member cards'],
  ['Credit pathways', 'Eligible credit products after compliance review'],
  ['Direct deposit', 'Payroll routing and early-pay oriented workflows'],
  ['Bill pay style flows', 'Structured outbound payments from member accounts'],
  ['Mobile-first access', 'Full member workspace on phone-sized layouts'],
  ['Alerts & messages', 'In-app notifications and secure member messaging'],
  ['Document vault', 'Store ID, statements, and verification files'],
  ['Investment access', 'Portfolios, deposits, and withdrawal requests'],
  ['Fraud & security posture', 'Session controls, isolation of ops vs member views'],
  ['Advisor / assistant help', 'Guided support without exposing staff tools to members'],
];

const NGO_PARTNERS = [
  { name: 'UNHCR', focus: 'Refugees & forced displacement', note: 'Global protection and assistance under severe funding pressure in 2025–2026.', url: 'https://www.unhcr.org/' },
  { name: 'OCHA / CERF', focus: 'Underfunded emergencies', note: 'UN coordination and rapid pooled funding for neglected crises worldwide.', url: 'https://www.unocha.org/' },
  { name: 'Caritas Internationalis', focus: 'Local humanitarian response', note: 'Confederation supporting communities when aid budgets contract.', url: 'https://www.caritas.org/' },
  { name: 'CARE', focus: 'Poverty & crisis response', note: 'International NGO network active across conflict and climate emergencies.', url: 'https://www.care.org/' },
  { name: 'Médecins Sans Frontières', focus: 'Medical humanitarian', note: 'Emergency medical care in conflict and epidemic settings.', url: 'https://www.msf.org/' },
  { name: 'World Food Programme', focus: 'Hunger & logistics', note: 'Food assistance and supply chains for populations in acute need.', url: 'https://www.wfp.org/' },
];

const MILITARY_ORGS = [
  { name: 'Blue Star Families', focus: 'Military families', url: 'https://bluestarfam.org/' },
  { name: 'National Military Family Association', focus: 'Family advocacy', url: 'https://www.militaryfamily.org/' },
  { name: 'Operation Homefront', focus: 'Emergency financial aid', url: 'https://operationhomefront.org/' },
  { name: 'Operation Tango Mike', focus: 'Deployed care packages', url: 'https://operationtangomike.org/' },
  { name: 'Wounded Warriors Family Support', focus: 'Combat-wounded families', url: 'https://wwfs.org/' },
  { name: 'Friends Of The Troops', focus: 'Care packages & crisis aid', url: 'https://www.friendsofthetroops.org/' },
  { name: 'Royal British Legion', focus: 'UK armed forces community', url: 'https://www.britishlegion.org.uk/' },
  { name: 'Help for Heroes', focus: 'Wounded UK personnel', url: 'https://www.helpforheroes.org.uk/' },
];

const DEMO_CARDS = [
  { title: 'Cash balance', detail: 'Large available balance with hide/show, multi-account rollup', credit: 'Member Money home' },
  { title: 'Deposit · Send · Request', detail: 'Quick actions into Move Money (Zelle-style and transfers)', credit: 'Payments rail' },
  { title: 'Your accounts', detail: 'Live Account entities—type, mask, balance—not demo fiction', credit: 'Core banking' },
  { title: 'Activity feed', detail: 'Recent credits and debits from Transaction records', credit: 'Ledger' },
  { title: 'Debit card tile', detail: 'Card services and last-four when issued', credit: 'Card services' },
  { title: 'HeroBox impact', detail: 'Care packages, funds, shipping tracked in Operations', credit: 'NGO + military logistics' },
  { title: 'Investment snapshot', detail: 'Portfolio total value beside cash when present', credit: 'Wealth' },
  { title: 'Ops isolation', detail: 'Staff dashboards never appear on member routes', credit: 'Security model' },
];

const PILLARS = [
  {
    icon: Landmark,
    title: 'Private member banking',
    body: 'Secure accounts, real-time balances, transfers, and Zelle-style payments designed for members who expect discretion and clarity.',
  },
  {
    icon: CreditCard,
    title: 'Debit & credit services',
    body: 'Request and manage eligible debit cards, track spend, and access card controls from a single member workspace.',
  },
  {
    icon: TrendingUp,
    title: 'Investment portfolios',
    body: 'View holdings, deposits, and withdrawals with operator-grade oversight—so growth stays aligned with your goals.',
  },
  {
    icon: HandHeart,
    title: 'HeroBox & humanitarian care',
    body: 'Support service members and communities through curated care packages, volunteer networks, and mission logistics.',
  },
];

const HELP = [
  {
    title: 'Working families',
    text: 'Direct deposit, early access to pay, and simple tools to send and request money without friction.',
  },
  {
    title: 'Service members & veterans',
    text: 'Priority pathways, HeroBox missions, and banking that respects the realities of deployment and transition.',
  },
  {
    title: 'Builders & entrepreneurs',
    text: 'Business-ready account types, document vaults, and advisor access when decisions get complex.',
  },
  {
    title: 'Global citizens',
    text: 'Cross-border awareness, discovery tools, and support channels that don’t stop at a single zip code.',
  },
];

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState('');

  const scrollToId = useCallback((hash) => {
    const id = (hash || '').replace(/^#/, '');
    if (!id) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActiveHash('');
      return;
    }
    const el = document.getElementById(id);
    if (!el) return;
    const headerOffset = 72;
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top, behavior: 'smooth' });
    setActiveHash('#' + id);
    try {
      window.history.replaceState(null, '', '#' + id);
    } catch (_) {}
  }, []);

  const onNavClick = useCallback(
    (e, href) => {
      e.preventDefault();
      setMenuOpen(false);
      scrollToId(href);
    },
    [scrollToId]
  );

  // Open with #hash in URL
  useEffect(() => {
    if (window.location.hash) {
      const t = window.setTimeout(() => scrollToId(window.location.hash), 80);
      return () => window.clearTimeout(t);
    }
  }, [scrollToId]);

  // Highlight active section while scrolling
  useEffect(() => {
    const ids = NAV.map((n) => n.href.replace('#', '')).filter(Boolean);
    const onScroll = () => {
      const y = window.scrollY + 96;
      let current = '';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= y) current = '#' + id;
      }
      setActiveHash(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-navy scroll-smooth">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => scrollToId('top')}
            className="flex items-center gap-2.5 shrink-0 text-left"
            aria-label="Back to top"
          >
            <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center">
              <ShieldLogo size={20} />
            </div>
            <div className="leading-tight">
              <p className="font-bold text-[15px] tracking-tight">Vantoris</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 hidden sm:block">
                Private banking · Impact
              </p>
            </div>
          </button>

          <nav
            className="hidden lg:flex items-center gap-1 text-[13px] font-medium text-slate-600 max-w-[52%] overflow-x-auto"
            aria-label="Page sections"
          >
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={(e) => onNavClick(e, n.href)}
                className={`shrink-0 px-2.5 py-1.5 rounded-full transition-colors ${
                  activeHash === n.href
                    ? 'bg-navy text-white'
                    : 'hover:text-navy hover:bg-slate-100'
                }`}
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to="/login"
              className="text-[13px] font-semibold text-navy px-3 py-2 rounded-full hover:bg-slate-100 transition"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-[13px] font-semibold text-white bg-navy px-4 py-2.5 rounded-full hover:bg-navy/90 transition inline-flex items-center gap-1.5 shadow-sm"
            >
              Open account
              <ArrowRight size={14} />
            </Link>
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="block w-5 h-0.5 bg-current mb-1" />
              <span className="block w-5 h-0.5 bg-current mb-1" />
              <span className="block w-5 h-0.5 bg-current" />
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="lg:hidden border-t border-slate-100 bg-white px-4 py-3 max-h-[70vh] overflow-y-auto">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={(e) => onNavClick(e, n.href)}
                className={`block py-2.5 text-sm font-medium rounded-lg px-2 ${
                  activeHash === n.href ? 'bg-navy/5 text-navy font-semibold' : 'text-slate-700'
                }`}
              >
                {n.label}
              </a>
            ))}
            <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="flex-1 text-center py-2.5 rounded-full border border-slate-200 text-sm font-semibold"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                onClick={() => setMenuOpen(false)}
                className="flex-1 text-center py-2.5 rounded-full bg-navy text-white text-sm font-semibold"
              >
                Open account
              </Link>
            </div>
          </div>
        )}
      </header>

      <main id="top" className="scroll-mt-20">
        {/* Hero — cinematic */}
        <section className="relative overflow-hidden min-h-[92vh] flex flex-col justify-center">
          <div className="absolute inset-0 bg-[#050d18]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_40%,#0B3D5C55,transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_90%_10%,#C9A22722,transparent)]" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-brass/30 bg-brass/10 px-3 py-1.5 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-[11px] text-brass tracking-wide">VERIFIED · MEMBER BANKING · LIVE</span>
              </div>
              <h1 className="font-heading text-white text-[2.75rem] sm:text-5xl lg:text-[3.75rem] font-extrabold leading-[1.02] tracking-tight">
                Money that moves
                <br />
                <span className="font-display italic font-normal text-brass text-[1.05em]">with institutional chill.</span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-white/65 max-w-xl leading-relaxed font-body">
                U.S.-standard accounts, cards, wires, and statements—plus HeroBox impact.
                A self-operating AI platform: members bank, assistants guide, ops stay isolated. Built for people who want bank energy without the 2012 website energy.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-brass text-navy font-bold px-7 py-3.5 text-[15px] hover:bg-[#d4b03a] transition shadow-[0_0_40px_rgba(201,162,39,0.25)]"
                >
                  Open membership
                  <ArrowRight size={18} />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 text-white font-semibold px-6 py-3.5 text-[15px] hover:bg-white/10 transition backdrop-blur-sm"
                >
                  Sign in
                </Link>
                <a
                  href="#card-gallery"
                  onClick={(e) => onNavClick(e, '#card-gallery')}
                  className="inline-flex items-center gap-2 rounded-full text-white/70 font-medium px-4 py-3.5 text-[14px] hover:text-white transition"
                >
                  <Play size={16} className="text-brass" />
                  Peek the cards
                </a>
              </div>
              <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[11px] text-white/40 uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><BadgeCheck size={12} className="text-emerald-400" /> KYC gated</span>
                <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-brass" /> Ops isolated</span>
                <span className="flex items-center gap-1.5"><Lock size={12} /> Session secure</span>
              </div>
            </div>

            {/* Floating premium card stack */}
            <div className="lg:col-span-5 relative h-[320px] sm:h-[380px]">
              <div className="absolute right-0 top-8 w-[min(100%,320px)] aspect-[1.586/1] rounded-2xl bg-gradient-to-br from-[#1a1510] to-[#0a0a0a] border border-brass/40 shadow-2xl p-5 text-white rotate-6 opacity-80 scale-95">
                <p className="font-heading text-sm font-bold text-brass">Credit</p>
                <p className="font-mono mt-12 tracking-[0.18em] text-sm">•••• 8891</p>
              </div>
              <div className="absolute right-4 top-0 w-[min(100%,340px)] aspect-[1.586/1] rounded-2xl bg-gradient-to-br from-[#0A1628] via-[#0E2A4A] to-[#071C38] border border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.5)] p-6 text-white -rotate-3 z-10">
                <div className="flex justify-between items-start">
                  <span className="font-heading font-bold tracking-wide text-lg">Vantoris</span>
                  <span className="font-mono text-[10px] text-white/40 uppercase">Debit</span>
                </div>
                <div className="mt-8 w-11 h-8 rounded-md bg-gradient-to-br from-[#e8d5a3] via-[#c9a227] to-[#8a7020] shadow-inner" />
                <p className="font-mono text-xl tracking-[0.22em] mt-6">•••• •••• •••• 4412</p>
                <div className="mt-6 flex justify-between items-end">
                  <div>
                    <p className="font-mono text-[9px] text-white/35 uppercase">Cardholder</p>
                    <p className="text-sm font-semibold tracking-wider">MEMBER NAME</p>
                  </div>
                  <span className="text-[10px] font-mono text-brass">NFC</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trust marquee */}
          <div className="relative border-t border-white/10 bg-black/30 backdrop-blur-md">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap justify-between gap-4 font-mono text-[10px] sm:text-[11px] text-white/45 uppercase tracking-[0.14em]">
              <span>Statements · boardroom grade</span>
              <span>Wires · trackable</span>
              <span>Cards · U.S. layout standard</span>
              <span>AI · member + ops</span>
              <span>HeroBox · real logistics</span>
            </div>
          </div>
        </section>

        {/* VERIFIED — public, no sign-in required */}
        <section id="verified" className="scroll-mt-24 border-b border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
                <BadgeCheck size={14} /> USD financial platform · Since 2015
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/5 text-navy border border-navy/10 px-3 py-1 text-[11px] font-semibold">
                <Fingerprint size={14} /> Identity · KYC · session isolation
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 px-3 py-1 text-[11px] font-semibold">
                U.S. banking-style controls & statements
              </span>
            </div>
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="font-display text-4xl sm:text-5xl text-navy leading-[1.1]">
                  Obvious trust.<span className="italic text-brass"> Premium clarity.</span>
                </h2>
                <p className="mt-4 text-slate-600 leading-relaxed font-body">
                  Vantoris is built like serious American retail and private banking: verified membership,
                  document vaults, elite statements, card chrome you recognize, and operator rails that
                  stay invisible to members. Browse the previews below—<strong>no sign-in required</strong>.
                </p>
                <ul className="mt-6 space-y-2 text-sm text-navy font-body">
                  {[
                    'Member verification before full product access',
                    'Statements formatted for professional finance review',
                    'Cards, wires, and activity with audit-friendly records',
                    'AI assistants for guidance—not for sharing your secrets',
                  ].map((x) => (
                    <li key={x} className="flex gap-2">
                      <ShieldCheck size={16} className="text-brass shrink-0 mt-0.5" />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[24px] bg-navy text-white p-6 sm:p-8 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-brass/20 blur-2xl" />
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass">Institutional seal</p>
                <p className="font-heading text-2xl font-bold mt-3">Vantoris Member Platform</p>
                <p className="text-white/60 text-sm mt-2 font-body">
                  Trust · Structure · Purpose — navy / brass identity system aligned with U.S. premium banking UX norms.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 text-center">
                  {[
                    ['KYC', 'Identity checks'],
                    ['Docs', 'Vault & exports'],
                    ['Ops', 'Isolated staff'],
                    ['AI', 'Guided support'],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-white/5 border border-white/10 py-3">
                      <p className="font-heading font-bold text-brass">{k}</p>
                      <p className="text-[11px] text-white/50 mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* Wallet pricing — transparent US-style schedule */}
        <section id="wallets" className="scroll-mt-24 bg-white border-b border-slate-200 py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass mb-3">Wallets · pricing</p>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-navy">Clear pricing on every wallet</h2>
            <p className="mt-3 text-slate-600 max-w-2xl font-body">
              Membership wallets follow a simple published schedule. Third-party rails (cards, wires, FX)
              may add network costs disclosed before you confirm.
            </p>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: 'Primary checking', fee: '$0 / mo', note: 'Core member wallet', img: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=600&q=80' },
                { name: 'Savings', fee: '$0 / mo', note: 'Yield subject to product terms', img: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=600&q=80' },
                { name: 'Debit card', fee: '$0 issue*', note: '*Replacement may apply', img: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=80' },
                { name: 'Domestic wire out', fee: 'From $15', note: 'Shown before you send', img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=80' },
              ].map((w) => (
                <article key={w.name} className="rounded-2xl border border-slate-200 overflow-hidden bg-[#F4F6F9] shadow-sm">
                  <div className="h-28 relative">
                    <img src={w.img} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-navy/40" />
                  </div>
                  <div className="p-4">
                    <p className="font-heading font-bold text-navy">{w.name}</p>
                    <p className="font-mono text-lg text-brass font-semibold mt-1">{w.fee}</p>
                    <p className="text-xs text-slate-500 mt-1">{w.note}</p>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-6 text-[11px] text-slate-400">
              Schedule is illustrative for the Vantoris member platform and can vary by eligibility and jurisdiction.
            </p>
          </div>
        </section>

        {/* AI platform */}
        <section id="ai-platform" className="scroll-mt-24 max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="rounded-[28px] bg-navy text-white p-8 sm:p-10 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-1/2 h-full opacity-30 hidden sm:block">
              <img src="https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80" alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-navy" />
            </div>
            <div className="relative max-w-xl">
              <p className="font-mono text-[11px] text-brass uppercase tracking-wider">Self-operating AI platform</p>
              <h2 className="font-heading text-3xl font-bold mt-2">Assistants that run with the bank—not beside it</h2>
              <p className="mt-4 text-white/70 leading-relaxed font-body">
                Member AI, ops AI, and command divisions coordinate on the same membership data:
                balances, applications, HeroBox, and support threads—with isolation so staff tools
                never appear on member screens.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['Member assistant', 'Ops command', 'Image & templates', 'Secure chat'].map((x) => (
                  <span key={x} className="rounded-full border border-white/20 px-3 py-1 text-xs font-medium">{x}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CARD GALLERY — American banking card standards look */}
        <section id="card-gallery" className="scroll-mt-24 max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-brass mb-3">Cards · public preview · no login</p>
          <h2 className="font-heading text-3xl sm:text-5xl font-bold text-navy tracking-tight">
            Plastic that looks <span className="font-display italic font-normal text-brass">expensive</span> on purpose
          </h2>
          <p className="mt-3 text-slate-600 max-w-2xl font-body">
            Emboss-style number blocks, network-ready layouts, contactless mark, and member name line—
            the visual language Americans expect from major issuers. Sample art only; issuance requires verification.
          </p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Debit */}
            <div className="aspect-[1.586/1] rounded-2xl bg-gradient-to-br from-[#0A1628] via-[#0E2A4A] to-[#071C38] text-white p-5 flex flex-col justify-between shadow-xl border border-white/10 relative overflow-hidden">
              <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_80%_20%,#C9A22755,transparent_45%)]" />
              <div className="relative flex justify-between items-start">
                <span className="font-heading font-bold tracking-wide">Vantoris</span>
                <span className="text-[10px] font-mono uppercase text-white/50">Debit</span>
              </div>
              <div className="relative">
                <div className="w-10 h-7 rounded bg-gradient-to-br from-amber-200 to-amber-500 mb-4 opacity-90" title="Chip" />
                <p className="font-mono text-lg tracking-[0.2em]">•••• •••• •••• 4412</p>
              </div>
              <div className="relative flex justify-between items-end">
                <div>
                  <p className="text-[9px] uppercase text-white/40 font-mono">Member</p>
                  <p className="text-sm font-semibold tracking-wide">YOUR NAME</p>
                </div>
                <p className="text-xs font-heading text-brass">Contactless ready</p>
              </div>
            </div>
            {/* Credit */}
            <div className="aspect-[1.586/1] rounded-2xl bg-gradient-to-br from-[#1a1a1a] via-[#2a2118] to-[#0d0d0d] text-white p-5 flex flex-col justify-between shadow-xl border border-brass/30 relative overflow-hidden">
              <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_80%,#C9A22744,transparent_50%)]" />
              <div className="relative flex justify-between items-start">
                <span className="font-heading font-bold tracking-wide">Vantoris</span>
                <span className="text-[10px] font-mono uppercase text-brass">Credit</span>
              </div>
              <div className="relative">
                <div className="w-10 h-7 rounded bg-gradient-to-br from-amber-200 to-amber-500 mb-4" />
                <p className="font-mono text-lg tracking-[0.2em]">•••• •••• •••• 8891</p>
              </div>
              <div className="relative flex justify-between items-end">
                <div>
                  <p className="text-[9px] uppercase text-white/40 font-mono">Member since</p>
                  <p className="text-sm font-semibold">2026</p>
                </div>
                <p className="text-xs text-white/60">Eligible after review</p>
              </div>
            </div>
            {/* Business */}
            <div className="aspect-[1.586/1] rounded-2xl bg-gradient-to-br from-[#0B3D2E] to-[#071C38] text-white p-5 flex flex-col justify-between shadow-xl border border-white/10 sm:col-span-2 lg:col-span-1">
              <div className="flex justify-between">
                <span className="font-heading font-bold">Vantoris</span>
                <span className="text-[10px] font-mono text-emerald-300/80 uppercase">Business</span>
              </div>
              <p className="font-mono text-lg tracking-[0.2em]">•••• •••• •••• 2204</p>
              <p className="text-sm text-white/70">Operating spend · dual control ready</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/register?intent=cards" className="rounded-full bg-navy text-white px-5 py-2.5 text-sm font-bold">
              Request card access
            </Link>
            <a href="#statements" onClick={(e) => onNavClick(e, '#statements')} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-navy">
              See statement design
            </a>
          </div>
        </section>

        {/* STATEMENTS — elite professional */}
        <section id="statements" className="scroll-mt-24 bg-[#0B1220] text-white py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass mb-3">Statements · public sample</p>
            <h2 className="font-display text-4xl sm:text-5xl italic text-white/95 leading-tight">
              Elite. Legible.<br />Boardroom-ready.
            </h2>
            <p className="mt-3 text-white/60 max-w-2xl font-body">
              Account statements use institutional hierarchy: period header, account mask, opening/closing
              balance, transaction grid, and disclosure footer—the pattern U.S. banks and wealth desks use.
            </p>
            <div className="mt-10 rounded-2xl bg-white text-navy shadow-2xl overflow-hidden border border-white/10">
              <div className="bg-navy text-white px-6 py-4 flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-heading font-bold text-lg">Vantoris</p>
                  <p className="font-mono text-[10px] text-white/50 tracking-wider">MEMBER STATEMENT · SAMPLE</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-mono text-white/70">Statement period</p>
                  <p className="font-semibold">Sep 1 – Sep 30, 2026</p>
                </div>
              </div>
              <div className="px-6 py-5 border-b border-slate-100 grid sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-[10px] uppercase text-slate-400 font-mono">Account</p>
                  <p className="font-semibold">Primary Checking ·••• 4821</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-400 font-mono">Opening balance</p>
                  <p className="font-mono font-semibold tabular-nums">$12,450.00</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-400 font-mono">Closing balance</p>
                  <p className="font-mono font-semibold tabular-nums text-emerald-700">$14,208.42</p>
                </div>
              </div>
              <div className="px-6 py-2">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-100">
                      <th className="py-2 font-medium">Date</th>
                      <th className="py-2 font-medium">Description</th>
                      <th className="py-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="font-body">
                    {[
                      ['09/03', 'Direct deposit · Payroll', '+$3,200.00'],
                      ['09/08', 'ACH · Utilities', '−$164.20'],
                      ['09/14', 'Card · Market', '−$86.44'],
                      ['09/22', 'Transfer · Savings', '−$500.00'],
                      ['09/28', 'Wire in · Client', '+$1,309.06'],
                    ].map(([d, desc, amt]) => (
                      <tr key={d + desc} className="border-b border-slate-50">
                        <td className="py-2.5 font-mono text-xs text-slate-500">{d}</td>
                        <td className="py-2.5">{desc}</td>
                        <td className={`py-2.5 text-right font-mono text-xs font-semibold ${amt.startsWith('+') ? 'text-emerald-700' : 'text-navy'}`}>{amt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 bg-slate-50 text-[11px] text-slate-500 font-body">
                Sample illustration only. Live statements generate after membership verification and account activity.
                Retain copies for your records. Dispute windows follow platform terms.
              </div>
            </div>
          </div>
        </section>

        {/* AI OPS + IMAGE + CHAT — public explainer */}
        <section id="ai-ops" className="scroll-mt-24 max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass mb-3">AI operatives · active by design</p>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-navy">
            Assistants that <span className="font-display italic font-normal">scheme for clarity</span>
          </h2>
          <p className="mt-3 text-slate-600 max-w-2xl font-body">
            Member and operations AI stay on-task: answers, drafts, image prompts for HeroBox and campaigns,
            and routing into human support—never a replacement for compliance judgment.
          </p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: MessageCircle, t: 'Member chat', d: 'Ask balances, products, next steps—with redaction of secrets.' },
              { icon: Share2, t: 'Support bridge', d: 'Escalate to humans; members and support share secure threads.' },
              { icon: Image, t: 'Image create / import', d: 'Generate or upload visuals for packages, posts, and templates.' },
              { icon: FileText, t: 'Template refresh', d: 'U.S. banking-style templates for statements, notices, and ops.' },
            ].map(({ icon: Icon, t: title, d }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <Icon size={20} className="text-brass mb-3" />
                <p className="font-heading font-bold text-navy">{title}</p>
                <p className="text-sm text-slate-500 mt-1 font-body leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4 text-sm text-slate-600 font-body">
            <strong className="text-navy">Content cadence:</strong> operators can refresh imported images and
            browsed reference info on a schedule (e.g. every 4 hours) for catalogs and templates—using approved
            sources and manual QA, not unauthorized site scraping.
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/login" className="rounded-full bg-navy text-white px-5 py-2.5 text-sm font-bold">Open assistant (members)</Link>
            <Link to="/register" className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold">Join to chat</Link>
          </div>
        </section>

        {/* COMMUNITY / SOCIAL */}
        <section id="community" className="scroll-mt-24 bg-white border-y border-slate-200 py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass mb-3">Connections</p>
            <h2 className="font-heading text-3xl font-bold text-navy">Members · support · impact—linked</h2>
            <p className="mt-3 text-slate-600 max-w-2xl font-body">
              Social proof and channels stay professional: follow official Vantoris presence, contact desks,
              and in-app messaging after verification. No spam growth hacks—real support paths.
            </p>
            <div className="mt-10 grid sm:grid-cols-3 gap-4">
              {[
                ['In-app messages', 'Secure member ↔ support threads', '/login'],
                ['Voice desks', 'US + UK lines on Contact', '#contact'],
                ['HeroBox network', 'Volunteers, shipping, funds in ops', '/login'],
              ].map(([t, d, href]) => (
                href.startsWith('#') ? (
                  <a key={t} href={href} onClick={(e) => onNavClick(e, href)} className="rounded-2xl border border-slate-200 p-5 hover:border-brass/40 transition block">
                    <p className="font-heading font-bold text-navy">{t}</p>
                    <p className="text-sm text-slate-500 mt-1">{d}</p>
                  </a>
                ) : (
                  <Link key={t} to={href} className="rounded-2xl border border-slate-200 p-5 hover:border-brass/40 transition block">
                    <p className="font-heading font-bold text-navy">{t}</p>
                    <p className="text-sm text-slate-500 mt-1">{d}</p>
                  </Link>
                )
              ))}
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className="scroll-mt-24 max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brass mb-3">About Vantoris</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy leading-tight">
                A sanctuary for members who need more than a basic bank app.
              </h2>
              <p className="mt-5 text-slate-600 text-[16px] leading-relaxed">
                Vantoris combines institutional design with human outcomes. Members manage cash,
                cards, and investments in one place—while operators run KYC, compliance, and
                care logistics with the same platform backbone.
              </p>
              <p className="mt-4 text-slate-600 text-[16px] leading-relaxed">
                We built Vantoris for people who carry responsibility: households, founders,
                service members, and communities that deserve both security and solidarity.
              </p>
              <ul className="mt-8 space-y-3">
                {[
                  'Role-isolated member and operations experiences',
                  'Document vault, advisor access, and audit-ready trails',
                  'AI assistant for guided help—never a replacement for human judgment',
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] text-navy">
                    <CheckCircle2 size={18} className="text-brass shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[28px] bg-white border border-slate-200/80 shadow-sm p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-navy flex items-center justify-center">
                  <Shield size={22} className="text-brass" />
                </div>
                <div>
                  <p className="font-bold text-navy">Trust architecture</p>
                  <p className="text-sm text-slate-500">Navy · brass · institutional clarity</p>
                </div>
              </div>
              <p className="text-slate-600 leading-relaxed text-[15px]">
                From session safeguards to operations isolation, Vantoris is designed so member
                banking and staff mission control never collide. Your money view stays yours.
                Approvals and compliance stay with authorized operators.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { icon: Lock, label: 'Secure sessions' },
                  { icon: Users, label: 'Member-first UX' },
                  { icon: Globe2, label: 'Discovery network' },
                  { icon: Smartphone, label: 'Mobile-ready' },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="rounded-xl bg-[#F4F6F9] px-3 py-3 flex items-center gap-2 text-sm font-medium text-navy"
                  >
                    <Icon size={16} className="text-brass" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section id="banking" className="scroll-mt-24 bg-white border-y border-slate-200/80 py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brass mb-3">What you can do</p>
            <h2 className="text-3xl font-bold text-navy max-w-xl">Everything in one membership workspace</h2>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {PILLARS.map(({ icon: Icon, title, body }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-slate-200/80 bg-[#F4F6F9] p-6 hover:border-brass/40 transition"
                >
                  <div className="w-11 h-11 rounded-xl bg-navy text-brass flex items-center justify-center mb-4">
                    <Icon size={20} />
                  </div>
                  <h3 className="font-bold text-navy text-[16px]">{title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Cards */}
        <section id="cards" className="scroll-mt-24 max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brass mb-3">Cards</p>
              <h2 className="text-3xl font-bold text-navy">Debit and credit pathways, under your control</h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Eligible members can request debit cards, review card services, and keep spend
                visible next to cash and investments. Credit offerings follow compliance review—
                never a one-click surprise.
              </p>
              <ul className="mt-6 space-y-2 text-[15px] text-navy">
                {['Card request & status tracking', 'Spend visibility in Activity', 'Operator review for eligible products'].map(
                  (t) => (
                    <li key={t} className="flex gap-2 items-center">
                      <ChevronRight size={16} className="text-brass" />
                      {t}
                    </li>
                  )
                )}
              </ul>
            </div>
            <div className="relative h-56 sm:h-64 rounded-[28px] bg-gradient-to-br from-navy to-[#0E2A4A] p-8 text-white shadow-xl overflow-hidden">
              <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-brass/20 blur-2xl" />
              <p className="text-white/50 text-xs uppercase tracking-widest">Vantoris</p>
              <p className="mt-8 text-2xl font-semibold tracking-wide">Member Debit</p>
              <p className="mt-auto pt-16 text-white/60 text-sm">•••• •••• •••• secure</p>
              <p className="text-brass text-sm font-medium mt-2">Your name · Your control</p>
            </div>
          </div>
        </section>

        {/* Invest */}
        <section id="invest" className="scroll-mt-24 bg-navy text-white py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brass mb-3">Investment</p>
              <h2 className="text-3xl font-bold leading-tight">Grow with transparency</h2>
              <p className="mt-4 text-white/70 leading-relaxed">
                Portfolio views, deposit and withdrawal workflows, and signals for authorized
                operators mean members see progress while institutions keep process discipline.
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
              {[
                ['Portfolio overview', 'Balances and total value at a glance'],
                ['Capital movements', 'Deposits & withdrawals with audit trails'],
                ['Guidance', 'Advisor and assistant support when you need context'],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-4">
                  <TrendingUp className="text-brass shrink-0 mt-1" size={20} />
                  <div>
                    <p className="font-semibold">{t}</p>
                    <p className="text-sm text-white/60">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

<section id="travel" className="scroll-mt-24 max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brass mb-3">Travel & flights</p>
              <h2 className="text-3xl font-bold text-navy leading-tight">
                Flights with marketplace clarity—paid from your membership
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Search routes, compare total fares, and keep trip charges next to everyday banking.
                Inspired by how modern travel sites work (search → compare → book intent)—not a
                resale of any single brand’s inventory.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Round-trip and one-way search with flexible dates',
                  'Filter nonstop, cabin class, and baggage-aware totals',
                  'Pay with eligible Vantoris balance or card when enabled',
                  'Refunds and charges appear in Activity for tracking',
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] text-navy">
                    <CheckCircle2 size={18} className="text-brass shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[12px] text-slate-400 leading-relaxed">
                Partner inventory varies by market. Vantoris is not affiliated with Expedia Group
                or any airline. Always confirm fare rules before purchase.
              </p>
            </div>

            {/* Flight search mock */}
            <div className="rounded-[24px] border border-slate-200 bg-white shadow-lg overflow-hidden">
              <div className="bg-navy px-5 py-4 flex items-center gap-2">
                <Plane size={18} className="text-brass" />
                <p className="text-white font-semibold text-sm">Flight search preview</p>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-200 bg-[#F4F6F9] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">From</p>
                    <p className="text-sm font-semibold text-navy mt-0.5">Atlanta (ATL)</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-[#F4F6F9] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">To</p>
                    <p className="text-sm font-semibold text-navy mt-0.5">London (LHR)</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-200 bg-[#F4F6F9] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Depart</p>
                    <p className="text-sm font-semibold text-navy mt-0.5">Select date</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-[#F4F6F9] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Return</p>
                    <p className="text-sm font-semibold text-navy mt-0.5">Select date</p>
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-slate-200 px-3 py-3 space-y-2">
                  {[
                    ['ATL → LHR', '1 stop · 9h 40m', '$612'],
                    ['ATL → LHR', 'Nonstop · 8h 05m', '$784'],
                  ].map(([route, meta, price]) => (
                    <div
                      key={route + price}
                      className="flex items-center justify-between rounded-lg bg-white border border-slate-100 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-semibold text-navy">{route}</p>
                        <p className="text-[11px] text-slate-500">{meta}</p>
                      </div>
                      <p className="text-sm font-bold text-navy tabular-nums">{price}</p>
                    </div>
                  ))}
                </div>
                <Link
                  to="/register?intent=travel"
                  className="block w-full text-center rounded-full bg-navy text-white py-3 text-sm font-bold hover:bg-navy/90 transition"
                >
                  Track flights — open account
                </Link>
                <Link
                  to="/login?intent=travel"
                  className="block w-full text-center rounded-full border border-slate-200 text-navy py-2.5 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Already a member? Sign in
                </Link>
                <p className="text-[11px] text-center text-slate-400">Preview UI — live booking after you sign in</p>
              </div>
            </div>
          </div>
        </section>

<section id="property" className="scroll-mt-24 bg-white border-y border-slate-200/80 py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-10 items-start mb-12">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brass mb-3">
                  Homes & investment property
                </p>
                <h2 className="text-3xl font-bold text-navy leading-tight">
                  Explore the market—then learn before you buy
                </h2>
                <p className="mt-4 text-slate-600 leading-relaxed">
                  Listing-style discovery (maps, filters, price context) with a banking lens: how a
                  purchase affects cash, reserves, and risk. Educational only until you work with
                  licensed professionals in your area.
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-[#F4F6F9] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 size={18} className="text-brass" />
                  <p className="font-semibold text-navy text-sm">Listing preview</p>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-slate-300 to-slate-400 h-36 mb-3 flex items-center justify-center text-white/80 text-xs font-medium">
                  Property photo placeholder
                </div>
                <p className="font-bold text-navy text-lg tabular-nums">$425,000</p>
                <p className="text-sm text-slate-600 mt-0.5">3 bed · 2 bath · 1,840 sq ft</p>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <MapPin size={12} /> Sample neighborhood · for illustration
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-white border border-slate-200 px-2 py-2">
                    <p className="text-slate-400">Est. monthly</p>
                    <p className="font-semibold text-navy">~$2,410 all-in</p>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-200 px-2 py-2">
                    <p className="text-slate-400">vs your cash</p>
                    <p className="font-semibold text-navy">Check in app</p>
                  </div>
                </div>
                <Link
                  to="/register?intent=housing"
                  className="mt-4 block w-full text-center rounded-full bg-navy text-white py-2.5 text-sm font-bold hover:bg-navy/90"
                >
                  Explore property — join Vantoris
                </Link>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200 bg-[#F4F6F9] p-6">
                <p className="font-bold text-navy flex items-center gap-2 mb-4">
                  <MapPin size={18} className="text-brass" /> Discovery features
                </p>
                <ul className="space-y-3 text-sm text-slate-600">
                  {[
                    'Browse for-sale and rental-style inventory where data partners allow',
                    'Filter by price, beds, property type, and location',
                    'Map-oriented exploration and saved searches',
                    'Estimate monthly carrying costs beside membership balances',
                  ].map((x) => (
                    <li key={x} className="flex gap-2">
                      <CheckCircle2 size={16} className="text-brass shrink-0 mt-0.5" />
                      {x}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-slate-400 mt-4">
                  Not affiliated with Zillow. Listing accuracy depends on third-party feeds and local law.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-navy text-white p-6">
                <p className="font-bold flex items-center gap-2 text-brass mb-4">
                  <BookOpen size={18} /> Tutor: investment properties
                </p>
                <ol className="space-y-3 text-sm text-white/85 list-decimal list-inside leading-relaxed">
                  <li>
                    <strong className="text-white">Cash flow first.</strong> Rent minus mortgage, tax,
                    insurance, maintenance, vacancy—not just sticker price.
                  </li>
                  <li>
                    <strong className="text-white">Reserves.</strong> Keep liquid buffers in Vantoris
                    accounts before taking on leverage.
                  </li>
                  <li>
                    <strong className="text-white">Due diligence.</strong> Inspections, title, HOA,
                    flood/fire risk, and comps—not social-media “deals.”
                  </li>
                  <li>
                    <strong className="text-white">Tax & entities.</strong> Use a licensed advisor;
                    Vantoris does not give legal or tax advice.
                  </li>
                  <li>
                    <strong className="text-white">Illiquidity.</strong> Property is slower to exit than
                    cash or public markets—plan the hold period honestly.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </section>

<section id="wires" className="scroll-mt-24 max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brass mb-3">Wires & tracking</p>
          <h2 className="text-3xl font-bold text-navy max-w-2xl">Send with care. Track every step.</h2>
          <p className="mt-4 text-slate-600 max-w-3xl leading-relaxed">
            Domestic and international wire-style transfers sit next to everyday Send / Request.
            Members initiate, review beneficiary details, and follow status in Activity—so large
            moves are never a black box.
          </p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['Initiate', 'Amount, beneficiary, bank identifiers, purpose of payment'],
              ['Verify', 'Confirm names and account details before release'],
              ['Track', 'Pending → processing → completed (or returned) in Activity'],
              ['Record', 'Keep reference IDs for disputes and statements'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-slate-200 bg-white p-5">
                <Wallet size={18} className="text-brass mb-2" />
                <p className="font-bold text-navy text-sm">{t}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </section>

<section id="fraud" className="scroll-mt-24 bg-[#FFF8F0] border-y border-amber-200/80 py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-amber-800 mb-3 flex items-center gap-2">
              <Ban size={14} /> Safety · fraud awareness
            </p>
            <h2 className="text-3xl font-bold text-navy max-w-2xl">Beware of frauds—especially wires and “investment property” pitches</h2>
            <p className="mt-4 text-slate-700 max-w-3xl leading-relaxed">
              Criminals impersonate banks, realtors, travel agents, and even military charities.
              Vantoris will never ask you to move money via secrecy, gift cards, crypto ATMs, or
              unsolicited “account recovery” links.
            </p>
            <div className="mt-10 grid sm:grid-cols-2 gap-4">
              {[
                ['Wire fraud', 'Always verify beneficiary details out-of-band. Fraudsters change account numbers on invoices at the last minute.'],
                ['Property scams', '“Guaranteed returns,” pressure to wire earnest money the same day, or sellers who refuse inspections are red flags.'],
                ['Travel phishing', 'Fake airline refunds and booking confirmations harvest cards—open airline sites yourself, don’t click cold emails.'],
                ['Impersonation', 'Vantoris staff will not demand your password, PIN, or one-time codes by phone or chat.'],
                ['Romance / advance-fee', 'Someone you met online asking you to receive or forward funds is a classic laundering trap—decline and report.'],
                ['Too-good listings', 'Luxury property or flights far below market often mean stolen cards or non-existent inventory.'],
              ].map(([t, d]) => (
                <div key={t} className="rounded-2xl bg-white border border-amber-100 p-5">
                  <p className="font-bold text-navy text-sm">{t}</p>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-slate-600">
              If something feels wrong, stop the transfer and contact us at{' '}
              <a href="tel:+12055688741" className="font-semibold text-navy underline">
                +1 (205) 568-8741
              </a>{' '}
              or{' '}
              <a href="tel:+447404767964" className="font-semibold text-navy underline">
                +44 7404 767964
              </a>
              . Report suspected fraud to local authorities and, in the US, to reportfraud.ftc.gov where applicable.
            </p>
          </div>
        </section>



        {/* Military */}
        <section id="military" className="scroll-mt-24 max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="rounded-[28px] bg-gradient-to-br from-[#071C38] to-[#0A2744] text-white p-8 sm:p-12 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brass/10 rounded-full blur-3xl" />
            <div className="relative grid lg:grid-cols-2 gap-10">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brass mb-3 flex items-center gap-2">
                  <Plane size={14} /> Military & heroes
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
                  Built with service members and their families in mind
                </h2>
                <p className="mt-5 text-white/70 leading-relaxed">
                  Deployment, PCS moves, and transition to civilian life change how money and care
                  work. Vantoris supports military households with practical banking tools and
                  HeroBox missions that deliver tangible support—care packages, logistics, and
                  community coordination.
                </p>
              </div>
              <div className="space-y-4">
                {[
                  {
                    t: 'HeroBox missions',
                    d: 'Catalog, orders, fulfillment, and destination management for care packages.',
                  },
                  {
                    t: 'Volunteer & logistics networks',
                    d: 'Coordinate people and routes so help arrives where it is needed.',
                  },
                  {
                    t: 'Member banking continuity',
                    d: 'Accounts, transfers, and documents that stay reachable when life moves fast.',
                  },
                ].map(({ t, d }) => (
                  <div key={t} className="rounded-2xl bg-white/5 border border-white/10 p-5">
                    <p className="font-semibold text-brass">{t}</p>
                    <p className="text-sm text-white/65 mt-1">{d}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {MILITARY_ORGS.map((m) => (
                <a
                  key={m.name}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/10 transition"
                >
                  <p className="font-semibold text-sm text-white">{m.name}</p>
                  <p className="text-[11px] text-brass mt-0.5">{m.focus}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Who we help */}
        <section id="impact" className="scroll-mt-24 bg-white border-y border-slate-200/80 py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brass mb-3">Who Vantoris helps</p>
            <h2 className="text-3xl font-bold text-navy mb-10">People first. Products second.</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {HELP.map(({ title, text }) => (
                <div key={title} className="rounded-2xl border border-slate-200 p-6 bg-[#F4F6F9]">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart size={18} className="text-brass" />
                    <h3 className="font-bold text-navy">{title}</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* Full-service banking parity */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brass mb-3">Full-service membership banking</p>
          <h2 className="text-3xl font-bold text-navy max-w-2xl">
            Built to cover the everyday ground a major retail bank covers—plus impact rails they don’t.
          </h2>
          <p className="mt-4 text-slate-600 max-w-3xl leading-relaxed">
            Vantoris targets the practical surface area members expect from institutions like
            Bank of America: accounts, cards, payments, deposits, mobile access, alerts, and
            investments. On top of that stack we run HeroBox logistics, humanitarian discovery,
            and operator-grade compliance—so banking and NGO-style action share one platform.
          </p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {BOA_PARITY.map(([t, d]) => (
              <div key={t} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="font-semibold text-navy text-sm">{t}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[12px] text-slate-400">
            Feature availability depends on eligibility, verification, jurisdiction, and product terms.
            Vantoris is not affiliated with Bank of America.
          </p>
        </section>

        {/* NGO partners */}
        <section id="ngo" className="scroll-mt-24 bg-white border-y border-slate-200/80 py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brass mb-3">Global need · real organizations</p>
            <h2 className="text-3xl font-bold text-navy max-w-2xl">Humanitarian partners and causes the world is underfunding</h2>
            <p className="mt-4 text-slate-600 max-w-3xl leading-relaxed">
              International humanitarian assistance fell sharply through 2025, leaving record gaps in
              UN-coordinated appeals. Vantoris members and operators can learn from—and when policy
              allows, support—established organizations already serving people in crisis. Links below
              go to official sites; always verify before donating.
            </p>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {NGO_PARTNERS.map((n) => (
                <a
                  key={n.name}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-slate-200 bg-[#F4F6F9] p-5 hover:border-brass/50 transition block"
                >
                  <p className="font-bold text-navy">{n.name}</p>
                  <p className="text-[12px] font-semibold text-brass mt-1">{n.focus}</p>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{n.note}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Demo — not first */}
        <section id="demo" className="scroll-mt-24 max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 sm:p-10 shadow-sm">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brass mb-3">Vantoris preview demo</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy">Credits & detail cards—how the product is composed</h2>
            <p className="mt-3 text-slate-600 max-w-2xl leading-relaxed">
              Below is a structured walkthrough of the live product surfaces. This is a preview of
              capabilities and design credits, not a sandbox with fake balances. Sign in to use
              real member data tied to your account.
            </p>
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {DEMO_CARDS.map((c) => (
                <div key={c.title} className="rounded-2xl bg-[#F4F6F9] border border-slate-100 p-5 flex flex-col">
                  <p className="text-[10px] uppercase tracking-wider text-brass font-bold">{c.credit}</p>
                  <p className="font-bold text-navy mt-1">{c.title}</p>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed flex-1">{c.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-navy text-white font-semibold px-5 py-3 text-sm"
              >
                Create your membership
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 text-navy font-semibold px-5 py-3 text-sm hover:bg-slate-50"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>


        {/* Travel */}
                {/* Property */}
                {/* Wires & track */}
                {/* Fraud awareness */}
                {/* Contact */}
        <section id="contact" className="scroll-mt-24 max-w-6xl mx-auto px-4 sm:px-6 pb-8">
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 sm:p-10">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brass mb-3">Contact us</p>
            <h2 className="text-2xl font-bold text-navy">Talk to Vantoris</h2>
            <p className="mt-2 text-slate-600">Membership, partnerships, and HeroBox logistics.</p>
            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              <a
                href="tel:+12055688741"
                className="flex-1 rounded-2xl bg-navy text-white p-5 hover:bg-navy/90 transition"
              >
                <p className="text-xs text-white/60 uppercase tracking-wider">United States</p>
                <p className="text-xl font-bold mt-1 tabular-nums">+1 (205) 568-8741</p>
              </a>
              <a
                href="tel:+447404767964"
                className="flex-1 rounded-2xl border border-slate-200 bg-[#F4F6F9] text-navy p-5 hover:border-brass/40 transition"
              >
                <p className="text-xs text-slate-500 uppercase tracking-wider">United Kingdom</p>
                <p className="text-xl font-bold mt-1 tabular-nums">+44 7404 767964</p>
              </a>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="pb-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="rounded-[28px] bg-gradient-to-r from-navy to-[#0E2A4A] px-8 py-12 text-center text-white">
              <h2 className="text-2xl sm:text-3xl font-bold">Ready when you are</h2>
              <p className="mt-3 text-white/70 max-w-xl mx-auto">
                Open a membership application or sign in to the account you already trust.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  to="/register"
                  className="rounded-full bg-brass text-navy font-bold px-6 py-3.5 text-sm hover:bg-[#d4b03a]"
                >
                  Sign up
                </Link>
                <Link
                  to="/login"
                  className="rounded-full border border-white/30 text-white font-semibold px-6 py-3.5 text-sm hover:bg-white/10"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <ShieldLogo size={16} />
            </div>
            <div>
              <p className="font-bold text-navy text-sm">Vantoris</p>
              <p className="text-[11px] text-slate-500">Private banking with impact</p>
            </div>
          </div>
          <p className="text-[12px] text-slate-400 max-w-md">
            Banking services provided through Vantoris. Features depend on eligibility, verification,
            and applicable terms. This page is a product preview—not a live account statement.
          </p>
        </div>
      </footer>
    </div>
  );
}
