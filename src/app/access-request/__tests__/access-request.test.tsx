import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AccessRequestPage from '../page';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore, DEFAULT_PROFILE } from '@/stores/profile-store';
import { waNumber } from '@/lib/chase/ask-message';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
}));

// Mock Firebase
vi.mock('@/lib/firebase/config', () => ({
  db: {},
}));
vi.mock('@/lib/firebase/auth', () => ({
  signInWithGoogle: vi.fn(),
  signOutUser: vi.fn(),
}));

describe('AccessRequestPage & Phone/Location Validation', () => {
  beforeEach(() => {
    useAuthStore.getState().setUser({
      uid: 'test-user-123',
      email: 'surveyor@example.com',
      displayName: 'Niraj Patil',
    } as any);

    useProfileStore.setState({
      profile: {
        ...DEFAULT_PROFILE,
        name: 'Niraj Patil',
        email: 'surveyor@example.com',
        subscriptionStatus: 'pending',
        accessRequestSubmitted: false,
      },
    });
  });

  describe('Indian Mobile Number Validation (waNumber)', () => {
    it('accepts valid 10-digit Indian numbers starting with 6-9', () => {
      expect(waNumber('9876543210')).toBe('919876543210');
      expect(waNumber('+91 98765 43210')).toBe('919876543210');
      expect(waNumber('09876543210')).toBe('919876543210');
      expect(waNumber('8123456789')).toBe('918123456789');
      expect(waNumber('7000000000')).toBe('917000000000');
      expect(waNumber('6999999999')).toBe('916999999999');
    });

    it('rejects invalid or incomplete phone numbers', () => {
      expect(waNumber('')).toBeNull();
      expect(waNumber('1234567')).toBeNull();
      expect(waNumber('5555555555')).toBeNull(); // starts with 5
      expect(waNumber('0000000000')).toBeNull(); // starts with 0
      expect(waNumber('abcdefghij')).toBeNull();
      expect(waNumber('12345')).toBeNull();
    });
  });

  describe('Form Screen (New Requests)', () => {
    it('renders all mandatory fields with required asterisks and hints', () => {
      const html = renderToStaticMarkup(<AccessRequestPage />);

      // Mandatory fields
      expect(html).toContain('Full Name');
      expect(html).toContain('IRDAI Licence Number');
      expect(html).toContain('Mobile / WhatsApp Number');
      expect(html).toContain('Operating City');
      expect(html).toContain('Operating State');

      // Required indicator
      expect(html).toContain('title="Required field">*</span>');

      // Explanatory hint for mobile verification
      expect(html).toContain('10-digit Indian mobile number for verification call / WhatsApp');
      expect(html).toContain('Primary city for survey claims');
    });
  });

  describe('Confirmation Screen (Self-Healing for Incomplete Prior Requests)', () => {
    it('shows action-required banner and input fields when existing applicant has missing phone/location', () => {
      useProfileStore.setState({
        profile: {
          ...DEFAULT_PROFILE,
          name: 'P. Niraj',
          irdaiLicence: 'SLA-12345',
          email: 'surveyor@example.com',
          mobile: '', // MISSING
          city: '',   // MISSING
          state: '',  // MISSING
          accessRequestSubmitted: true,
          subscriptionStatus: 'pending',
        },
      });

      const html = renderToStaticMarkup(<AccessRequestPage />);

      // Renders self-healing card
      expect(html).toContain('Action Required: Complete Contact &amp; Territory');
      expect(html).toContain('Our team cannot verify your credentials or activate your 3-day free trial without a reachable 10-digit mobile number');
      expect(html).toContain('Save Details &amp; Notify Admin');
    });

    it('renders clean confirmation summary when all details are complete', () => {
      useProfileStore.setState({
        profile: {
          ...DEFAULT_PROFILE,
          name: 'P. Niraj',
          irdaiLicence: 'SLA-12345',
          email: 'surveyor@example.com',
          mobile: '+91 98765 43210',
          city: 'Pune',
          state: 'Maharashtra',
          accessRequestSubmitted: true,
          subscriptionStatus: 'pending',
        },
      });

      const html = renderToStaticMarkup(<AccessRequestPage />);

      // Doesn't show the warning banner
      expect(html).not.toContain('Action Required: Complete Contact &amp; Territory');

      // Shows confirmed summary
      expect(html).toContain("You&#x27;re on the list!");
      expect(html).toContain('P. Niraj');
      expect(html).toContain('SLA-12345');
      expect(html).toContain('+91 98765 43210');
      expect(html).toContain('Pune, Maharashtra');
    });
  });
});
