import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';


const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SurveyOS V2 — Motor Insurance Survey Platform',
  description:
    'AI-powered, offline-first motor insurance surveying platform for Indian independent surveyors. Zero-cost, config-driven report generation.',
  keywords: ['survey', 'motor insurance', 'IRDAI', 'claim assessment', 'AI', 'surveyor'],
  authors: [{ name: 'SurveyOS' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#ffffff' },
  ],
};

import { AuthSyncWrapper } from '@/components/AuthSyncWrapper';
import { AuthGate } from '@/components/auth/AuthGate';
import { SubscriptionGuard } from '@/components/layout/SubscriptionGuard';
import Script from 'next/script';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground font-sans antialiased">
        <AuthSyncWrapper>
          <AuthGate>
            <SubscriptionGuard>
              {children}
            </SubscriptionGuard>
          </AuthGate>
        </AuthSyncWrapper>
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      </body>
    </html>
  );
}
