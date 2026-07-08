import { describe, it, expect } from 'vitest';
import { canOverwrite } from '../sync-guard';

describe('canOverwrite', () => {
  it('allows when cloud is at the same version the device based on', () => {
    expect(canOverwrite(5, 5)).toBe(true);
  });
  it('allows when the device is ahead of the cloud (new claim, cloud=0)', () => {
    expect(canOverwrite(0, 0)).toBe(true);
    expect(canOverwrite(3, 2)).toBe(true);
  });
  it('refuses when the cloud has moved ahead of the device', () => {
    expect(canOverwrite(5, 6)).toBe(false);
  });
});
