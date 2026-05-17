import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';


const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AI Motor Insurance Survey Software | SurveyOS Prime',
  description:
    'AI-powered motor insurance survey software for IRDAI-licensed surveyors. Auto-extracts RC, licence & policy data, generates reports in 10 mins. 60-day free trial!',
  keywords: [
    'AI motor insurance survey software',
    'IRDAI licensed surveyor software',
    'motor insurance survey app India',
    'AI vehicle inspection software',
    'digital motor survey tool',
    'insurance claim survey software',
    'RC book data extraction',
    'motor insurance report generator',
    'real-time cloud survey software',
    'IRDAI surveyor app',
  ],
  authors: [{ name: 'SurveyOS' }],
  metadataBase: new URL('https://surveyos-v2-antigravity.web.app'),
  alternates: {
    canonical: 'https://surveyos-v2-antigravity.web.app/',
  },
  openGraph: {
    title: 'SurveyOS Prime - Cloud-Native AI Motor Insurance Survey Software',
    description:
      'Generate motor insurance survey reports in under 10 minutes with AI. Real-time cloud synchronization, zero-latency caching, and instant Google Drive export. 60-day free trial!',
    url: 'https://surveyos-v2-antigravity.web.app/',
    siteName: 'SurveyOS Prime',
    type: 'website',
    locale: 'en_IN',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SurveyOS Prime — Cloud-Native AI Motor Insurance Survey Software',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SurveyOS Prime - Cloud-Native AI Motor Insurance Survey Software',
    description:
      'Generate motor insurance survey reports in under 10 minutes with AI. 60-day free trial for IRDAI-licensed surveyors.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
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
        <Script
          id="json-ld-software"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'SurveyOS Prime',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web, Android, iOS',
              description:
                'AI-powered cloud-native motor insurance survey software for independent IRDAI-licensed surveyors in India. Real-time data extraction from RC books, driving licences, and insurance policies. High-performance cloud synchronization and instant reporting.',
              offers: {
                '@type': 'Offer',
                price: '999',
                priceCurrency: 'INR',
                priceValidUntil: '2027-12-31',
                description: '60-day free trial then ₹999/month',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.8',
                reviewCount: '47',
              },
            }),
          }}
        />
        <Script
          id="json-ld-org"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'SurveyOS',
              url: 'https://surveyos-v2-antigravity.web.app',
              contactPoint: {
                '@type': 'ContactPoint',
                email: 'surveyosprime@gmail.com',
                contactType: 'customer support',
                areaServed: 'IN',
                availableLanguage: ['English', 'Hindi'],
              },
            }),
          }}
        />
      </body>
    </html>
  );
}
