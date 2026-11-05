import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClaimDocument } from '@/types/documents';

const mockSink = vi.hoisted(() => ({
  saveDocuments: vi.fn(),
}));

const mockEvidence = vi.hoisted(() => ({
  storeFiles: vi.fn(),
}));

const mockDrive = vi.hoisted(() => ({
  uploadWithDuplicateCheck: vi.fn(),
}));

const mockUIState = vi.hoisted(() => ({
  isDriveConnected: true,
}));

const mockProfileState = vi.hoisted(() => ({
  profile: {
    autoUploadDrive: true,
  },
}));

const mockClaimState = vi.hoisted(() => ({
  currentClaim: {
    id: 'claim-123',
    vehicle: {
      registrationNumber: 'MH12AB1234',
    },
  } as any,
}));

vi.mock('../sink', () => ({
  saveDocuments: mockSink.saveDocuments,
}));

vi.mock('@/components/evidence/DocumentEvidenceViewer', () => ({
  storeFiles: mockEvidence.storeFiles,
}));

vi.mock('@/lib/drive/upload-with-check', () => ({
  uploadWithDuplicateCheck: mockDrive.uploadWithDuplicateCheck,
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: {
    getState: () => mockUIState,
  },
}));

vi.mock('@/stores/profile-store', () => ({
  useProfileStore: {
    getState: () => mockProfileState,
  },
}));

vi.mock('@/stores/claim-store', () => ({
  useClaimStore: {
    getState: () => mockClaimState,
  },
}));

vi.mock('@/hooks/useAIExtraction', () => ({
  useAIExtraction: () => ({
    triggerExtraction: vi.fn(),
  }),
}));

import { ingestDocument } from '../ingest';

describe('ingestDocument', () => {
  const sampleFile = new File(['pdf data'], 'rc_scan.pdf', { type: 'application/pdf' });
  const sampleDoc: ClaimDocument = {
    id: 'doc-1',
    type: 'rc',
    relPath: 'RC Book.pdf',
    mime: 'application/pdf',
    size: 1024,
    addedAt: '2026-11-05T12:00:00Z',
    source: 'upload',
    devices: ['This PC'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUIState.isDriveConnected = true;
    mockProfileState.profile = { autoUploadDrive: true };
    mockClaimState.currentClaim = {
      id: 'claim-123',
      vehicle: { registrationNumber: 'MH12AB1234' },
    };
    mockSink.saveDocuments.mockResolvedValue([sampleDoc]);
    mockDrive.uploadWithDuplicateCheck.mockResolvedValue(undefined);
  });

  it('saves file to local claim folder via saveDocuments and returns the ClaimDocument', async () => {
    const result = await ingestDocument({
      claimId: 'claim-123',
      docType: 'rc',
      file: sampleFile,
    });

    expect(result).toBe(sampleDoc);
    expect(mockSink.saveDocuments).toHaveBeenCalledWith(
      'rc',
      [{ blob: sampleFile, name: 'rc_scan.pdf' }],
      'upload',
      'claim-123',
    );
  });

  it('registers file in Evidence Viewer via storeFiles when slotKey is provided', async () => {
    await ingestDocument({
      claimId: 'claim-123',
      docType: 'rc',
      file: sampleFile,
      slotKey: 'rc',
    });

    expect(mockEvidence.storeFiles).toHaveBeenCalledWith('claim-123', 'rc', [sampleFile]);
  });

  it('does not call storeFiles when slotKey is omitted', async () => {
    await ingestDocument({
      claimId: 'claim-123',
      docType: 'estimate',
      file: sampleFile,
    });

    expect(mockEvidence.storeFiles).not.toHaveBeenCalled();
  });

  it('dispatches AI extraction when skipAI is false and slotKey + triggerExtraction provided', async () => {
    const triggerExtraction = vi.fn().mockResolvedValue(undefined);

    await ingestDocument({
      claimId: 'claim-123',
      docType: 'rc',
      file: sampleFile,
      slotKey: 'rc',
      skipAI: false,
      triggerExtraction,
    });

    expect(triggerExtraction).toHaveBeenCalledWith('rc', sampleFile);
  });

  it('skips AI extraction when skipAI is true', async () => {
    const triggerExtraction = vi.fn().mockResolvedValue(undefined);

    await ingestDocument({
      claimId: 'claim-123',
      docType: 'rc',
      file: sampleFile,
      slotKey: 'rc',
      skipAI: true,
      triggerExtraction,
    });

    expect(triggerExtraction).not.toHaveBeenCalled();
  });

  it('triggers Google Drive upload with duplicate check when Drive connected and autoUploadDrive is true', async () => {
    await ingestDocument({
      claimId: 'claim-123',
      docType: 'rc',
      file: sampleFile,
    });

    expect(mockDrive.uploadWithDuplicateCheck).toHaveBeenCalledWith(
      'claim-123',
      'rc_scan.pdf',
      sampleFile,
      'MH12AB1234',
      expect.any(Function),
    );
  });

  it('skips Google Drive upload when skipDrive is true', async () => {
    await ingestDocument({
      claimId: 'claim-123',
      docType: 'rc',
      file: sampleFile,
      skipDrive: true,
    });

    expect(mockDrive.uploadWithDuplicateCheck).not.toHaveBeenCalled();
  });

  it('skips Google Drive upload when isDriveConnected is false', async () => {
    mockUIState.isDriveConnected = false;

    await ingestDocument({
      claimId: 'claim-123',
      docType: 'rc',
      file: sampleFile,
    });

    expect(mockDrive.uploadWithDuplicateCheck).not.toHaveBeenCalled();
  });

  it('skips Google Drive upload when autoUploadDrive is explicitly false', async () => {
    mockProfileState.profile = { autoUploadDrive: false };

    await ingestDocument({
      claimId: 'claim-123',
      docType: 'rc',
      file: sampleFile,
    });

    expect(mockDrive.uploadWithDuplicateCheck).not.toHaveBeenCalled();
  });

  it('honors customFileName for both disk write and Drive upload', async () => {
    await ingestDocument({
      claimId: 'claim-123',
      docType: 'estimate',
      file: sampleFile,
      customFileName: 'repair_estimate_dealer.pdf',
    });

    expect(mockSink.saveDocuments).toHaveBeenCalledWith(
      'estimate',
      [{ blob: sampleFile, name: 'repair_estimate_dealer.pdf' }],
      'upload',
      'claim-123',
    );

    expect(mockDrive.uploadWithDuplicateCheck).toHaveBeenCalledWith(
      'claim-123',
      'repair_estimate_dealer.pdf',
      sampleFile,
      'MH12AB1234',
      expect.any(Function),
    );
  });

  it('honors custom source option', async () => {
    await ingestDocument({
      claimId: 'claim-123',
      docType: 'policy',
      file: sampleFile,
      source: 'scan',
    });

    expect(mockSink.saveDocuments).toHaveBeenCalledWith(
      'policy',
      [{ blob: sampleFile, name: 'rc_scan.pdf' }],
      'scan',
      'claim-123',
    );
  });

  it('returns null if saveDocuments returned no documents', async () => {
    mockSink.saveDocuments.mockResolvedValue([]);

    const result = await ingestDocument({
      claimId: 'claim-123',
      docType: 'rc',
      file: sampleFile,
    });

    expect(result).toBeNull();
  });
});
