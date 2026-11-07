import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let mockDays = 30;
const setDaysSpy = vi.fn((val: any) => {
  mockDays = typeof val === 'function' ? val(mockDays) : val;
});

let keydownListener: ((e: { key: string }) => void) | null = null;

// Mock window for keyboard Escape handling in Node environment
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    addEventListener: (type: string, listener: any) => {
      if (type === 'keydown') keydownListener = listener;
    },
    removeEventListener: (type: string, _listener: any) => {
      if (type === 'keydown') keydownListener = null;
    },
  };
} else {
  const origAdd = globalThis.window.addEventListener;
  globalThis.window.addEventListener = (type: string, listener: any, options?: any) => {
    if (type === 'keydown') keydownListener = listener;
    origAdd?.call(globalThis.window, type, listener, options);
  };
}

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: vi.fn((init: any) => [mockDays, setDaysSpy]),
    useEffect: vi.fn((fn: () => (() => void) | void) => {
      const cleanup = fn();
      return cleanup;
    }),
  };
});

import {
  ExtendSubscriptionModal,
  PRESET_OPTIONS,
  formatExpiryDate,
} from '../modals/ExtendSubscriptionModal';

function findElements(node: unknown, predicate: (el: ReactElement<any>) => boolean): ReactElement<any>[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) {
    return node.flatMap((child) => findElements(child, predicate));
  }
  const el = node as ReactElement<any>;
  const matches = predicate(el) ? [el] : [];
  if (el.props && el.props.children) {
    return [...matches, ...findElements(el.props.children, predicate)];
  }
  return matches;
}

function findButtonByText(node: unknown, text: string): ReactElement<any> | null {
  const buttons = findElements(node, (el) => el.type === 'button');
  const encoded = text.replace(/&/g, '&amp;');
  for (const btn of buttons) {
    const rendered = renderToStaticMarkup(btn);
    if (rendered.includes(text) || rendered.includes(encoded)) return btn;
  }
  return null;
}

function findInput(node: unknown, id: string): ReactElement<any> | null {
  const inputs = findElements(node, (el) => el.type === 'input' && el.props.id === id);
  return inputs[0] || null;
}

