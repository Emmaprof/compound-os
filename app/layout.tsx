import './globals.css';
import { Inter, Roboto_Mono } from 'next/font/google';
import { Providers } from './providers';
import type { Metadata } from 'next';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const robotoMono = Roboto_Mono({ subsets: ['latin'], variable: '--font-roboto-mono' });

// Google-Standard Native Server Metadata
export const metadata: Metadata = {
  title: 'CompoundOS | Core Infrastructure',
  description: 'Core Network Infrastructure',
  verification: {
    google: 'QVWoNo9VrJiZu7TAwmoqpV-P3HjZ0uFjmu4y58cJlVg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable} bg-black text-white antialiased`}>
      <head>
        {/* Mobile Clamp: Prevents UI breaking on iOS/Android */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </head>
      <body className="min-h-screen flex flex-col bg-black overflow-x-hidden selection:bg-blue-500/30">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}