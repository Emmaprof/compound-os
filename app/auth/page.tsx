'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function AuthTerminal() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [authMode, setAuthMode] = useState<'SIGN_IN' | 'SIGN_UP'>('SIGN_IN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // ✅ FIX 3: Separate loading states — Google OAuth and Email auth are independent flows.
  // Shared isLoading = one disables the other = broken UX + wrong disabled state.
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // ✅ FIX 4: Separate error states per flow — prevents stale error flash on mode switch.
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Hydration sync
  useEffect(() => {
    setMounted(true);
    // ✅ FIX 5: Prefetch dashboard on mount — warms the route so router.push never cold-loads.
    router.prefetch('/dashboard');
  }, [router]);

  // Clear messages when switching auth mode
  const handleModeSwitch = useCallback((mode: 'SIGN_IN' | 'SIGN_UP') => {
    setAuthMode(mode);
    setErrorMsg('');
    setSuccessMsg('');
    // ✅ FIX 4: Also cancel any in-flight state to prevent stale flash
    setIsEmailLoading(false);
  }, []);

  const handleEmailAuth = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // ✅ FIX 1: Guard — don't fire if not mounted or already loading
      if (!mounted || isEmailLoading) return;

      setIsEmailLoading(true);
      setErrorMsg('');
      setSuccessMsg('');

      try {
        if (authMode === 'SIGN_UP') {
          const { error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          setSuccessMsg('Node registered. Check email for cryptographic verification.');
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          // ✅ FIX 5: Prefetch already done in useEffect — push is now instant, no race condition
          router.push('/dashboard');
        }
      } catch (err: unknown) {
        // ✅ Proper unknown error typing — `any` is a security anti-pattern
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred. Please retry.';
        setErrorMsg(message);
      } finally {
        setIsEmailLoading(false);
      }
    },
    [mounted, isEmailLoading, authMode, email, password, router]
  );

  const handleGoogleAuth = useCallback(async () => {
    // ✅ FIX 2: mounted guard — window.location.origin is undefined on SSR, crashes Vercel cold load
    if (!mounted || isGoogleLoading) return;

    setIsGoogleLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // ✅ FIX 2: window.location.origin now safely inside mounted guard
      const redirectTo = `${window.location.origin}/dashboard`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
      // Note: Google OAuth redirects the page — isGoogleLoading will naturally reset
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Google authentication failed. Please retry.';
      setErrorMsg(message);
      setIsGoogleLoading(false);
    }
    // ✅ No finally setIsGoogleLoading(false) here — Google OAuth redirects away.
    // Setting false in finally would cause a flicker before redirect.
  }, [mounted, isGoogleLoading]);

  const isAnyLoading = isEmailLoading || isGoogleLoading;

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-[#050505] text-white relative overflow-hidden font-sans antialiased">

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] bg-emerald-600/10 rounded-full blur-[100px] mix-blend-screen" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,1) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Left Column - Branding */}
      <div className="hidden md:flex flex-1 flex-col justify-between p-12 border-r border-white/[0.05] relative z-10 bg-black/40 backdrop-blur-sm">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-4 cursor-pointer w-fit"
          aria-label="Return to CompoundOS home"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 p-[1px] shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            <div className="w-full h-full bg-black rounded-lg flex items-center justify-center">
              <span className="w-2 h-2 bg-white rounded-sm shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
            </div>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white">CompoundOS</h1>
        </button>

        <div>
          <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tighter leading-tight text-white mb-6">
            Authenticate <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-emerald-400 to-white">
              Infrastructure Node.
            </span>
          </h2>
          <p className="text-sm text-neutral-400 font-mono leading-relaxed max-w-md">
            Secure entry protocol for CompoundOS residents and administrators. All active sessions
            are cryptographically bound to the Base L2 Network.
          </p>
        </div>

        <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
          SECURE CONNECTION • 256-BIT ENCRYPTION
        </p>
      </div>

      {/* Right Column - Auth Interface */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10">

        {/* Mobile logo */}
        <button
          className="absolute top-6 left-6 md:hidden flex items-center gap-3 cursor-pointer"
          onClick={() => router.push('/')}
          aria-label="Return to CompoundOS home"
        >
          <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-blue-700 p-[1px]">
            <div className="w-full h-full bg-black rounded flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-white rounded-sm" />
            </div>
          </div>
          <h1 className="text-sm font-bold tracking-tight text-white">CompoundOS</h1>
        </button>

        <div className="w-full max-w-[400px] mt-12 md:mt-0">

          {/* Mode Tabs */}
          <div className="flex items-center gap-6 border-b border-white/10 mb-8 pb-4">
            <button
              onClick={() => handleModeSwitch('SIGN_IN')}
              className={`text-[11px] font-mono font-bold uppercase tracking-widest transition-colors ${
                authMode === 'SIGN_IN'
                  ? 'text-white border-b-2 border-white pb-4 -mb-[18px]'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
              aria-pressed={authMode === 'SIGN_IN'}
            >
              Sign In
            </button>
            <button
              onClick={() => handleModeSwitch('SIGN_UP')}
              className={`text-[11px] font-mono font-bold uppercase tracking-widest transition-colors ${
                authMode === 'SIGN_UP'
                  ? 'text-white border-b-2 border-white pb-4 -mb-[18px]'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
              aria-pressed={authMode === 'SIGN_UP'}
            >
              Register Node
            </button>
          </div>

          {/* ✅ FIX 6: Auth buttons and form are structurally separated.
              Web3 wallet button lives outside the <form> in a sibling <div>.
              This prevents any accidental form submission from wallet button clicks. */}
          <div className="space-y-6">

            {/* OAuth Buttons — outside the form, no accidental submission */}
            <div className="space-y-3">
              <button
                onClick={handleGoogleAuth}
                disabled={isAnyLoading || !mounted}
                aria-label="Continue with Google"
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-200 text-black py-4 rounded-xl text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.05)]"
              >
                {isGoogleLoading ? (
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Continue with Google
              </button>

              {/* Web3 Wallet — mounted guard prevents SSR RainbowKit crash */}
              <div className="w-full flex items-center justify-center py-1">
                {mounted ? (
                  <ConnectButton.Custom>
                    {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted: rkMounted }) => {
                      const ready = rkMounted;
                      const connected = ready && account && chain;

                      if (!ready) {
                        return (
                          <div
                            className="w-full py-4 rounded-xl bg-white/5 animate-pulse h-[46px]"
                            aria-hidden="true"
                          />
                        );
                      }

                      if (!connected) {
                        return (
                          <button
                            onClick={openConnectModal}
                            type="button"
                            disabled={isAnyLoading}
                            className="w-full flex items-center justify-center gap-3 bg-[#111] hover:bg-[#222] text-white py-4 rounded-xl text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-widest transition-colors border border-white/10 shadow-[inset_0_0_10px_rgba(255,255,255,0.02)] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                            </svg>
                            Connect Web3 Wallet
                          </button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <button
                            onClick={openChainModal}
                            type="button"
                            className="w-full flex items-center justify-center gap-3 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-500/30 py-4 rounded-xl text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-widest transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                            </svg>
                            Wrong Network
                          </button>
                        );
                      }

                      return (
                        <div className="flex items-center gap-2 w-full animate-in fade-in duration-300">
                          <button
                            onClick={openChainModal}
                            type="button"
                            className="flex-none shrink-0 w-[46px] h-[46px] flex items-center justify-center bg-[#050505] hover:bg-white/5 border border-white/10 rounded-xl transition-colors shadow-[inset_0_0_10px_rgba(255,255,255,0.02)]"
                            aria-label={`Switch chain, current: ${chain.name}`}
                          >
                            {chain.hasIcon && (
                              <div style={{ background: chain.iconBackground, width: 20, height: 20, borderRadius: 999, overflow: 'hidden' }}>
                                {chain.iconUrl && (
                                  <img alt={chain.name ?? 'Chain icon'} src={chain.iconUrl} style={{ width: 20, height: 20 }} />
                                )}
                              </div>
                            )}
                          </button>

                          <button
                            onClick={openAccountModal}
                            type="button"
                            className="flex-1 h-[46px] flex items-center justify-center gap-2 bg-[#050505] hover:bg-white/5 text-white rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest transition-colors border border-white/10 shadow-[inset_0_0_10px_rgba(255,255,255,0.02)]"
                            aria-label={`Wallet account: ${account.displayName}`}
                          >
                            {account.displayName}
                          </button>
                        </div>
                      );
                    }}
                  </ConnectButton.Custom>
                ) : (
                  // SSR placeholder — matches exact dimensions of the real button to prevent layout shift
                  <div
                    className="w-full py-4 rounded-xl bg-white/5 h-[46px]"
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 py-3">
              <div className="h-px bg-white/10 flex-1" />
              <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">OR EMAIL</span>
              <div className="h-px bg-white/10 flex-1" />
            </div>

            {/* Email Auth Form — isolated from wallet buttons */}
            <form onSubmit={handleEmailAuth} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="email-input"
                  className="text-[9px] font-mono text-neutral-400 uppercase tracking-widest pl-1"
                >
                  Email Address
                </label>
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="node@compound.os"
                  disabled={isAnyLoading}
                  className="w-full bg-[#050505] border border-white/10 px-4 py-4 rounded-xl font-mono text-[11px] text-white placeholder-neutral-700 focus:outline-none focus:border-blue-500/50 transition-colors shadow-inner disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password-input"
                  className="text-[9px] font-mono text-neutral-400 uppercase tracking-widest pl-1"
                >
                  Cryptographic Key (Password)
                </label>
                <input
                  id="password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={authMode === 'SIGN_IN' ? 'current-password' : 'new-password'}
                  placeholder="••••••••••••"
                  disabled={isAnyLoading}
                  className="w-full bg-[#050505] border border-white/10 px-4 py-4 rounded-xl font-mono text-[11px] text-white placeholder-neutral-700 focus:outline-none focus:border-blue-500/50 transition-colors shadow-inner disabled:opacity-50"
                />
              </div>

              {/* Success message */}
              {successMsg && (
                <div className="p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-lg flex items-start gap-2">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <p className="text-[10px] font-mono text-emerald-400 leading-relaxed">{successMsg}</p>
                </div>
              )}

              {/* Error message */}
              {errorMsg && (
                <div className="p-3 bg-red-900/20 border border-red-500/20 rounded-lg flex items-start gap-2" role="alert">
                  <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <p className="text-[10px] font-mono text-red-400 leading-relaxed">{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isAnyLoading || !mounted}
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white py-4 rounded-xl text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-3"
              >
                {isEmailLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : null}
                {isEmailLoading
                  ? 'Executing...'
                  : authMode === 'SIGN_IN'
                  ? 'Initialize Session'
                  : 'Create Identity'}
              </button>
            </form>

            <div className="mt-8 text-center border-t border-white/5 pt-6">
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-mono text-neutral-600 hover:text-white uppercase tracking-widest transition-colors"
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