import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in · SurveyOS',
  description:
    'Sign in to SurveyOS Prime — AI Motor Insurance Survey Software for IRDAI-licensed surveyors.',
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
