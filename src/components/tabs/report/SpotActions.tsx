'use client';

import { Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { ClaimData } from '@/types/claim';
import type { SurveyorProfile } from '@/types/vehicle';
import { generateSpotWordReport } from '@/lib/reports/word-builder';
import { logger } from '@/lib/utils/logger';

interface SpotActionsProps {
  claim: ClaimData;
  profile: SurveyorProfile;
  isExportingWord: boolean;
  setIsExportingWord: (v: boolean) => void;
  onPrint: () => void;
}

export function SpotActions({ claim, profile, isExportingWord, setIsExportingWord, onPrint }: SpotActionsProps) {
  return (
    <>
      {/* Word Export */}
      <button
        onClick={async () => {
          setIsExportingWord(true);
          try {
            await generateSpotWordReport(claim, profile);
            toast.success('Word report generated!');
          } catch (e) {
            logger.error(e);
            toast.error('Failed to generate Word report');
          } finally {
            setIsExportingWord(false);
          }
        }}
        disabled={isExportingWord}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
        style={{
          background: isExportingWord ? '#F0F2F5' : '#FFFFFF',
          color: isExportingWord ? '#8D99AE' : '#0D1B2A',
          border: '1.5px solid #E2E6EA',
          cursor: isExportingWord ? 'not-allowed' : 'pointer',
        }}
      >
        {isExportingWord ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
        {isExportingWord ? 'Building…' : 'Export Word (.docx)'}
      </button>

      {/* Power Print */}
      <button
        onClick={onPrint}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all shadow-md border-2 border-green-700 text-green-700 hover:bg-green-50"
        style={{ background: '#FFFFFF', cursor: 'pointer' }}
      >
        <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
        POWER PRINT (SPOT)
      </button>
    </>
  );
}
