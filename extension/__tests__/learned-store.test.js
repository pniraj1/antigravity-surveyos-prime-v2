import { describe, it, expect, beforeEach } from 'vitest';
import {
  storageKey,
  areFingerprintsEquivalent,
  getLearned,
  saveLearned,
  recordCandidate,
  getConfirmed,
  purgeLearned,
  mergeWithStaticMap,
} from '../src/lib/learned-store.js';

describe('storageKey', () => {
  it('generates learned:<portal>-<flow>', () => {
    expect(storageKey('nia', 'nontieup')).toBe('learned:nia-nontieup');
    expect(storageKey('oic', 'assessment')).toBe('learned:oic-assessment');
  });
});

describe('areFingerprintsEquivalent', () => {
  it('matches by name', () => {
    const a = { name: 'dlBox1', label: 'DL Part 1', idHint: '' };
    const b = { name: 'dlBox1', label: 'Driving Licence', idHint: '' };
    expect(areFingerprintsEquivalent(a, b)).toBe(true);
  });

  it('matches by label case-insensitively', () => {
    const a = { name: 'field_1', label: 'Engine Number', idHint: '' };
    const b = { name: 'field_2', label: 'engine number', idHint: '' };
    expect(areFingerprintsEquivalent(a, b)).toBe(true);
  });

  it('matches by idHint', () => {
    const a = { name: '', label: '', idHint: '#chasisNo' };
    const b = { name: '', label: '', idHint: '#chasisNo' };
    expect(areFingerprintsEquivalent(a, b)).toBe(true);
  });

  it('returns false for unrelated fields', () => {
    const a = { name: 'fieldA', label: 'Engine', idHint: '#a' };
    const b = { name: 'fieldB', label: 'Chassis', idHint: '#b' };
    expect(areFingerprintsEquivalent(a, b)).toBe(false);
  });
});

describe('recordCandidate and 2-claim promotion', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {};
  });

  it('records first observation with candidate confidence and matchCount=1', async () => {
    const fp = { name: 'dlOne', label: 'DL Prefix', idHint: '#dlOne' };
    const res = await recordCandidate(mockStorage, 'oic', 'assessment', {
      fingerprint: fp,
      claimField: 'driverLicenceNo',
      transform: 'prefix:4',
    });

    expect(res.promoted).toBe(false);
    expect(res.binding.confidence).toBe('candidate');
    expect(res.binding.matchCount).toBe(1);

    const stored = await getLearned(mockStorage, 'oic', 'assessment');
    expect(stored).toHaveLength(1);
    expect(stored[0].claimField).toBe('driverLicenceNo');
  });

  it('promotes to confirmed on second observation across claims (matchCount >= 2)', async () => {
    const fp = { name: 'dlOne', label: 'DL Prefix', idHint: '#dlOne' };

    // Claim 1 observation
    await recordCandidate(mockStorage, 'oic', 'assessment', {
      fingerprint: fp,
      claimField: 'driverLicenceNo',
      transform: 'prefix:4',
    });

    // Claim 2 observation
    const res2 = await recordCandidate(mockStorage, 'oic', 'assessment', {
      fingerprint: fp,
      claimField: 'driverLicenceNo',
      transform: 'prefix:4',
    });

    expect(res2.promoted).toBe(true);
    expect(res2.binding.confidence).toBe('confirmed');
    expect(res2.binding.matchCount).toBe(2);

    const confirmed = await getConfirmed(mockStorage, 'oic', 'assessment');
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].confidence).toBe('confirmed');
  });

  it('resets matchCount if surveyor types a different correlation into the same field', async () => {
    const fp = { name: 'box', label: 'Custom Box', idHint: '#box' };

    await recordCandidate(mockStorage, 'nia', 'nontieup', {
      fingerprint: fp,
      claimField: 'surveyPlace',
      transform: 'exact',
    });

    const res = await recordCandidate(mockStorage, 'nia', 'nontieup', {
      fingerprint: fp,
      claimField: 'claimantCity',
      transform: 'exact',
    });

    expect(res.promoted).toBe(false);
    expect(res.binding.confidence).toBe('candidate');
    expect(res.binding.matchCount).toBe(1);
    expect(res.binding.claimField).toBe('claimantCity');
  });
});

describe('purgeLearned', () => {
  it('removes learned bindings for portal', async () => {
    const mockStorage = {
      'learned:oic-assessment': [{ claimField: 'test' }],
    };
    await purgeLearned(mockStorage, 'oic', 'assessment');
    const res = await getLearned(mockStorage, 'oic', 'assessment');
    expect(res).toEqual([]);
  });
});

describe('mergeWithStaticMap (RULE D4)', () => {
  const staticMap = {
    portal: 'oic',
    flow: 'assessment',
    fields: {
      regNumber: { modelPath: '#regNumber', kind: 'text', empty: '', from: 'vehicle.regNo' },
      make: { modelPath: '#make', kind: 'text', empty: '', from: 'vehicle.make' },
    },
  };

  it('adds confirmed learned fields that do not conflict with static map', () => {
    const confirmed = [
      {
        fingerprint: { name: 'dlBox1', label: 'DL Box 1', idHint: '#driverLicenseNoOne' },
        claimField: 'driverLicenceNo',
        transform: 'prefix:4',
        confidence: 'confirmed',
        matchCount: 2,
      },
    ];

    const merged = mergeWithStaticMap(staticMap, confirmed);
    expect(merged.fields.regNumber).toBeDefined();
    expect(merged.fields.make).toBeDefined();

    // Learned field added
    const learnedKey = Object.keys(merged.fields).find((k) => k.startsWith('learned_'));
    expect(learnedKey).toBeDefined();
    expect(merged.fields[learnedKey].modelPath).toBe('#driverLicenseNoOne');
    expect(merged.fields[learnedKey].from).toBe('driverLicenceNo');
    expect(merged.fields[learnedKey].isLearned).toBe(true);
  });

  it('static map fields always win over conflicting learned selectors (D4)', () => {
    const conflicting = [
      {
        fingerprint: { name: 'regNumber', label: 'Reg', idHint: '#regNumber' },
        claimField: 'chassisNumber',
        transform: 'exact',
        confidence: 'confirmed',
        matchCount: 5,
      },
    ];

    const merged = mergeWithStaticMap(staticMap, conflicting);
    // #regNumber should still be vehicle.regNo from static map, not overwritten
    expect(merged.fields.regNumber.from).toBe('vehicle.regNo');
    const learnedKeys = Object.keys(merged.fields).filter((k) => k.startsWith('learned_'));
    expect(learnedKeys).toHaveLength(0);
  });
});
