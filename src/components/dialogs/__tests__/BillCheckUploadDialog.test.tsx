import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillCheckUploadDialog, handleDialogKeyDown } from '../BillCheckUploadDialog';

describe('BillCheckUploadDialog', () => {
  describe('1. Open / Close rendering', () => {
    it('does not render when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <BillCheckUploadDialog isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />
      );
      expect(html).toBe('');
    });

    it('renders all key elements when isOpen is true', () => {
      const html = renderToStaticMarkup(
        <BillCheckUploadDialog isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />
      );
      expect(html).toContain('Upload Document for Bill Check');
      expect(html).toContain('Final Bill / Invoice');
      expect(html).toContain('Repair Estimate');
      expect(html).toContain('Start AI Reading');
      expect(html).toContain('Cancel');
      expect(html).toContain('Supports PDF invoices, scans, and multi-page camera captures');
    });
  });

  describe('2. Brand Orange Theme Compliance', () => {
    it('strictly adheres to SurveyOS Brand Orange / warm amber palette', () => {
      const html = renderToStaticMarkup(
        <BillCheckUploadDialog isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />
      );
      // Amber and primary styling should be present
      expect(html).toContain('bg-amber-100');
      expect(html).toContain('border-amber-300');
      expect(html).toContain('text-primary');
      expect(html).toContain('hover:bg-amber-600');

      // Blue or purple classes must not be present
      expect(html).not.toMatch(/text-blue-\d+/);
      expect(html).not.toMatch(/bg-blue-\d+/);
      expect(html).not.toMatch(/border-blue-\d+/);
      expect(html).not.toMatch(/text-purple-\d+/);
      expect(html).not.toMatch(/bg-purple-\d+/);
      expect(html).not.toMatch(/border-purple-\d+/);
      expect(html).not.toMatch(/text-indigo-\d+/);
      expect(html).not.toMatch(/bg-indigo-\d+/);
      expect(html).not.toMatch(/border-indigo-\d+/);
    });
  });

  describe('3. Google Chrome Modern Web Modal Accessibility', () => {
    it('contains role="dialog", aria-modal="true", and aria-labelledby matching title id', () => {
      const html = renderToStaticMarkup(
        <BillCheckUploadDialog isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="upload-dialog-title"');
      expect(html).toContain('id="upload-dialog-title"');
      expect(html).toContain('aria-label="Close dialog"');
      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('aria-label="Document type"');
    });

    it('triggers onClose when Escape key is pressed and not processing', () => {
      const onCloseSpy = vi.fn();
      handleDialogKeyDown({ key: 'Escape' }, { onClose: onCloseSpy, isProcessing: false });
      expect(onCloseSpy).toHaveBeenCalledTimes(1);
    });

    it('does not trigger onClose on Escape if isProcessing is true', () => {
      const onCloseSpy = vi.fn();
      handleDialogKeyDown({ key: 'Escape' }, { onClose: onCloseSpy, isProcessing: true });
      expect(onCloseSpy).not.toHaveBeenCalled();
    });

    it('ignores non-Escape keys', () => {
      const onCloseSpy = vi.fn();
      handleDialogKeyDown({ key: 'Enter' }, { onClose: onCloseSpy, isProcessing: false });
      handleDialogKeyDown({ key: 'Tab' }, { onClose: onCloseSpy, isProcessing: false });
      expect(onCloseSpy).not.toHaveBeenCalled();
    });
  });

  describe('4. Document Selection (Final Bill vs Estimate)', () => {
    it('defaults to final-bill with Recommended badge and aria-checked="true"', () => {
      const html = renderToStaticMarkup(
        <BillCheckUploadDialog isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} defaultKind="final-bill" />
      );
      expect(html).toContain('Recommended');
      expect(html).toContain('Final Bill / Invoice');
      expect(html).toContain('Workshop tax invoice. Match part numbers, verify rates, isolate disallowed items, and calculate savings.');
      expect(html).toContain('aria-checked="true"');
    });

    it('supports selecting estimate as defaultKind', () => {
      const html = renderToStaticMarkup(
        <BillCheckUploadDialog isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} defaultKind="estimate" />
      );
      expect(html).toContain('Repair Estimate');
      expect(html).toContain('Workshop quotation. Maps Est. S.No against the final bill when the assessment was built from the bill.');
      expect(html).toContain('aria-checked="true"');
    });

    it('provides file input accepting images and pdfs', () => {
      const html = renderToStaticMarkup(
        <BillCheckUploadDialog isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />
      );
      expect(html).toContain('type="file"');
      expect(html).toContain('accept="image/*,application/pdf"');
    });
  });
});
