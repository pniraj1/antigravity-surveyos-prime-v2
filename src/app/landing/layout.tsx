import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Motor Insurance Survey Software | Motor SurveyOS',
  description:
    'AI-powered motor insurance survey software for IRDAI-licensed surveyors. Auto-extracts RC, licence & policy data, generates reports in 10 mins. 14-day free trial!',
  alternates: {
    canonical: 'https://motorsurveyos-in.web.app/landing',
  },
  openGraph: {
    title: 'Motor SurveyOS — AI Motor Insurance Survey Software for IRDAI Surveyors',
    description:
      'Generate motor insurance survey reports in under 10 minutes with AI. Auto-extract data from RC books, driving licences & policies. Works offline, syncs to Google Drive. 14-day free trial!',
    url: 'https://motorsurveyos-in.web.app/landing',
    siteName: 'Motor SurveyOS',
    type: 'website',
    locale: 'en_IN',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Motor SurveyOS — AI Motor Insurance Survey Software',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Motor SurveyOS — AI Motor Insurance Survey Software',
    description:
      'Generate motor insurance survey reports in under 10 minutes with AI. 14-day free trial for IRDAI-licensed surveyors.',
    images: ['/og-image.png'],
  },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

