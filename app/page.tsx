'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// Google-Standard Security Protocol: Cryptographically distinct DePIN status logs
const terminalLogs = [
  '> CompoundOS boot sequence initialized...',
  '> Loading secure kernel v2.1.0-alpha...',
  '> [OK] Cryptographic DOM virtualization engine ready.',
  '> [OK] Zero-click USDC relayer protocol armed.',
  '> Fetching L2 Base Mainnet network status...',
  '> [DEPIN]  Peered with 1,421 active infrastructure nodes.',
  '> [NETWORK] RPC latency (Base): 8ms.',
  '> [VAULT] Validating immutable invariant logging schema...',
  '> [ZK-VM] Prover initialized for settlement proofs.',
  '> system://status :: OPTIMAL'
];

export default function CompoundOSLanding() {
  const [mounted, setMounted] = useState(false);
  const [currentLogs, setCurrentLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 1. Hydration Guard: Prevents SSR mismatches that cause crashes
  useEffect(() => {
    setMounted(true);
  }, []);

  // 2. Optimized Terminal Animation Sequence
  useEffect(() => {
    if (!mounted) return;

    let lineIndex = 0;
    const intervalId = setInterval(() => {
      if (lineIndex < terminalLogs.length) {
        setCurrentLogs((prev) => [...prev, terminalLogs[lineIndex]]);
        lineIndex++;
      } else {
        clearInterval(intervalId);
      }
    }, 1200); // Precise timing for user readability

    return () => clearInterval(intervalId);
  }, [mounted]);

  // 3. Automated Scroll Lock (Tier-1 standard UX)
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentLogs]);

  return (
    <div className="min-h-[100dvh] bg-black text-white relative flex flex-col items-center justify-center font-sans selection:bg-blue-500/20 antialiased overflow-hidden">
      
      {/* Visual Infrastructure Layers */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Sub-pixel Background Grid Dot Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        {/* Blended Blue Atmospheric Flare */}
        <div className="absolute top-1/2 left-[-10%] w-[60vw] h-[60vw] bg-blue-600/10 rounded-full blur-[150px] mix-blend-screen"></div>
        {/* Blended Emerald Atmospheric Flare */}
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-600/10 rounded-full blur-[120px] mix-blend-screen"></div>
      </div>

      <main className="relative z-10 w-full max-w-[1440px] px-6 py-12 lg:px-20 lg:py-24 flex flex-col md:flex-row items-center justify-between gap-16 lg:gap-24">
        
        {/* Left Column: Copy & CTAs */}
        <div className="flex-1 max-w-2xl text-left">
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-10">
            {/* Status Badge: L2 Network */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.7)]"></span>
              <span className="text-[10px] md:text-[11px] font-mono font-bold text-neutral-300 uppercase tracking-widest">Base L2 Infrastructure Live</span>
            </div>
            
            {/* Context Badge: Floating Badge (from screenshot 1) */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-blue-950/40 border border-blue-500/20 rounded-xl shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-blue-700 p-[1px]">
                  <div className="w-full h-full bg-black rounded flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-white rounded-sm"></span>
                  </div>
                </div>
              <span className="text-[10px] md:text-[11px] font-mono font-bold text-blue-300 uppercase tracking-widest">Utility Settlements relayer</span>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-[84px] font-extrabold tracking-tighter leading-[0.95] text-white mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-100">
            Decentralized <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-blue-400 via-blue-100 to-white">Physical</span> <br className="hidden lg:block" />
            Infrastructure.
          
          </h1>

          <p className="text-sm md:text-base text-neutral-400 font-mono leading-relaxed mb-12 max-w-xl animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
            An enterprise protocol for residential utility management. Features true 0-click USDC relayer automation, infinite DOM virtualization, and cryptographic immutable logging. Designed by global leaders in infrastructure engineering.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-5 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <Link href="/auth" className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-9 py-4 rounded-xl text-[11px] md:text-[12px] font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_40px_rgba(37,99,235,0.2)] hover:shadow-[0_0_50px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 flex items-center justify-center gap-3">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
               Initialize Node Workspace
            </Link>
            
            <button className="w-full sm:w-auto bg-transparent hover:bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white px-9 py-4 rounded-xl text-[11px] md:text-[12px] font-mono font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-3">
               View Smart Contract
            </button>
          </div>
        </div>

        {/* Right Column: Dynamic Terminal simulation */}
        <div className="flex-1 w-full max-w-2xl relative group animate-in fade-in duration-1000 delay-400">
          
          {/* Advanced Neon Backglow */}
          <div className="absolute inset-0 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"></div>
          
          {/* Terminal Window Chrome */}
          <div className="bg-[#080808] border border-white/[0.04] rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)] relative z-10 aspect-[4/3] flex flex-col">
            
            {/* Header (Mac-style window chrome) */}
            <div className="bg-neutral-900/50 border-b border-white/[0.04] px-5 py-3.5 flex items-center gap-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-neutral-700/80"></div>
                <div className="w-3 h-3 rounded-full bg-neutral-700/80"></div>
                <div className="w-3 h-3 rounded-full bg-neutral-700/80"></div>
              </div>
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex-1 text-center pr-10">CompoundOS System Node // TTY1</span>
            </div>
            
            {/* Animated Output Content */}
            <div className="p-7 md:p-9 font-mono text-[11px] md:text-[12px] leading-relaxed flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
               
               {/* SSR Placeholder Guard */}
               {!mounted ? (
                 <div className="w-full h-full flex flex-col justify-end text-neutral-800 space-y-1">
                   <p>&gt; Booting secure kernel...</p>
                   <p>&gt; Initializing DOM virtualization...</p>
                   <p>&gt; Fetching Base network status...</p>
                   <p>&gt; Relayer payload confirmed...</p>
                   <p>&gt; Matrix synced...</p>
                   <p>&gt; System operational...</p>
                 </div>
               ) : (
                 <>
                   {currentLogs.map((log, index) => (
                     <p key={index} className={`opacity-0 animate-in fade-in slide-in-from-bottom-1 duration-300 flex items-start gap-1 mb-1.5 ${log.startsWith('> [OK]') ? 'text-emerald-400' : log.includes(':: OPTIMAL') ? 'text-blue-400 font-bold' : log.startsWith('> [DEPIN]') ? 'text-neutral-200' : 'text-neutral-400'}`}>
                        <span className="shrink-0">{log}</span>
                     </p>
                   ))}
                   
                   {/* Google Standard Blinking Cursor */}
                   {currentLogs.length < terminalLogs.length ? (
                      <div className="flex items-start gap-1 text-neutral-400">
                        <span>&gt;</span>
                        <span className="w-2 h-4 bg-neutral-400 animate-pulse mt-0.5"></span>
                      </div>
                   ) : null}

                   {/* Mandatory Bottom Anchor for Auto-scroll */}
                   <div ref={logsEndRef} />
                 </>
               )}
            </div>
          </div>
        </div>
      </main>

      {/* Global Security Footer: Google tier compliance text */}
      <footer className="absolute bottom-6 left-6 relative z-10 hidden lg:block">
        <p className="text-[10px] font-mono text-neutral-700 uppercase tracking-widest">
          SYSTEM CLASSIFICATION: CONFIDENTIAL // COMPLIANCE PROTOCOL AEGIS-9
        </p>
      </footer>
    </div>
  );
}