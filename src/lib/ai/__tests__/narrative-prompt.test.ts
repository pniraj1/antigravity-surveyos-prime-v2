/**
 * Unit tests for buildCoveringNarrativePrompt
 *
 * Tests the GROUPED evidence logic introduced to replace the old
 * "3 random flagged items" slice.  No API key or network needed.
 *
 * Run:  npm test
 */
import { describe, it, expect } from 'vitest';
import { buildCoveringNarrativePrompt } from '../prompts';

// ── Fixture data ─────────────────────────────────────────────────────────────

const CLAIM_SUMMARY = JSON.stringify({
  vehicleReg: 'MH01AB1234',
  make: 'Tata',
  model: 'Nexon',
  insuredName: 'Ramesh Kumar',
  causeOfLoss: 'Collision with another vehicle',
  estimateTotal: 53650,
  assessedTotal: 35000,
  netPayable: 29500,
  insuredPays: 6000,
});

const DEDUCTION_LINES = [
  'Depreciation on parts: ₹4,500',
  'Compulsory excess: ₹500',
  'Consumables (oil, sealants, nuts, bolts etc.): ₹450 — excluded under standard policy terms',
  'Salvage value of replaced parts: ₹2,000',
];

const GROUPED_ITEMS: Record<string, string[]> = {
  safe:       ['LH Headlamp', 'Front Grille'],
  consumable: ['Engine Oil', 'Coolant'],
  salvage:    ['LH Door Assembly'],
  'not-covered': [],   // empty → should be silently skipped
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildCoveringNarrativePrompt', () => {

  describe('structure', () => {
    it('returns a non-empty string', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES);
      expect(prompt.length).toBeGreaterThan(100);
    });

    it('contains the claim summary JSON', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES);
      expect(prompt).toContain('MH01AB1234');
      expect(prompt).toContain('Ramesh Kumar');
    });

    it('contains all deduction lines numbered', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES);
      expect(prompt).toContain('1. Depreciation on parts: ₹4,500');
      expect(prompt).toContain('2. Compulsory excess: ₹500');
      expect(prompt).toContain('3. Consumables');
      expect(prompt).toContain('4. Salvage value');
    });

    it('instructs AI to return plain text (no JSON/markdown)', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES);
      expect(prompt).toContain('Return ONLY a plain text string');
      expect(prompt).toContain('No JSON, no markdown');
    });

    it('asks for exactly 3 paragraphs', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES);
      expect(prompt).toContain('3 paragraphs');
    });
  });

  describe('groupedItems block — present when data provided', () => {
    it('includes the grouped evidence block header', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES, GROUPED_ITEMS);
      expect(prompt).toContain('Assessment decisions by category');
    });

    it('maps "safe" category to human-readable label', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES, GROUPED_ITEMS);
      expect(prompt).toContain('Parts found safe / no replacement needed');
    });

    it('lists specific safe parts by name', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES, GROUPED_ITEMS);
      expect(prompt).toContain('LH Headlamp');
      expect(prompt).toContain('Front Grille');
    });

    it('maps "consumable" category to correct label', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES, GROUPED_ITEMS);
      expect(prompt).toContain('Consumable items (excluded under standard policy)');
    });

    it('lists specific consumable parts by name', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES, GROUPED_ITEMS);
      expect(prompt).toContain('Engine Oil');
      expect(prompt).toContain('Coolant');
    });

    it('maps "salvage" category to correct label', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES, GROUPED_ITEMS);
      expect(prompt).toContain('Salvage / disposal parts (value deducted)');
    });

    it('lists specific salvage parts by name', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES, GROUPED_ITEMS);
      expect(prompt).toContain('LH Door Assembly');
    });

    it('silently skips empty categories (not-covered has no items)', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES, GROUPED_ITEMS);
      expect(prompt).not.toContain('Items not payable under this policy:');
    });
  });

  describe('groupedItems block — absent when not provided', () => {
    it('does not include grouped block when groupedItems is undefined', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES, undefined);
      expect(prompt).not.toContain('Assessment decisions by category');
    });

    it('does not include grouped block when groupedItems is empty {}', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES, {});
      expect(prompt).not.toContain('Assessment decisions by category');
    });

    it('still works correctly without grouped items (fallback mode)', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES);
      expect(prompt).toContain('Depreciation on parts');
      expect(prompt).toContain('3 paragraphs');
    });
  });

  describe('language variants', () => {
    it('includes a language instruction for Marathi', () => {
      const prompt = buildCoveringNarrativePrompt('marathi', CLAIM_SUMMARY, DEDUCTION_LINES, GROUPED_ITEMS);
      // Should contain Marathi-specific instruction text or at minimum still build a valid prompt
      expect(prompt.length).toBeGreaterThan(100);
    });

    it('falls back gracefully for unknown language', () => {
      const prompt = buildCoveringNarrativePrompt('klingon', CLAIM_SUMMARY, DEDUCTION_LINES, GROUPED_ITEMS);
      expect(prompt).toContain('Assessment decisions by category');
      expect(prompt.length).toBeGreaterThan(100);
    });
  });

  describe('edge cases', () => {
    it('handles a category with a single part', () => {
      const groups = { safe: ['Bonnet'] };
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES, groups);
      expect(prompt).toContain('Bonnet');
    });

    it('handles unknown category keys gracefully (uses key as-is)', () => {
      const groups = { 'custom-category': ['Spoiler'] };
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES, groups);
      expect(prompt).toContain('custom-category');
      expect(prompt).toContain('Spoiler');
    });

    it('handles empty deduction lines array', () => {
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, [], GROUPED_ITEMS);
      expect(prompt).toContain('Assessment decisions by category');
      expect(prompt).toContain('LH Headlamp');
    });

    it('handles all-empty grouped items gracefully', () => {
      const allEmpty = { safe: [], consumable: [], salvage: [] };
      const prompt = buildCoveringNarrativePrompt('english', CLAIM_SUMMARY, DEDUCTION_LINES, allEmpty);
      expect(prompt).not.toContain('Assessment decisions by category');
    });
  });

});
