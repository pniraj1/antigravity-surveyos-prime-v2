'use client';

import { SpotPrintReport } from '@/components/print/SpotPrintReport';
import { MOCK_CLAIM, MOCK_PROFILE } from '../_mock-data';

export default function SpotScreenshotPage() {
  return (
    <div style={{ background: '#fff', padding: '20px' }}>
      <SpotPrintReport claim={MOCK_CLAIM} profile={MOCK_PROFILE} />
    </div>
  );
}
