import { describe, it, expect, beforeEach } from 'vitest';
import { getCloudChoice, rememberCloudChoice, clearCloudChoices } from '../cloud-choice-memo';

describe('cloud choice memo', () => {
  beforeEach(() => clearCloudChoices());

  it('is unknown until answered', () => {
    expect(getCloudChoice('c1')).toBeUndefined();
  });

  it('remembers yes and no per claim', () => {
    rememberCloudChoice('c1', true);
    rememberCloudChoice('c2', false);
    expect(getCloudChoice('c1')).toBe(true);
    expect(getCloudChoice('c2')).toBe(false);
  });
});
