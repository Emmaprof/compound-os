'use client';

import * as React from 'react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'viem/chains';
import '@rainbow-me/rainbowkit/styles.css';

// 1. Centralized Web3 Configuration with Metadata for WalletConnect UI
const config = getDefaultConfig({
  appName: 'CompoundOS',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '6e801c6b7bed1dd0117a54c9017b1a0d', 
  chains: [base],
  ssr: true, // Tells Wagmi to delay wallet hydration until the client loads
  appDescription: 'Core Network Infrastructure',
  appUrl: 'https://compoundos-node.vercel.app',
  appIcon: 'https://compoundos-node.vercel.app/logo.jpg', 
});

export function Providers({ children }: { children: React.ReactNode }) {
  // 2. Enterprise Standard: Initialize QueryClient inside useState.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          // 🛡️ INJECTED APP INFO FOR TRUSTED UI
          appInfo={{
            appName: 'CompoundOS',
            learnMoreUrl: 'https://compoundos-node.vercel.app',
          }}
          theme={darkTheme({
            accentColor: '#3b82f6', 
            accentColorForeground: 'white',
            borderRadius: 'large',
            fontStack: 'system'
          })}
        >
          {/* 3. Clean Render Tree: Let Next.js handle SSR normally */}
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}