'use client';

import './globals.css';
import { Inter, Roboto_Mono } from 'next/font/google';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { base } from 'viem/chains'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const robotoMono = Roboto_Mono({ subsets: ['latin'], variable: '--font-roboto-mono' });

const config = getDefaultConfig({
  appName: 'CompoundOS',
  
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '6e801c6b7bed1dd0117a54c9017b1a0d', 
  chains: [base],
  ssr: true,
  
  appDescription: 'Core Network Infrastructure',
  appUrl: 'https://compoundos-node.vercel.app',
  appIcon: 'https://compoundos-node.vercel.app/logo.jpg', 
});

const queryClient = new QueryClient();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable} bg-black text-white antialiased`}>
      <head>
        {/* Google-Standard Mobile Clamp: Prevents UI breaking on iOS/Android */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <title>CompoundOS | Core Infrastructure</title>
        
        {/* GOOGLE SEARCH CONSOLE VERIFICATION */}
        <meta name="google-site-verification" content="QVWoNo9VrJiZu7TAwmoqpV-P3HjZ0uFjmu4y58cJlVg" />
      </head>
      <body className="min-h-screen flex flex-col bg-black overflow-x-hidden selection:bg-blue-500/30">
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider theme={darkTheme({ accentColor: '#3b82f6', accentColorForeground: 'white', borderRadius: 'large', fontStack: 'system' })}>
              {children}
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}