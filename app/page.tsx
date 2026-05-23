'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function LandingPage() {
  const router = useRouter();
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([
    "[SYS] Initializing CompoundOS Core...",
    "[NET] Connecting to Base Sepolia L2...",
    "[AUTH] Verifying cryptographic signatures..."
  ]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Live Telemetry Simulation Engine
  useEffect(() => {
    const logs = [
      "[VAULT] 0-Click relayer payload verified.",
      "[INDEX] Matrix synchronized across 12 active nodes.",
      "[RPC] Base Sepolia latency: 12ms.",
      "[SEC] Row Level Security policies active.",
      "[MEM] DOM Virtualization engine idle.",
      "[LEDGER] Immutable receipt confirmed on-chain.",
      "[NODE] DePIN infrastructure status: OPTIMAL."
    ];
    
    let currentIndex = 0;
    const interval = setInterval(() => {
      setTelemetryLogs(prev => {
        const newLogs = [...prev, logs[currentIndex]];
        return newLogs.length > 5 ? newLogs.slice(newLogs.length - 5) : newLogs;
      });
      currentIndex = (currentIndex + 1) % logs.length;
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // Secure Routing Engine
  useEffect(() => {
    const checkActiveSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      }
    };
    checkActiveSession();
  }, [router]);

  // Clean, Synchronous Routing to the new Auth Terminal
  const handleAuthentication = () => {
    setIsAuthenticating(true);
    router.push('/auth');
  };

  return (
    <div className="min-h-[100dvh] bg-black text-white font-sans selection:bg-blue-500/30 overflow-hidden relative flex flex-col">
      
      {/* Background Hardware-Accelerated Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-[10000ms]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] bg-emerald-600/10 rounded-full blur-[100px] mix-blend-screen"></div>
        <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.2) 1px, transparent 0)`, backgroundSize: '40px 40px' }}></div>
      </div>

      {/* Minimalist Top Navigation */}
      <header className="relative z-20 flex justify-between items-center px-6 md:px-12 py-6 border-b border-white/[0.05] bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-4 group cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 p-[1px] shadow-[0_0_20px_rgba(59,130,246,0.3)] group-hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all duration-500">
            <div className="w-full h-full bg-black rounded-xl flex items-center justify-center">
              <span className="w-3 h-3 bg-white rounded-sm shadow-[0_0_10px_rgba(255,255,255,0.8)]"></span>
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-500">CompoundOS</h1>
        </div>
        
        <button 
          onClick={handleAuthentication} 
          disabled={isAuthenticating}
          className="bg-white hover:bg-neutral-200 text-black px-6 py-2.5 rounded-lg text-[10px] md:text-xs font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-50"
        >
          {isAuthenticating ? 'Initializing...' : 'Access Terminal'}
        </button>
      </header>

      {/* Hero Core */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-6 py-12 md:py-24 max-w-7xl mx-auto w-full gap-16">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center w-full">
          
          {/* Left Column: Architect Intent */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/[0.03] border border-white/10 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              <span className="text-[10px] font-mono font-bold text-neutral-300 uppercase tracking-widest">Base L2 Infrastructure Live</span>
            </div>
            
            <h2 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[1.1] text-white">
              Decentralized <br className="hidden md:block" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-200 to-white">Physical Infrastructure.</span>
            </h2>
            
            <p className="text-sm md:text-base text-neutral-400 font-mono leading-relaxed max-w-xl">
              An elite protocol engine for residential management. True 0-click USDC relayer execution, infinite DOM virtualization, and cryptographic invariant logging. Architected for the future internet.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button 
                onClick={handleAuthentication}
                className="group relative inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-xs font-mono font-bold uppercase tracking-widest transition-all overflow-hidden shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_50px_rgba(37,99,235,0.5)]"
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-[shimmer_2s_infinite]"></div>
                <span className="relative flex items-center gap-3">
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  Initialize Node Workspace
                </span>
              </button>
            </div>
          </div>

          {/* Right Column: Live Telemetry Terminal */}
          <div className="relative w-full aspect-[4/3] max-w-xl mx-auto lg:ml-auto">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/20 to-emerald-500/5 blur-3xl rounded-full"></div>
            <div className="absolute inset-0 bg-[#050505] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col group hover:border-blue-500/30 transition-colors duration-500">
              
              <div className="h-10 border-b border-white/10 flex items-center px-4 gap-2 bg-white/[0.02] shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                <span className="ml-4 text-[9px] font-mono text-neutral-500 uppercase tracking-widest">CompoundOS System Node // tty1</span>
              </div>
              
              <div className="flex-1 p-6 font-mono text-[10px] md:text-xs overflow-hidden flex flex-col justify-end space-y-2">
                {telemetryLogs.map((log, i) => (
                  <div key={i} className="flex gap-3 text-neutral-400 animate-in fade-in slide-in-from-bottom-2">
                    <span className="text-emerald-500 shrink-0">{'>'}</span>
                    <span className={`${log.includes('[VAULT]') ? 'text-blue-400 font-bold' : log.includes('[LEDGER]') ? 'text-white font-bold' : 'text-neutral-400'}`}>
                      {log}
                    </span>
                  </div>
                ))}
                <div className="flex gap-3 text-emerald-500 animate-pulse mt-2">
                  <span>{'>'}</span>
                  <span className="w-2 h-4 bg-emerald-500 inline-block"></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bento Box Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-12 md:pt-24 border-t border-white/[0.05]">
          
          <div className="bg-[#050505] border border-white/5 p-8 rounded-3xl hover:border-blue-500/30 hover:bg-white/[0.02] hover:-translate-y-1 transition-all duration-500 group shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full"></div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-3">0-Click Vault Relayer</h3>
            <p className="text-[11px] text-neutral-500 font-mono leading-relaxed">Account Abstraction architecture. Execute USDC settlements autonomously without constant wallet signature prompts.</p>
          </div>

          <div className="bg-[#050505] border border-white/5 p-8 rounded-3xl hover:border-emerald-500/30 hover:bg-white/[0.02] hover:-translate-y-1 transition-all duration-500 group shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full"></div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            </div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-3">Cryptographic Ledgers</h3>
            <p className="text-[11px] text-neutral-500 font-mono leading-relaxed">Trustless immutability on Base L2. Every network clearance is stamped with a verifiable, immutable transaction hash.</p>
          </div>

          <div className="bg-[#050505] border border-white/5 p-8 rounded-3xl hover:border-purple-500/30 hover:bg-white/[0.02] hover:-translate-y-1 transition-all duration-500 group shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full"></div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            </div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-3">Infinite Scalability</h3>
            <p className="text-[11px] text-neutral-500 font-mono leading-relaxed">Engineered with React DOM Virtualization. Scroll through 5 years of receipt history with zero memory fragmentation.</p>
          </div>

        </div>
      </main>

      <footer className="relative z-10 border-t border-white/[0.05] py-8 text-center bg-black">
        <p className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest">
          SYSTEM CORE V1.0.0 • BASE NETWORK • COMPOUNDOS DEPIN
        </p>
      </footer>
    </div>
  );
}