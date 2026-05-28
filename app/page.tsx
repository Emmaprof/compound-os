'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── BOOT SEQUENCE ────────────────────────────────────────────────────────────
// CRITICAL: Defined OUTSIDE the component.
// Inside = new reference every render = stale closure = interval fires forever = page crashes.
const BOOT_SEQUENCE = [
  '> CompoundOS Boot Sequence Initiated...',
  '> Loading secure kernel v2.1.0-alpha...',
  '> [OK] Cryptographic DOM virtualization engine ready.',
  '> [OK] Zero-click USDC relayer protocol armed.',
  '> Fetching L2 Base Mainnet network status...',
  '> [NODE] DePIN infrastructure status: OPTIMAL.',
  '> [VAULT] 0-Click relayer payload verified.',
  '> [INDEX] Matrix synchronized across 12 active nodes.',
  '> [RPC] Base Sepolia latency: 12ms.',
  '> [SEC] Row Level Security policies active.',
  '> system://status :: OPTIMAL',
] as const;

// ─── FEATURE CARDS DATA ───────────────────────────────────────────────────────
// Defined outside to avoid re-creation on render
const FEATURES = [
  {
    id: 'vault',
    iconPath: 'M13 10V3L4 14h7v7l9-11h-7z',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10 border-blue-500/20',
    title: '0-CLICK VAULT RELAYER',
    description:
      'Account Abstraction architecture. Execute USDC settlements autonomously without constant wallet signature prompts.',
    featured: false,
  },
  {
    id: 'ledger',
    iconPath: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'CRYPTOGRAPHIC LEDGERS',
    description:
      'Trustless immutability on Base L2. Every network clearance is stamped with a verifiable, immutable transaction hash.',
    featured: true,
  },
  {
    id: 'scale',
    iconPath: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10 border-violet-500/20',
    title: 'INFINITE SCALABILITY',
    description:
      'Engineered with React DOM Virtualization. Scroll through 5 years of receipt history with zero memory fragmentation.',
    featured: false,
  },
] as const;

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function MasterLandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isInitializing, setIsInitializing] = useState(false);

  // Stable refs — no stale closures, no memory leaks
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logIndexRef = useRef(0);

  // ── Hydration sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    // Warm the /auth route so navigation is instant when user clicks CTA
    router.prefetch('/auth');
  }, [router]);

  // ── Terminal typer ──────────────────────────────────────────────────────────
  // Uses ref-based index — immune to stale closure re-renders and Strict Mode double-invoke
  useEffect(() => {
    if (!mounted) return;

    logIndexRef.current = 0;
    setLogs([]);

    intervalRef.current = setInterval(() => {
      if (logIndexRef.current < BOOT_SEQUENCE.length) {
        const line = BOOT_SEQUENCE[logIndexRef.current];
        setLogs((prev) => [...prev, line]);
        logIndexRef.current += 1;
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, 700);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [mounted]);

  // ── Terminal auto-scroll ────────────────────────────────────────────────────
  // THE DESCENDING PAGE BUG FIX:
  // The old code called scrollIntoView on a ref inside an overflow-hidden root.
  // When there's no scrollable ancestor between the ref and <body>, the BROWSER
  // scrolls the viewport itself — causing the page to descend uncontrollably.
  // Fix: the terminal container now has its own fixed-height overflow-y-auto scroll
  // context. scrollIntoView only moves within that box. The viewport stays still.
  // block:'nearest' is critical — it means "scroll the nearest scrollable ancestor",
  // which is the terminal box, NOT the page.
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [logs]);

  // ── CTA handler ─────────────────────────────────────────────────────────────
  const handleAccess = useCallback(() => {
    if (isInitializing) return;
    setIsInitializing(true);
    // prefetch already fired in mount useEffect — push is now instant
    setTimeout(() => router.push('/auth'), 350);
  }, [isInitializing, router]);

  return (
    // ROOT FIX: NO overflow-hidden on the root.
    // overflow-hidden on root = clips document = browser can't scroll natively
    // = scrollIntoView hijacks viewport = the "descending" bug you saw in the video.
    // The root must NEVER have overflow-hidden. Only inner scroll containers get it.
    <div className="bg-[#050505] text-white font-sans selection:bg-blue-500/30 antialiased">

      {/* Fixed background — position:fixed means it never contributes to document height */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute top-1/4 left-[-10%] w-[50vw] h-[50vw] bg-blue-600/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[10%] right-[-10%] w-[40vw] h-[40vw] bg-emerald-600/8 rounded-full blur-[120px]" />
        <div className="absolute top-[60%] left-[30%] w-[30vw] h-[30vw] bg-violet-600/5 rounded-full blur-[100px]" />
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-5 md:px-12 border-b border-white/[0.05] bg-[#050505]/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 p-[1px] shadow-[0_0_20px_rgba(59,130,246,0.4)]">
            <div className="w-full h-full bg-black rounded-lg flex items-center justify-center">
              <span className="w-2 h-2 bg-white rounded-sm shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
            </div>
          </div>
          <span className="text-lg md:text-xl font-bold tracking-tight text-white">CompoundOS</span>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-900/80 border border-neutral-800 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">
              Base L2 Mainnet Live
            </span>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ──────────────────────────────────────────────────────── */}
      <section className="relative z-10 w-full max-w-[1400px] mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28 flex flex-col lg:flex-row items-center justify-center gap-14 lg:gap-20">

        {/* Left: Value Proposition */}
        <div className="flex-1 max-w-2xl w-full">
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-full md:hidden">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">
                Base L2 Mainnet Live
              </span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-900/20 border border-blue-500/20 rounded-full">
              <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest">
                Utility Settlements Relayer
              </span>
            </div>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter leading-[1.05] text-white mb-6">
            Decentralized <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-200 to-white">
              Physical
            </span>{' '}
            <br className="hidden md:block" />
            Infrastructure.
          </h1>

          <p className="text-sm md:text-base text-neutral-400 font-mono leading-relaxed mb-2 max-w-xl">
            An elite protocol engine for residential management. True 0-click USDC relayer execution,
            infinite DOM virtualization, and cryptographic invariant logging.
          </p>
          <p className="text-sm md:text-base text-neutral-600 font-mono leading-relaxed mb-10 max-w-xl">
            Architected for the future internet.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button
              onClick={handleAccess}
              disabled={isInitializing}
              aria-label="Initialize Node Workspace"
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white px-8 py-4 rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest transition-all duration-200 shadow-[0_0_30px_rgba(37,99,235,0.35)] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isInitializing ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              {isInitializing ? 'Initializing...' : 'Initialize Node Workspace'}
            </button>

            <a
              href="https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913?a=0x5C1b0C33ee09b17519e40ce062b1c6766501B0C3#code"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto bg-transparent hover:bg-white/[0.04] border border-white/10 hover:border-white/20 text-neutral-300 hover:text-white px-8 py-4 rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              View Smart Contract
            </a>
          </div>
        </div>

        {/* Right: Terminal */}
        <div className="flex-1 w-full max-w-xl lg:max-w-2xl relative">
          <div className="absolute inset-0 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" aria-hidden="true" />

          <div
            className="bg-[#0A0A0A] border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.03)] relative z-10"
            role="log"
            aria-label="System boot terminal"
            aria-live="polite"
          >
            {/* Terminal title bar */}
            <div className="bg-[#111111] border-b border-white/[0.05] px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="flex gap-1.5" aria-hidden="true">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                <div className="w-3 h-3 rounded-full bg-[#28C840]" />
              </div>
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest ml-2">
                CompoundOS // TTY1
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-mono text-emerald-600 uppercase tracking-widest">LIVE</span>
              </div>
            </div>

            {/* Terminal body — has its OWN fixed-height scroll container.
                This is the critical fix. scrollIntoView on terminalEndRef
                moves ONLY within this box. The page viewport never moves.
                block:'nearest' in the useEffect seals this guarantee. */}
            <div
              className="p-5 md:p-6 font-mono text-[11px] md:text-[12px] leading-relaxed"
              style={{ height: '300px', overflowY: 'auto' }}
            >
              {mounted && logs.map((log, index) => (
                <p
                  key={`log-${index}`}
                  className={[
                    'mb-1.5',
                    log.includes('[OK]') || log.includes('[SEC]') || log.includes('[NODE]')
                      ? 'text-emerald-400'
                      : log.includes('[VAULT]')
                      ? 'text-blue-300 font-semibold'
                      : log.includes('OPTIMAL')
                      ? 'text-blue-400 font-bold'
                      : log.includes('[RPC]') || log.includes('[INDEX]')
                      ? 'text-neutral-300'
                      : 'text-neutral-500',
                  ].join(' ')}
                >
                  {log}
                </p>
              ))}

              {mounted && logs.length < BOOT_SEQUENCE.length && (
                <p className="text-neutral-500 flex items-center gap-2 mt-1" aria-hidden="true">
                  <span>&gt;</span>
                  <span className="inline-block w-2 h-[14px] bg-neutral-400 animate-pulse" />
                </p>
              )}

              {/* Scroll anchor — scoped inside terminal's overflow container only */}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Section ──────────────────────────────────────────────────── */}
      <section className="relative z-10 w-full max-w-[1400px] mx-auto px-6 pb-24 md:pb-32">
        <div className="flex items-center gap-4 mb-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-[0.2em]">
            Core Protocol Architecture
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.id}
              className={[
                'group relative bg-[#0A0A0A] border rounded-2xl p-6 md:p-7 transition-all duration-300',
                'hover:bg-[#0f0f0f] hover:shadow-[0_0_40px_rgba(0,0,0,0.6)]',
                feature.featured
                  ? 'border-white/10 ring-1 ring-white/5 md:-translate-y-2'
                  : 'border-white/[0.06]',
              ].join(' ')}
            >
              {feature.featured && (
                <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
              )}

              <div className={['w-12 h-12 rounded-xl border flex items-center justify-center mb-5', feature.iconBg].join(' ')}>
                <svg className={['w-6 h-6', feature.iconColor].join(' ')} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feature.iconPath} />
                </svg>
              </div>

              <h3 className="text-[11px] font-mono font-bold text-white uppercase tracking-widest mb-3">
                {feature.title}
              </h3>

              <p className="text-[12px] md:text-[13px] text-neutral-500 leading-relaxed font-mono">
                {feature.description}
              </p>

              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.02) 0%, transparent 70%)' }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.05] px-6 py-6 md:px-12">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[9px] font-mono text-neutral-700 uppercase tracking-[0.2em]">
            SYSTEM CORE V1.0.0 • BASE NETWORK • COMPOUNDOS DEPIN
          </p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 animate-pulse" />
            <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">
              All Systems Operational
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}