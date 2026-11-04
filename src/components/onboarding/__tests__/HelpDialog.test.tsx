import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { HelpContent } from '../HelpDialog';

describe('HelpContent component', () => {
  const defaultProps = {
    activeTab: 'documents' as const,
    surveyType: 'final' as const,
    onReplaySetup: vi.fn(),
    onGoNext: vi.fn(),
  };

  it('renders current tab information with garage digital PDF guidance', () => {
    const html = renderToStaticMarkup(<HelpContent {...defaultProps} />);
    expect(html).toContain('Help &amp; Surveyor Guide');
    expect(html).toContain('Current Tab');
    expect(html).toContain('Documents');
    expect(html).toContain('Ask the garage to WhatsApp or email the original computer-generated Estimate PDF');
    expect(html).toContain('Next in workflow:');
    expect(html).toContain('AI Review');
  });

  it('renders Replay Guide button and description', () => {
    const html = renderToStaticMarkup(<HelpContent {...defaultProps} />);
    expect(html).toContain('Profile Setup Guide');
    expect(html).toContain('Replay Guide');
    expect(html).toContain('Review your name, licence number, signature, stamp, and AI key settings anytime.');
  });

  it('renders FAQ and Support links with correct destinations', () => {
    const html = renderToStaticMarkup(<HelpContent {...defaultProps} />);
    expect(html).toContain('Read FAQ');
    expect(html).toContain('href="/faq"');
    expect(html).toContain('Email Support');
    expect(html).toContain('href="mailto:surveyosprime@gmail.com"');
    expect(html).toContain('surveyosprime@gmail.com');
  });

  it('displays tab info correctly for non-claim tabs like Profile', () => {
    const html = renderToStaticMarkup(
      <HelpContent
        activeTab="profile"
        onReplaySetup={vi.fn()}
      />
    );
    expect(html).toContain('Profile');
    expect(html).toContain('Your surveyor credentials, IRDAI licence, signature, stamp');
    // Non-claim tabs do not show Next in workflow
    expect(html).not.toContain('Next in workflow:');
  });
});
