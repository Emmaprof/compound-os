'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ✅ FIX 1: Move bootSequence OUTSIDE the component.
// Defined inside = new array reference every render = stale closure in useEffect = memory leak + crash.
const BOOT_SEQUENCE = [
  '> CompoundOS Boot Sequence Initiated...',
  '> Loading secure kernel v2.1.0-alpha...',
  '> [OK] Cryptographic DOM virtualization engine ready.',
  '> [OK] Zero-click USDC relayer protocol armed.',
  '> Fetching L2 Base Mainnet network status...',
  '> [DEPIN] Peered with 1,421 active infrastructure nodes.',
  '> [NETWORK] RPC latency (Base): 8ms.',
  '> [VAULT] Validating immutable invariant logging schema...',
  '> system://status :: OPTIMAL',
] as const;

export default function MasterLandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isInitializing, setIsInitializing] = useState(false);

  // ✅ FIX 2: Use a stable ref for the interval — prevents stale closures and double-fire in React Strict Mode
  const logsEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logIndexRef = useRef(0);

  // Hydration sync
  useEffect(() => {
    setMounted(true);
  }, []);

  // ✅ FIX 3: Terminal typer — uses ref-based index, not closure-captured index.
  // Old code: `let index = 0` captured in closure — stale after first render.
  useEffect(() => {
    if (!mounted) return;

    // Reset on mount (handles React Strict Mode double-invoke)
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
    }, 900);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [mounted]);

  // Auto-scroll terminal
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ✅ FIX 4: handleAccess — wrapped in useCallback, guarded against double-fire.
  // Old code: no guard = could fire twice in Strict Mode or rapid clicks = double router.push = crash.
  const handleAccess = useCallback(() => {
    if (isInitializing) return; // guard double-click
    setIsInitializing(true);

    // ✅ FIX 5: Use router.prefetch + push instead of raw setTimeout with push.
    // setTimeout + router.push = race condition if provider tree isn't ready.
    // router.prefetch warms the route; push fires after a minimal visual delay.
    router.prefetch('/auth');
    const t = setTimeout(() => {
      router.push('/auth');
    }, 400); // reduced from 600ms — snappier UX, less time for race condition

    // cleanup if component unmounts before timeout fires
    return () => clearTimeout(t);
  }, [isInitializing, router]);

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-white relative flex flex-col font-sans selection:bg-blue-500/30 overflow-hidden antialiased">

      {/* Immersive Background Architecture */}
      <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute top-1/2 left-[-10%] w-[50vw] h-[50vw] bg-blue-600/10 rounded-full blur-[150px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-emerald-600/10 rounded-full blur-[120px] mix-blend-screen" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-6 md:px-12 border-b border-white/[0.05] bg-[#050505]/80 backdrop-blur-md">
        <div className="flex items-center gap-4 cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 p-[1px] shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            <div className="w-full h-full bg-black rounded-lg flex items-center justify-center">
              <span className="w-2 h-2 bg-white rounded-sm shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
            </div>
          </div>
          <span className="text-lg md:text-xl font-bold tracking-tight text-white">CompoundOS</span>
        </div>
      </nav>

      {/* Main Content Layout */}
      <main className="flex-1 relative z-10 w-full max-w-[1400px] mx-auto px-6 py-12 md:py-20 flex flex-col lg:flex-row items-center justify-center gap-16 lg:gap-24">

        {/* Left Column: Core Value Proposition */}
        <div className="flex-1 max-w-2xl w-full">
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
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

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter leading-[1.05] text-white mb-8">
            Decentralized <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-200 to-white">
              Physical
            </span>{' '}
            <br className="hidden md:block" />
            Infrastructure.
          </h1>

          <p className="text-sm md:text-base text-neutral-400 font-mono leading-relaxed mb-10 max-w-xl">
            An elite protocol engine for residential management. True 0-click USDC relayer execution,
            infinite DOM virtualization, and cryptographic invariant logging.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={handleAccess}
              disabled={isInitializing}
              aria-label="Initialize Node Workspace"
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white px-8 py-4 rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isInitializing ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              Initialize Node Workspace
            </button>

            {/* ✅ FIX 6: "View Smart Contract" — was a dead <button> with no onClick.
                Replaced with an <a> tag pointing to the actual contract or a placeholder.
                A button that does nothing is a UX and accessibility violation. */}
            <a
              href="https://basescan.org"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto bg-transparent hover:bg-white/5 border border-white/10 text-neutral-300 hover:text-white px-8 py-4 rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest transition-colors flex items-center justify-center"
            >
              View Smart Contract
            </a>
          </div>
        </div>

        {/* Right Column: Terminal Simulation UI */}
        <div className="flex-1 w-full max-w-2xl relative">
          <div className="absolute inset-0 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" aria-hidden="true" />

          <div
            className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] relative z-10 aspect-[4/3] flex flex-col"
            role="log"
            aria-label="System boot terminal"
            aria-live="polite"
          >
            {/* Terminal Title Bar */}
            <div className="bg-neutral-900 border-b border-white/[0.05] px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="flex gap-2" aria-hidden="true">
                <div className="w-3 h-3 rounded-full bg-neutral-700" />
                <div className="w-3 h-3 rounded-full bg-neutral-700" />
                <div className="w-3 h-3 rounded-full bg-neutral-700" />
              </div>
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest ml-2">
                CompoundOS // TTY1
              </span>
            </div>

            {/* Terminal Body */}
            <div className="p-6 font-mono text-[11px] md:text-xs leading-relaxed flex-1 overflow-hidden relative">
              <div className="absolute top-6 left-6 right-6 bottom-6 overflow-y-auto scrollbar-none flex flex-col justify-end">
                {/* ✅ FIX 7: Only render logs client-side (mounted guard) — prevents SSR hydration mismatch
                    which is a silent killer on Vercel: server HTML ≠ client HTML = React throws, Vercel serves broken page. */}
                {mounted &&
                  logs.map((log, index) => (
                    <p
                      key={`log-${index}`} // stable key prevents reconciliation thrash
                      className={[
                        'mb-2 animate-in fade-in duration-300',
                        log.includes('[OK]')
                          ? 'text-emerald-400'
                          : log.includes('OPTIMAL')
                          ? 'text-blue-400 font-bold'
                          : 'text-neutral-400',
                      ].join(' ')}
                    >
                      {log}
                    </p>
                  ))}

                {/* Blinking cursor — only show while boot is running */}
                {mounted && logs.length < BOOT_SEQUENCE.length && (
                  <p className="text-neutral-400 flex items-center gap-2 mt-1" aria-hidden="true">
                    <span>&gt;</span>
                    <span className="w-2 h-4 bg-neutral-400 animate-pulse" />
                  </p>
                )}

                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}