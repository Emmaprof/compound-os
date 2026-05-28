'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LandingPage() {
  const router = useRouter();
  
  // Terminal Animation State
  const [terminalText, setTerminalText] = useState<string[]>([
    '> [MEM] DOM Virtualization engine idle.'
  ]);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    const sequences = [
      '> [LEDGER] Immutable receipt confirmed on-chain.',
      '> [NODE] DePIN infrastructure status: OPTIMAL.',
      '> [VAULT] 0-Click relayer payload verified.',
      '> [INDEX] Matrix synchronized across 12 active nodes.',
      '> [RPC] Base Sepolia latency: 12ms.',
      '> [SEC] Row Level Security policies active.'
    ];
    
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < sequences.length) {
        setTerminalText(prev => {
          const newText = [...prev, sequences[currentIndex]];
          if (newText.length > 6) newText.shift();
          return newText;
        });
        currentIndex++;
      } else {
        currentIndex = 0;
      }
    }, 2500);
    
    return () => clearInterval(interval);
  }, []);

  const handleInitialize = () => {
    setIsInitializing(true);
    setTimeout(() => {
      router.push('/auth');
    }, 800);
  };

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-white flex flex-col font-sans selection:bg-blue-500/30">
      
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-5 md:px-10 border-b border-white/[0.04] bg-black/50 backdrop-blur-md relative z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 p-[1px]">
            <div className="w-full h-full bg-black rounded-lg flex items-center justify-center">
              <span className="w-2 h-2 bg-white rounded-sm shadow-[0_0_10px_rgba(255,255,255,0.8)]"></span>
            </div>
          </div>
          <span className="text-lg font-bold tracking-tight text-white">CompoundOS</span>
        </div>
        
        <button 
          onClick={handleInitialize}
          className="bg-white hover:bg-neutral-200 text-black px-5 py-2.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest transition-colors"
        >
          {isInitializing ? 'INITIALIZING...' : 'ACCESS TERMINAL'}
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center px-6 lg:px-20 py-12 gap-12 lg:gap-20 relative z-10">
        
        {/* Left Column: Copy */}
        <div className="flex-1 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest">Base L2 Infrastructure Live</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter leading-[1.05] text-white mb-6">
            Decentralized <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-200 to-white">Physical</span> <br />
            Infrastructure.
          </h1>

          <p className="text-sm md:text-base text-neutral-400 font-mono leading-relaxed mb-10 max-w-xl">
            An elite protocol engine for residential management. True 0-click USDC relayer execution, infinite DOM virtualization, and cryptographic invariant logging. Architected for the future internet.
          </p>

          <button 
            onClick={handleInitialize}
            disabled={isInitializing}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-xs font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)] flex items-center gap-3 disabled:opacity-50"
          >
            {isInitializing ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            )}
            Initialize Node Workspace
          </button>
        </div>

        {/* Right Column: Terminal Window */}
        <div className="flex-1 w-full max-w-2xl relative">
          <div className="absolute inset-0 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
          
          <div className="bg-[#0A0A0A] border border-white/[0.05] rounded-2xl overflow-hidden shadow-2xl relative z-10 aspect-[4/3] flex flex-col">
            <div className="bg-[#111] border-b border-white/[0.05] px-4 py-3 flex items-center gap-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">CompoundOS System Node // TTY1</span>
            </div>
            
            <div className="p-6 font-mono text-[11px] md:text-xs leading-relaxed flex-1 overflow-hidden relative">
               <div className="absolute bottom-6 left-6 space-y-3">
                 {terminalText.map((text, i) => (
                   <p key={i} className={`${text.includes('receipt') ? 'text-white font-bold' : text.includes('VAULT') ? 'text-blue-400' : 'text-neutral-500'} animate-in fade-in slide-in-from-bottom-2`}>
                     {text}
                   </p>
                 ))}
                 <p className="text-emerald-500 flex items-center gap-2 mt-2">
                   <span>&gt;</span>
                   <span className="w-2 h-4 bg-emerald-500 animate-pulse"></span>
                 </p>
               </div>
            </div>
          </div>
        </div>

      </main>

      {/* Feature Footer */}
      <footer className="grid grid-cols-1 md:grid-cols-3 gap-6 px-6 lg:px-20 py-10 border-t border-white/[0.04] bg-black/30 relative z-10">
        <div className="bg-[#0A0A0A] border border-white/[0.02] p-6 rounded-2xl">
          <h3 className="text-[11px] font-bold font-mono text-white uppercase tracking-widest mb-3">0-Click Vault Relayer</h3>
          <p className="text-[9px] text-neutral-500 font-mono leading-relaxed">Account Abstraction architecture. Execute USDC settlements autonomously without constant wallet signature prompts.</p>
        </div>
        <div className="bg-[#0A0A0A] border border-white/[0.02] p-6 rounded-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full"></div>
          <h3 className="text-[11px] font-bold font-mono text-emerald-400 uppercase tracking-widest mb-3 relative z-10 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Cryptographic Ledgers
          </h3>
          <p className="text-[9px] text-neutral-500 font-mono leading-relaxed relative z-10">Trustless immutability on Base L2. Every network clearance is stamped with a verifiable, immutable transaction hash.</p>
        </div>
        <div className="bg-[#0A0A0A] border border-white/[0.02] p-6 rounded-2xl">
          <h3 className="text-[11px] font-bold font-mono text-white uppercase tracking-widest mb-3">Infinite Scalability</h3>
          <p className="text-[9px] text-neutral-500 font-mono leading-relaxed">Engineered with React DOM Virtualization. Scroll through 5 years of receipt history with zero memory fragmentation.</p>
        </div>
      </footer>
    </div>
  );
}