'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function LandingPage() {
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydration Guard: Ensures smooth Vercel SSR rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleInitialize = () => {
    setIsInitializing(true);
    // Simulates a secure connection sequence before routing to the Auth screen
    setTimeout(() => {
      router.push('/auth');
    }, 800);
  };

  // Prevent rendering until client is mounted to avoid hydration mismatch
  if (!mounted) return null;

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-white flex flex-col items-center justify-center relative overflow-hidden font-sans">
      
      {/* Background Engineering Grid */}
      <div className="absolute inset-0 z-0 opacity-[0.15]" style={{ backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/80 to-[#050505] z-0 pointer-events-none"></div>

      {/* Atmospheric Glowing Orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-blue-600/20 rounded-full blur-[100px] md:blur-[150px] pointer-events-none z-0 mix-blend-screen"></div>

      {/* Central Terminal Interface */}
      <div className="relative z-10 w-full max-w-[420px] p-6 animate-in fade-in zoom-in-95 duration-700">
        <div className="bg-[#0A0A0A]/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,1)] overflow-hidden">

          {/* Terminal Header */}
          <div className="border-b border-white/10 p-4 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            </div>
            <span className="text-[9px] font-mono text-neutral-500 tracking-widest uppercase">Network Status: Optimal</span>
          </div>

          {/* Terminal Body */}
          <div className="p-8 md:p-10 text-center flex flex-col items-center">
            
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-[1px] mb-6 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
              <div className="w-full h-full bg-[#050505] rounded-2xl flex items-center justify-center">
                <span className="w-4 h-4 bg-white rounded shadow-[0_0_10px_rgba(255,255,255,1)]"></span>
              </div>
            </div>

            <div className="w-full mb-8 space-y-1">
              <h2 className="text-[9px] md:text-[10px] text-blue-400 font-mono font-bold tracking-widest uppercase">CompoundOS / Infrastructure Node</h2>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">Welcome to CompoundOS</h1>
            </div>

            <div className="w-full bg-[#000] border border-white/5 rounded-2xl p-5 mb-8 shadow-inner">
              <p className="text-xs text-neutral-400 font-mono tracking-wider">Node Access Terminal</p>
              <div className="mt-2.5 flex items-center justify-center gap-2">
                 <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">System Operational</span>
                 <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">Latency 12ms</span>
              </div>
            </div>

            <button
              onClick={handleInitialize}
              disabled={isInitializing}
              className="w-full bg-white hover:bg-neutral-200 text-black py-4 rounded-xl text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3"
            >
              {isInitializing ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                  Establishing Secure Link...
                </>
              ) : (
                'Initialize Secure Workspace'
              )}
            </button>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest">
            SECURE CONNECTION • 256-BIT ENCRYPTION
          </p>
        </div>
      </div>
    </div>
  );
}