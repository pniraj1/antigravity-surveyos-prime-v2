import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveWorkspace } from '@/lib/auth/workspace-resolver';
import { useAuthStore, type TeamAffiliation } from '@/stores/auth-store';
import { resetAllState } from '@/lib/auth/resetAllState';
import { getDoc, doc } from 'firebase/firestore';

// Provide localStorage mock if running in a bare node environment
const storage = new Map<string, string>();
const mockStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, String(value)); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
  get length() { return storage.size; },
  key: (i: number) => Array.from(storage.keys())[i] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  configurable: true,
  writable: true,
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });
}

vi.mock('@/lib/firebase/config', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, collection: string, id: string) => ({ collection, id })),
  getDoc: vi.fn(),
}));

describe('team-workspace-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      loading: false,
      sessionConflict: null,
      activeWorkspaceUid: null,
      isTeamMember: false,
      teamAffiliation: null,
    });
  });

  describe('resolveWorkspace', () => {
    it('resolves firm owner workspace and affiliation when user is an assistant team member', async () => {
      const mockAffiliation: TeamAffiliation = {
        firmOwnerUid: 'senior-surveyor-uid-999',
        firmName: 'Patil & Associates',
        firmLicence: 'IRDAI/WLA/99999',
        hideEarnings: true,
        ownerEmail: 'patil@firm.com',
      };

      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockAffiliation,
      } as any);

      const assistantUser = {
        uid: 'assistant-uid-456',
        email: 'Assistant.Junior@Gmail.com',
      };

      const result = await resolveWorkspace(assistantUser);

      // Verifies document queried with lowercase normalized email
      expect(doc).toHaveBeenCalledWith(expect.anything(), 'team_members', 'assistant.junior@gmail.com');

      expect(result.workspaceUid).toBe('senior-surveyor-uid-999');
      expect(result.isTeamMember).toBe(true);
      expect(result.affiliation).toEqual(mockAffiliation);
    });

    it('resolves own UID and isTeamMember: false for a solo surveyor not in team_members', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      } as any);

      const soloUser = {
        uid: 'solo-surveyor-uid-123',
        email: 'solo.surveyor@example.com',
      };

      const result = await resolveWorkspace(soloUser);

      expect(doc).toHaveBeenCalledWith(expect.anything(), 'team_members', 'solo.surveyor@example.com');
      expect(result.workspaceUid).toBe('solo-surveyor-uid-123');
      expect(result.isTeamMember).toBe(false);
      expect(result.affiliation).toBeNull();
    });

    it('resolves own UID safely when user has no email', async () => {
      const phoneUser = {
        uid: 'phone-user-789',
        email: null,
      };

      const result = await resolveWorkspace(phoneUser);

      expect(getDoc).not.toHaveBeenCalled();
      expect(result.workspaceUid).toBe('phone-user-789');
      expect(result.isTeamMember).toBe(false);
      expect(result.affiliation).toBeNull();
    });

    it('falls back gracefully to own UID when Firestore getDoc throws', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(getDoc).mockRejectedValueOnce(new Error('Network offline'));

      const user = {
        uid: 'user-offline-123',
        email: 'surveyor@offline.org',
      };

      const result = await resolveWorkspace(user);

      expect(result.workspaceUid).toBe('user-offline-123');
      expect(result.isTeamMember).toBe(false);
      expect(result.affiliation).toBeNull();
      errSpy.mockRestore();
    });
  });

  describe('useAuthStore workspace state & setters', () => {
    it('initializes with null workspace and false isTeamMember', () => {
      const state = useAuthStore.getState();
      expect(state.activeWorkspaceUid).toBeNull();
      expect(state.isTeamMember).toBe(false);
      expect(state.teamAffiliation).toBeNull();
    });

    it('setWorkspace sets activeWorkspaceUid, isTeamMember, and teamAffiliation', () => {
      const affiliation: TeamAffiliation = {
        firmOwnerUid: 'senior-777',
        firmName: 'Apex Insurance Surveyors',
        firmLicence: 'IRDAI-LIC-777',
        hideEarnings: true,
        ownerEmail: 'lead@apex.com',
      };

      useAuthStore.getState().setWorkspace('senior-777', true, affiliation);

      const state = useAuthStore.getState();
      expect(state.activeWorkspaceUid).toBe('senior-777');
      expect(state.isTeamMember).toBe(true);
      expect(state.teamAffiliation).toEqual(affiliation);
    });

    it('setWorkspace resets to defaults when passed nulls', () => {
      useAuthStore.getState().setWorkspace('temp-uid', true, {
        firmOwnerUid: 'temp-uid',
        firmName: 'Temp',
        firmLicence: 'L1',
        hideEarnings: false,
        ownerEmail: 'temp@temp.com',
      });

      useAuthStore.getState().setWorkspace(null, false, null);

      const state = useAuthStore.getState();
      expect(state.activeWorkspaceUid).toBeNull();
      expect(state.isTeamMember).toBe(false);
      expect(state.teamAffiliation).toBeNull();
    });

    it('resetAllState wipes activeWorkspaceUid, isTeamMember, and teamAffiliation', () => {
      useAuthStore.getState().setWorkspace('senior-888', true, {
        firmOwnerUid: 'senior-888',
        firmName: 'Senior & Sons',
        firmLicence: 'LIC-888',
        hideEarnings: true,
        ownerEmail: 'senior@firm.com',
      });

      resetAllState();

      const state = useAuthStore.getState();
      expect(state.activeWorkspaceUid).toBeNull();
      expect(state.isTeamMember).toBe(false);
      expect(state.teamAffiliation).toBeNull();
    });
  });
});
