'use client';
import { PDFViewer } from '@react-pdf/renderer';
import { DocumentAnnexureDocument } from './DocumentAnnexureDocument';

import type { ClaimData } from '@/types';
import { useProfileStore } from '@/stores/profile-store';
import { buildAnnexureProfile } from '@/lib/photos/document-annexure';

interface Props {
  claim: ClaimData;
}

export function DocumentAnnexurePreview({ claim }: Props) {
  const profile = useProfileStore(s => s.profile);

  const annexureProfile = buildAnnexureProfile(profile);

  return (
    <PDFViewer
      style={{
        width:        '100%',
        height:       '72vh',
        border:       'none',
        borderRadius: '6px',
      }}
      showToolbar
    >
      <DocumentAnnexureDocument claim={claim} profile={annexureProfile} />
    </PDFViewer>
  );
}
