import { describe, it, expect } from 'vitest';
import { schedulePromptNeeded } from '../fee-schedule-adopt';
import { FALLBACK_FEE_SCHEDULE, type FeeSchedule } from '../fee-schedule';

const personal: FeeSchedule = { ...FALLBACK_FEE_SCHEDULE, version: 'IISLA-2022' };

describe('schedulePromptNeeded', () => {
  it('no prompt when the surveyor has no personal card', () => {
    expect(schedulePromptNeeded(undefined, undefined, 'IISLA-2025')).toBe(false);
  });
  it('no prompt while the global version has not loaded', () => {
    expect(schedulePromptNeeded(personal, 'IISLA-2022', null)).toBe(false);
  });
  it('prompts when acknowledged version is behind the global', () => {
    expect(schedulePromptNeeded(personal, 'IISLA-2022', 'IISLA-2025')).toBe(true);
  });
  it('no prompt once acknowledged version matches global', () => {
    expect(schedulePromptNeeded(personal, 'IISLA-2025', 'IISLA-2025')).toBe(false);
  });
  it('falls back to the card version when ack is missing', () => {
    expect(schedulePromptNeeded(personal, undefined, 'IISLA-2025')).toBe(true);
    expect(schedulePromptNeeded(personal, undefined, 'IISLA-2022')).toBe(false);
  });
});
