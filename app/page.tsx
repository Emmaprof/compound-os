'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-[100dvh] bg-black text-white relative overflow-hidden font-sans selection:bg-blue-500/30">
      
      {/* Immersive Background Gradients */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-blue-600/10 rounded-full blur-[150px] mix-blend-screen animate-pulse duration-10000"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-600/10 rounded-full blur-[150px] mix-blend-screen"></div>
        <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.2) 1px, transparent 0)`, backgroundSize: '40px 40px' }}></div>
      </div>

      {/* Transparent Navigation Bar */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-6 md:px-12 md:py-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 p-[1px] shadow-[0_0_20px_rgba(59,130,246,0.4)]">
            <div className="w-full h-full bg-black rounded-xl flex items-center justify-center">
              <span className="w-2.5 h-2.5 bg-white rounded-sm shadow-[0_0_10px_rgba(255,255,255,0.8)]"></span>
            </div>
          </div>
          <span className="text-lg md:text-xl font-bold tracking-tight text-white">CompoundOS</span>
        </div>
        
        <div className="flex items-center gap-6">
          <Link href="/auth" className="hidden md:block text-xs font-mono uppercase tracking-widest text-neutral-400 hover:text-white transition-colors">
            Protocol Login
          </Link>
          <button 
            onClick={() => router.push('/auth')}
            className="bg-white hover:bg-neutral-200 text-black px-6 py-3 rounded-xl text-[10px] md:text-xs font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            Launch Terminal
          </button>
        </div>
      </nav>

      {/* Main Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100dvh-100px)] px-6 text-center max-w-5xl mx-auto">
        
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
          <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest">Base L2 Mainnet Live</span>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter leading-[1.1] text-white mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
          Decentralized <br className="hidden md:block" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-emerald-400 to-white">Residential OS.</span>
        </h1>

        <p className="text-base md:text-lg text-neutral-400 font-mono leading-relaxed max-w-2xl mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          The autonomous settlement layer for utility management. CompoundOS leverages Web3 cryptography and automated smart contracts to secure, split, and settle residential network bills with zero friction.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
          <button 
            onClick={() => router.push('/auth')}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-8 py-4 rounded-2xl text-[11px] md:text-xs font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(59,130,246,0.3)] flex items-center justify-center gap-3"
          >
            Access Network Node
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </button>
          
          <button 
            onClick={() => window.open('https://basescan.org', '_blank')}
            className="w-full sm:w-auto bg-transparent hover:bg-white/5 border border-white/10 text-white px-8 py-4 rounded-2xl text-[11px] md:text-xs font-mono font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-3"
          >
            View Smart Contract
          </button>
        </div>

        {/* Feature Grid (Optional UI Polish) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 w-full max-w-4xl text-left border-t border-white/5 pt-12 animate-in fade-in duration-1000 delay-500">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4 border border-blue-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider mb-2">Instant Settlements</h3>
            <p className="text-[10px] md:text-xs text-neutral-500 font-mono leading-relaxed">Cryptographic USDC routing bypasses traditional banking latency.</p>
          </div>
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4 border border-emerald-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            </div>
            <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider mb-2">Un-hackable Core</h3>
            <p className="text-[10px] md:text-xs text-neutral-500 font-mono leading-relaxed">Secured directly on the Base Layer 2 Ethereum Network.</p>
          </div>
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4 border border-purple-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            </div>
            <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider mb-2">Automated Matrix</h3>
            <p className="text-[10px] md:text-xs text-neutral-500 font-mono leading-relaxed">Dynamic load balancing and invoice deployment for all active nodes.</p>
          </div>
        </div>

      </main>
    </div>
  );
}