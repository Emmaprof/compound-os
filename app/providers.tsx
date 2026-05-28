'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'viem/chains';
import '@rainbow-me/rainbowkit/styles.css';

// Centralized Web3 Configuration - Cleaned of all SSR-crashing elements
const config = getDefaultConfig({
  appName: 'CompoundOS',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '6e801c6b7bed1dd0117a54c9017b1a0d', 
  chains: [base],
  ssr: true,
  appDescription: 'Core Network Infrastructure',
  appUrl: 'https://compoundos-node.vercel.app',
  appIcon: 'https://compoundos-node.vercel.app/logo.jpg', 
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Global error silencer for safe wallet disconnects
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes('Connection interrupted')) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={darkTheme({
            accentColor: '#3b82f6', 
            accentColorForeground: 'white',
            borderRadius: 'large',
            fontStack: 'system'
          })}
        >
          {mounted ? children : null}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}