describe('ExtendSubscriptionModal', () => {
  const mockSurveyor = {
    id: 'srv-101',
    name: 'Rajesh Sharma Valuers',
    subscriptionExpiry: '2026-12-15',
  };

  const defaultProps = {
    isOpen: true,
    surveyor: mockSurveyor,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    mockDays = 30;
    setDaysSpy.mockClear();
    defaultProps.onConfirm.mockClear();
    defaultProps.onClose.mockClear();
  });

  describe('1. Visibility & Basic Rendering', () => {
    it('returns null when isOpen is false', () => {
      const el = ExtendSubscriptionModal({
        ...defaultProps,
        isOpen: false,
      });
      expect(el).toBeNull();
    });

    it('returns null when surveyor is null', () => {
      const el = ExtendSubscriptionModal({
        ...defaultProps,
        surveyor: null,
      });
      expect(el).toBeNull();
    });

    it('renders modal when isOpen is true with surveyor details and current expiry', () => {
      const html = renderToStaticMarkup(<ExtendSubscriptionModal {...defaultProps} />);

      // Title & surveyor info
      expect(html).toContain('Extend Subscription');
      expect(html).toContain('Rajesh Sharma Valuers');

      // Current expiry formatted
      expect(html).toContain('Current Expiry');
      expect(html).toContain('15 Dec 2026');

      // Preset pills
      expect(html).toContain('+30 Days');
      expect(html).toContain('+90 Days');
      expect(html).toContain('+180 Days');
      expect(html).toContain('+365 Days');
      expect(html).toContain('(1 Mo)');
      expect(html).toContain('(3 Mo)');
      expect(html).toContain('(6 Mo)');
      expect(html).toContain('(1 Yr)');

      // Custom days input
      expect(html).toContain('Custom Days');
      expect(html).toContain('id="extend-days"');

      // Live preview box
      expect(html).toContain('New Expiry:');
      expect(html).toContain('(+30 days from current expiry)');

      // Action buttons
      expect(html).toContain('Cancel');
      expect(html).toContain('Confirm &amp; Extend');

      // Accessibility
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="extend-modal-title"');
      expect(html).toContain('focus-visible:ring-primary');
    });
  });

  describe('2. Preset Buttons Selection', () => {
    it('renders all 4 preset options defined in PRESET_OPTIONS', () => {
      expect(PRESET_OPTIONS).toEqual([
        { days: 30, label: '+30 Days', subtext: '1 Mo' },
        { days: 90, label: '+90 Days', subtext: '3 Mo' },
        { days: 180, label: '+180 Days', subtext: '6 Mo' },
        { days: 365, label: '+365 Days', subtext: '1 Yr' },
      ]);
    });

    it('clicking preset buttons updates the days input', () => {
      const el = ExtendSubscriptionModal(defaultProps);
      expect(el).not.toBeNull();

      const presetButtons = findElements(el, (item) =>
        item.type === 'button' && Boolean(item.props['aria-label']?.startsWith('Extend by'))
      );
      expect(presetButtons).toHaveLength(4);

      // Click +90 Days
      presetButtons[1].props.onClick();
      expect(setDaysSpy).toHaveBeenCalledWith(90);

      // Click +180 Days
      presetButtons[2].props.onClick();
      expect(setDaysSpy).toHaveBeenCalledWith(180);

      // Click +365 Days
      presetButtons[3].props.onClick();
      expect(setDaysSpy).toHaveBeenCalledWith(365);

      // Click +30 Days
      presetButtons[0].props.onClick();
      expect(setDaysSpy).toHaveBeenCalledWith(30);
    });

    it('marks the active preset button with aria-pressed="true"', () => {
      mockDays = 90;
      const html = renderToStaticMarkup(<ExtendSubscriptionModal {...defaultProps} />);
      expect(html).toMatch(/aria-label="Extend by 90 days"[^>]*aria-pressed="true"/);
      expect(html).toMatch(/aria-label="Extend by 30 days"[^>]*aria-pressed="false"/);
    });
  });

  describe('3. Custom Days Input', () => {
    it('typing custom days updates the days input', () => {
      const el = ExtendSubscriptionModal(defaultProps);
      const input = findInput(el, 'extend-days');
      expect(input).not.toBeNull();

      input!.props.onChange({ target: { value: '45' } });
      expect(setDaysSpy).toHaveBeenCalledWith(45);

      input!.props.onChange({ target: { value: '120' } });
      expect(setDaysSpy).toHaveBeenCalledWith(120);
    });

    it('clamps typed numbers to max 365 and min 0 on change', () => {
      const el = ExtendSubscriptionModal(defaultProps);
      const input = findInput(el, 'extend-days');

      // Clamps to 365 if greater than 365
      input!.props.onChange({ target: { value: '500' } });
      expect(setDaysSpy).toHaveBeenCalledWith(365);

      // Handles non-number input gracefully
      input!.props.onChange({ target: { value: 'abc' } });
      expect(setDaysSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('4. Live Expiry Preview Box', () => {
    it('live preview shows updated expiry date when days is 30', () => {
      mockDays = 30;
      const html = renderToStaticMarkup(<ExtendSubscriptionModal {...defaultProps} />);

      expect(html).toContain('New Expiry:');
      expect(html).toContain('14 Jan 2027');
      expect(html).toContain('(+30 days from current expiry)');
    });

    it('live preview shows updated expiry date when days is 90', () => {
      mockDays = 90;
      const html = renderToStaticMarkup(<ExtendSubscriptionModal {...defaultProps} />);

      expect(html).toContain('New Expiry:');
      expect(html).toContain('15 Mar 2027');
      expect(html).toContain('(+90 days from current expiry)');
    });

    it('live preview shows updated expiry date when days is 365', () => {
      mockDays = 365;
      const html = renderToStaticMarkup(<ExtendSubscriptionModal {...defaultProps} />);

      expect(html).toContain('New Expiry:');
      expect(html).toContain('15 Dec 2027');
      expect(html).toContain('(+365 days from current expiry)');
    });
  });

  describe('5. Confirm & Extend Action', () => {
    it('clicking Confirm & Extend calls onConfirm with UID and days', () => {
      mockDays = 60;
      const el = ExtendSubscriptionModal(defaultProps);
      const confirmBtn = findButtonByText(el, 'Confirm & Extend');
      expect(confirmBtn).not.toBeNull();

      confirmBtn!.props.onClick();
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
      expect(defaultProps.onConfirm).toHaveBeenCalledWith('srv-101', 60);
    });

    it('disables Confirm & Extend button when days is 0 or invalid', () => {
      mockDays = 0;
      const html = renderToStaticMarkup(<ExtendSubscriptionModal {...defaultProps} />);
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Confirm &amp; Extend<\/button>/);
    });
  });

  describe('6. Dismiss & Close Actions', () => {
    it('clicking Cancel calls onClose', () => {
      const el = ExtendSubscriptionModal(defaultProps);
      const cancelBtn = findButtonByText(el, 'Cancel');
      expect(cancelBtn).not.toBeNull();

      cancelBtn!.props.onClick();
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('clicking header close X button calls onClose', () => {
      const el = ExtendSubscriptionModal(defaultProps);
      const closeButtons = findElements(el, (item) =>
        item.type === 'button' && item.props['aria-label'] === 'Close'
      );
      expect(closeButtons.length).toBeGreaterThan(0);

      closeButtons[0].props.onClick();
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('clicking the backdrop overlay calls onClose', () => {
      const el = ExtendSubscriptionModal(defaultProps) as ReactElement<any>;
      expect(el.props.className).toContain('fixed inset-0');

      el.props.onClick();
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('pressing Escape key calls onClose', () => {
      ExtendSubscriptionModal(defaultProps);
      expect(keydownListener).not.toBeNull();

      keydownListener!({ key: 'Escape' });
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('7. Helper formatExpiryDate formatting', () => {
    it('formats YYYY-MM-DD properly', () => {
      expect(formatExpiryDate('2026-12-15')).toBe('15 Dec 2026');
      expect(formatExpiryDate('2027-01-05')).toBe('05 Jan 2027');
    });

    it('returns fallback dash for null/undefined/empty', () => {
      expect(formatExpiryDate(null)).toBe('—');
      expect(formatExpiryDate(undefined)).toBe('—');
      expect(formatExpiryDate('')).toBe('—');
    });
  });
});
