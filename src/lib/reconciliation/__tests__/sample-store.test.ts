// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_INSURER_SENDERS,
  loadSavedSenders,
  saveSender,
  removeSender,
  resetSendersToDefault,
} from '../sample-store';

describe('Sample Sender Store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads default senders when localStorage is empty', () => {
    const senders = loadSavedSenders();
    expect(senders.length).toBeGreaterThanOrEqual(5);
    expect(senders.some(s => s.email.includes('newindia'))).toBe(true);
    expect(senders.some(s => s.email.includes('uiic'))).toBe(true);
  });

  it('saves a new sender and persists it', () => {
    const newSender = {
      email: 'custom.disbursements@tpa.com',
      insurerName: 'Custom TPA Services',
      subjectKeywords: ['Payment', 'Surveyor'],
    };
    const updated = saveSender(newSender);
    expect(updated.some(s => s.email === 'custom.disbursements@tpa.com')).toBe(true);

    const reloaded = loadSavedSenders();
    expect(reloaded.some(s => s.email === 'custom.disbursements@tpa.com')).toBe(true);
  });

  it('removes an existing sender', () => {
    const senders = loadSavedSenders();
    const first = senders[0];
    const afterRemoval = removeSender(first.email);
    expect(afterRemoval.some(s => s.email === first.email)).toBe(false);

    const reloaded = loadSavedSenders();
    expect(reloaded.some(s => s.email === first.email)).toBe(false);
  });

  it('resets senders to default', () => {
    saveSender({ email: 'temp@test.com', insurerName: 'Temp' });
    const reset = resetSendersToDefault();
    expect(reset.some(s => s.email === 'temp@test.com')).toBe(false);
    expect(reset.length).toBe(DEFAULT_INSURER_SENDERS.length);
  });
});
