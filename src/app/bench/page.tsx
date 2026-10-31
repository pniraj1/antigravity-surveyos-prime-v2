import type { Metadata } from 'next';
import { BenchPage } from '@/components/bench/BenchPage';

export const metadata: Metadata = { title: 'Extraction bench', robots: { index: false, follow: false } };

export default function Page() {
  return <BenchPage />;
}
