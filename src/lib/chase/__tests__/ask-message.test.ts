import { describe, it, expect } from 'vitest';
import { askMessage, askSubject, waLink, mailtoUri, defaultRecipient, GARAGE_DOCS } from '../ask-message';

// Vectors are copied from Scan's AskMessageTest.kt.
describe('askMessage', () => {
  it('english exact', () => {
    expect(askMessage('en', 'Ramesh', 'MH 12 AB 1234', 'NIA', [['RC Book', null], ['Estimate', 'Blurry']], 'P. Niraj', false)).toBe(
      'Namaste Ramesh,\nFor claim MH 12 AB 1234 (NIA), please send:\n- RC Book\n- Estimate — please resend (Blurry)\nThank you,\nP. Niraj');
  });
  it('reminder and blanks', () => {
    expect(askMessage('en', '', 'MH 12 AB 1234', 'NIA', [['RC Book', null]], '', true)).toBe(
      'Reminder: Namaste,\nFor claim MH 12 AB 1234 (NIA), please send:\n- RC Book\nThank you,');
  });
  it('marathi fixed copy', () => {
    expect(askMessage('mr', 'राम', 'MH 12', 'NIA', [['RC Book', null]], '', false).startsWith('नमस्कार राम,\nक्लेम MH 12 (NIA) साठी')).toBe(true);
  });
  it('hindi rejected and reminder', () => {
    expect(askMessage('hi', '', 'V', 'I', [['FIR', 'Blurry']], '', true)).toBe(
      'स्मरण: नमस्ते,\nक्लेम V (I) के लिए कृपया ये दस्तावेज़ भेजें:\n- FIR — कृपया दोबारा भेजें (Blurry)\nधन्यवाद,');
  });
  it('marathi rejected and reminder', () => {
    expect(askMessage('mr', '', 'V', 'I', [['FIR', 'Blurry']], '', true)).toBe(
      'आठवण: नमस्कार,\nक्लेम V (I) साठी कृपया खालील कागदपत्रे पाठवा:\n- FIR — कृपया पुन्हा पाठवा (Blurry)\nधन्यवाद,');
  });
  it('keeps $ in user text literal', () => {
    expect(askMessage('en', '', 'A$&B', 'I', [['FIR', '$1']], '', false)).toContain('claim A$&B (I)');
  });
});

describe('links', () => {
  it('waLink encodes spaces, devanagari, & # newline', () => {
    const l = waLink('919822012345', 'नमस्ते A & B #1\nx');
    expect(l.startsWith('https://wa.me/919822012345?text=')).toBe(true);
    expect(l).not.toContain('+');
    expect(l).not.toContain(' ');
    expect(l).toContain('%26');
    expect(l).toContain('%23');
    expect(l).toContain('%0A');
  });
  it("pins encodeURIComponent behaviour: ( ) ' stay literal (Scan escapes them)", () => {
    expect(waLink('1', "(a)'")).toBe("https://wa.me/1?text=(a)'");
  });
  it('mailto encodes', () => expect(mailtoUri('a@b.com', 'x y', 'p&q')).toBe('mailto:a@b.com?subject=x%20y&body=p%26q'));
  it('subject', () => expect(askSubject('V', 'I')).toBe('Documents required — V (I)'));
});

describe('recipients', () => {
  it('garage docs go to garage', () => {
    expect(defaultRecipient('invoice')).toBe('garage');
    expect(defaultRecipient('rc')).toBe('insured');
    expect([...GARAGE_DOCS].sort()).toEqual(['estimate', 'invoice', 'supplementaryEstimate']);
  });
});
