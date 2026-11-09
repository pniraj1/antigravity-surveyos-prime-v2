import { describe, it, expect } from 'vitest';
import SxSemanticAI from '../src/lib/semantic-ai.js';

describe('SxSemanticAI - Phase 3 Semantic AI Engine', () => {
  describe('normalizeDropdownOption', () => {
    it('matches exact text and value', () => {
      const options = [
        { text: 'Petrol', value: 'P' },
        { text: 'Diesel', value: 'D' }
      ];
      const matchText = SxSemanticAI.normalizeDropdownOption('Petrol', options);
      expect(matchText?.match.value).toBe('P');
      expect(matchText?.method).toBe('exact');

      const matchVal = SxSemanticAI.normalizeDropdownOption('D', options);
      expect(matchVal?.match.text).toBe('Diesel');
      expect(matchVal?.method).toBe('exact');
    });

    it('matches coded options after stripping prefix (e.g. "01 - MOTOR SPIRIT (PETROL)")', () => {
      const fuelOptions = [
        { text: '01 - MOTOR SPIRIT (PETROL)', value: '01' },
        { text: '02 - HIGH SPEED DIESEL (HSD)', value: '02' },
        { text: '03 - COMPRESSED NATURAL GAS', value: '03' }
      ];

      const resPetrol = SxSemanticAI.normalizeDropdownOption('Petrol', fuelOptions);
      expect(resPetrol).not.toBeNull();
      expect(resPetrol?.match.value).toBe('01');

      const resDiesel = SxSemanticAI.normalizeDropdownOption('Diesel', fuelOptions);
      expect(resDiesel).not.toBeNull();
      expect(resDiesel?.match.value).toBe('02');
    });

    it('matches domain synonyms for Indian motor insurance', () => {
      const fuelOptions = [
        { text: 'MS - MOTOR SPIRIT', value: 'MS' },
        { text: 'HSD - HIGH SPEED DIESEL', value: 'HSD' },
        { text: 'CNG GAS', value: 'CNG' }
      ];

      // "Petrol" maps to "MS" via synonym taxonomy
      const resPetrol = SxSemanticAI.normalizeDropdownOption('Petrol', fuelOptions);
      expect(resPetrol).not.toBeNull();
      expect(resPetrol?.match.value).toBe('MS');

      // "Diesel" maps to "HSD"
      const resDiesel = SxSemanticAI.normalizeDropdownOption('Diesel', fuelOptions);
      expect(resDiesel).not.toBeNull();
      expect(resDiesel?.match.value).toBe('HSD');
    });

    it('matches policy types (Comprehensive <-> Package Policy)', () => {
      const policyOptions = [
        { text: 'PKG - PACKAGE POLICY', value: 'PKG' },
        { text: 'LIAB - LIABILITY ONLY', value: 'LIAB' }
      ];

      const resComp = SxSemanticAI.normalizeDropdownOption('Comprehensive', policyOptions);
      expect(resComp).not.toBeNull();
      expect(resComp?.match.value).toBe('PKG');

      const resTp = SxSemanticAI.normalizeDropdownOption('Third Party', policyOptions);
      expect(resTp).not.toBeNull();
      expect(resTp?.match.value).toBe('LIAB');
    });

    it('handles string arrays and option element mocks', () => {
      const rawOptions = ['01 - PETROL', '02 - DIESEL', '03 - ELECTRIC'];
      const res = SxSemanticAI.normalizeDropdownOption('Electric', rawOptions);
      expect(res).not.toBeNull();
      expect(res?.match.text).toBe('03 - ELECTRIC');
    });

    it('returns null gracefully when no candidate matches', () => {
      const options = [{ text: 'Option A', value: 'A' }, { text: 'Option B', value: 'B' }];
      const res = SxSemanticAI.normalizeDropdownOption('Unrelated XYZ 123', options);
      expect(res).toBeNull();
    });
  });

  describe('sanitizeUiicRemarks', () => {
    it('strips UIIC crash-inducing punctuation (commas, quotes, ampersands, semicolons)', () => {
      const raw = `Vehicle hit tree, damaged bumper & radiator; estimated repair cost: Rs. 15,000/- "urgent"`;
      const sanitized = SxSemanticAI.sanitizeUiicRemarks(raw, 500);

      // Must NOT contain , ; " & / -
      expect(sanitized).not.toMatch(/[,;"&/\-]/);
      expect(sanitized).toMatch(/^[a-zA-Z0-9.\s]+$/);
      expect(sanitized).toContain('Vehicle hit tree');
      expect(sanitized).toContain('estimated repair cost Rs. 15000');
    });

    it('strictly caps at maxLen without slicing mid-word if possible', () => {
      const longText = 'A '.repeat(300); // 600 chars
      const sanitized = SxSemanticAI.sanitizeUiicRemarks(longText, 500);
      expect(sanitized.length).toBeLessThanOrEqual(500);
    });
  });

  describe('draftPortalObservations', () => {
    const sampleClaim = {
      portal: 'uiic',
      fields: {
        accidentCause: 'Vehicle skidded and collided with road divider during heavy rain',
        totalPartsAssessed: 24500,
        totalLabourAssessed: 8500,
        compulsoryExcess: 1000,
        netAssessment: 32000
      }
    };

    it('drafts UIIC compliant remarks within 500 chars and strict punctuation', () => {
      const draft = SxSemanticAI.draftPortalObservations(sampleClaim, { portal: 'uiic' });
      expect(draft.portal).toBe('uiic');
      expect(draft.charCount).toBeLessThanOrEqual(500);
      expect(draft.sanitized).toBe(true);
      // Ensure zero UIIC forbidden characters
      expect(draft.text).not.toMatch(/[,;"&/\-:]/);
      expect(draft.text).toContain('ACCIDENT CAUSE');
      expect(draft.text).toContain('PARTS RS 24500');
      expect(draft.text).toContain('LABOUR RS 8500');
      expect(draft.text).toContain('NET RECOMMENDED SETTLEMENT RS 32000');
    });

    it('drafts NIA / OIC multi-line professional narrative', () => {
      const draft = SxSemanticAI.draftPortalObservations(sampleClaim, { portal: 'nia' });
      expect(draft.portal).toBe('nia');
      expect(draft.text).toContain('CAUSE OF ACCIDENT:');
      expect(draft.text).toContain('ASSESSMENT SUMMARY:');
      expect(draft.text).toContain('Parts Assessed: Rs. 24500.00');
      expect(draft.text).toContain('NET RECOMMENDED AMOUNT: Rs. 32000.00');
    });
  });

  describe('predictFieldMapping', () => {
    it('predicts registration number from diverse DOM context', () => {
      const context = {
        label: 'Vech Regn. No.',
        placeholder: 'MH-12-AB-1234',
        name: 'txtRegNo'
      };
      const prediction = SxSemanticAI.predictFieldMapping(context);
      expect(prediction).not.toBeNull();
      expect(prediction?.bestMatch).toBe('regNumber');
      expect(prediction?.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('predicts chassis number', () => {
      const context = {
        label: 'Chassis Number (Last 6 digits or full)',
        id: 'txt_chassis'
      };
      const prediction = SxSemanticAI.predictFieldMapping(context);
      expect(prediction).not.toBeNull();
      expect(prediction?.bestMatch).toBe('chassisNumber');
    });

    it('predicts driver license number', () => {
      const context = {
        label: 'D/L No of Driver',
        name: 'driverLicence'
      };
      const prediction = SxSemanticAI.predictFieldMapping(context);
      expect(prediction).not.toBeNull();
      expect(prediction?.bestMatch).toBe('driverLicenceNo');
    });

    it('predicts survey remarks from observation label', () => {
      const context = {
        label: 'Surveyor Observations & Cause of Loss Remarks',
        name: 'txtRemarks'
      };
      const prediction = SxSemanticAI.predictFieldMapping(context);
      expect(prediction).not.toBeNull();
      expect(prediction?.bestMatch).toBe('surveyRemarks');
    });

    it('returns null on empty or completely ambiguous contexts', () => {
      const prediction = SxSemanticAI.predictFieldMapping({ label: 'xyzqwerty' });
      expect(prediction).toBeNull();
    });
  });
});
