import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import type { SurveyorProfile } from '@/types/vehicle';

const setActiveTab = vi.fn();
let profile: Partial<SurveyorProfile>;
vi.mock('@/stores/profile-store', () => ({
  useProfileStore: (sel: (s: unknown) => unknown) => sel({ profile }),
}));
vi.mock('@/stores/ui-store', () => ({
  useUIStore: (sel: (s: unknown) => unknown) => sel({ setActiveTab }),
}));

import { ProfileGapBanner } from '../ProfileGapBanner';

// No DOM library here: call the component (mocked stores are plain functions) and walk the element tree.
function text(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return text((node as ReactElement<{ children?: unknown }>).props.children);
}
function findButton(node: unknown): ReactElement<{ onClick: () => void }> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const b = findButton(n); if (b) return b; } return null; }
  const el = node as ReactElement<{ onClick: () => void; children?: unknown }>;
  if (el.type === 'button') return el;
  return findButton(el.props.children);
}

describe('ProfileGapBanner', () => {
  beforeEach(() => {
    setActiveTab.mockClear();
    profile = { name: 'A', licenceNumber: 'L', signatureDataUrl: 'd', stampDataUrl: 'd' };
  });

  it('renders nothing when complete', () => {
    expect(ProfileGapBanner()).toBeNull();
  });

  it('lists gaps, hides on print, and opens Profile', () => {
    profile = { ...profile, licenceNumber: '', signatureDataUrl: null };
    const el = ProfileGapBanner() as ReactElement<{ className: string }>;
    expect(text(el)).toContain('Your reports are missing: licence number, signature.');
    expect(el.props.className).toContain('print:hidden');
    findButton(el)!.props.onClick();
    expect(setActiveTab).toHaveBeenCalledWith('profile');
  });
});
