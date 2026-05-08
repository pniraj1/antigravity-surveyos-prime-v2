import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Motor Insurance Survey Software | SurveyOS Prime',
  description:
    'AI-powered motor insurance survey software for IRDAI-licensed surveyors. Auto-extracts RC, licence & policy data, generates reports in 10 mins. 60-day free trial!',
  alternates: {
    canonical: 'https://motorsurveyos.web.app/',
  },
  openGraph: {
    title: 'SurveyOS Prime — AI Motor Insurance Survey Software for IRDAI Surveyors',
    description:
      'Generate motor insurance survey reports in under 10 minutes with AI. Auto-extract data from RC books, driving licences & policies. Works offline, syncs to Google Drive. 60-day free trial!',
    url: 'https://motorsurveyos.web.app/',
    siteName: 'SurveyOS Prime',
    type: 'website',
    locale: 'en_IN',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SurveyOS Prime — AI Motor Insurance Survey Software',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SurveyOS Prime — AI Motor Insurance Survey Software',
    description:
      'Generate motor insurance survey reports in under 10 minutes with AI. 60-day free trial for IRDAI-licensed surveyors.',
    images: ['/og-image.png'],
  },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
