'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase'; 
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import Link from 'next/link';

export default function AuthTerminal() {
  const router = useRouter();
  const { isConnected } = useAccount();
  
  const [authMode, setAuthMode] = useState<'SIGN_IN' | 'SIGN_UP'>('SIGN_IN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // SECURE ROUTING LOOP: Only redirect if a true Database Session exists.
  useEffect(() => {
    const verifyDatabaseSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      }
    };
    verifyDatabaseSession();
  }, [router]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      if (authMode === 'SIGN_UP') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setErrorMsg('Node registered. Check email for cryptographic verification.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/dashboard` }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-[#050505] text-white relative overflow-hidden font-sans">
      
      {/* Background Gradients */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/5 rounded-full blur-[120px] mix-blend-screen"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] bg-emerald-600/5 rounded-full blur-[100px] mix-blend-screen"></div>
      </div>

      {/* Left Column - Branding */}
      <div className="hidden md:flex flex-1 flex-col justify-between p-12 border-r border-white/[0.05] relative z-10 bg-black/40 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 p-[1px] shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            <div className="w-full h-full bg-black rounded-lg flex items-center justify-center">
              <span className="w-2 h-2 bg-white rounded-sm shadow-[0_0_10px_rgba(255,255,255,0.8)]"></span>
            </div>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white">CompoundOS</h1>
        </Link>

        <div>
          <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tighter leading-[1.1] text-white mb-6">
            Authenticate <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-emerald-400 to-white">Infrastructure Node.</span>
          </h2>
          <p className="text-sm text-neutral-400 font-mono leading-relaxed max-w-md">
            Secure entry protocol for CompoundOS residents and administrators. All active sessions are cryptographically bound to the Base L2 Network.
          </p>
        </div>

        <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          SECURE CONNECTION • 256-BIT ENCRYPTION
        </p>
      </div>

      {/* Right Column - Auth Interface */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10">
        
        {/* Mobile Header */}
        <Link href="/" className="absolute top-6 left-6 md:hidden flex items-center gap-3 cursor-pointer">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-blue-700 p-[1px]">
            <div className="w-full h-full bg-black rounded flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-white rounded-sm"></span>
            </div>
          </div>
          <h1 className="text-sm font-bold tracking-tight text-white">CompoundOS</h1>
        </Link>

        <div className="w-full max-w-[400px] mt-12 md:mt-0">
          
          <div className="flex items-center gap-6 border-b border-white/10 mb-8 pb-4">
            <button 
              onClick={() => { setAuthMode('SIGN_IN'); setErrorMsg(''); }}
              className={`text-[11px] font-mono font-bold uppercase tracking-widest transition-colors ${authMode === 'SIGN_IN' ? 'text-white border-b-2 border-white pb-4 -mb-[18px]' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => { setAuthMode('SIGN_UP'); setErrorMsg(''); }}
              className={`text-[11px] font-mono font-bold uppercase tracking-widest transition-colors ${authMode === 'SIGN_UP' ? 'text-white border-b-2 border-white pb-4 -mb-[18px]' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              Register Node
            </button>
          </div>

          <div className="space-y-6">
            
            <div className="space-y-4">
              <button 
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-200 text-black py-4 rounded-xl text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>

              {/* Standard RainbowKit Connect Button - This fixes the state issue */}
              <div className="w-full flex justify-center py-1 [&>div]:w-full [&_button]:w-full [&_button]:py-4 [&_button]:font-mono [&_button]:text-[10px] [&_button]:uppercase [&_button]:tracking-widest [&_button]:font-bold [&_button]:bg-[#111] [&_button]:hover:bg-[#222] [&_button]:border [&_button]:border-white/10 [&_button]:rounded-xl">
                 <ConnectButton 
                   label="Connect Web3 Identity" 
                   showBalance={false}
                   chainStatus="icon"
                 />
              </div>
            </div>

            <div className="flex items-center gap-4 py-3">
              <div className="h-px bg-white/10 flex-1"></div>
              <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">OR EMAIL</span>
              <div className="h-px bg-white/10 flex-1"></div>
            </div>

            {/* EMAIL FORM */}
            <form onSubmit={handleEmailAuth} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono text-neutral-400 uppercase tracking-widest pl-1">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="node@compound.os" 
                  className="w-full bg-[#0A0A0A] border border-white/10 px-4 py-4 rounded-xl font-mono text-[11px] text-white placeholder-neutral-700 focus:outline-none focus:border-blue-500/50 transition-colors shadow-inner" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-mono text-neutral-400 uppercase tracking-widest pl-1">Cryptographic Key (Password)</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••" 
                  className="w-full bg-[#0A0A0A] border border-white/10 px-4 py-4 rounded-xl font-mono text-[11px] text-white placeholder-neutral-700 focus:outline-none focus:border-blue-500/50 transition-colors shadow-inner" 
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <p className="text-[10px] font-mono text-red-400 leading-relaxed">{errorMsg}</p>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] disabled:opacity-50 mt-2"
              >
                {isLoading ? 'Executing...' : authMode === 'SIGN_IN' ? 'Initialize Session' : 'Create Identity'}
              </button>
            </form>

            <div className="mt-8 text-center border-t border-white/[0.05] pt-6">
              <a 
                href="/privacy" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-mono text-neutral-500 hover:text-white uppercase tracking-widest transition-colors"
              >
                Review Protocol Data Handling
              </a>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}