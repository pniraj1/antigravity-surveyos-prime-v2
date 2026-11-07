import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PhotosTab,
  PhotoOrientationButton,
  rotatePhoto,
} from '../PhotosTab';
import { useClaimStore } from '@/stores/claim-store';
import { createBlankClaim } from '@/types/claim';
import { rotateImage90 } from '@/lib/photos/rotate-image';
import { toast } from 'sonner';

// Spies and store state
let mockStoreState: any = {};

vi.mock('@/stores/claim-store', () => {
  const store = vi.fn((selector?: any) => {
    if (typeof selector === 'function') {
      return selector(mockStoreState);
    }
    return mockStoreState;
  });
  (store as any).getState = () => mockStoreState;
  (store as any).setState = (next: any) => {
    mockStoreState = typeof next === 'function' ? next(mockStoreState) : { ...mockStoreState, ...next };
  };
  return {
    useClaimStore: store,
  };
});

vi.mock('@/lib/photos/rotate-image', () => ({
  rotateImage90: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-mock" />,
}));

vi.mock('@/components/tabs/photos/DocumentAnnexureSection', () => ({
  DocumentAnnexureSection: () => <div data-testid="annexure-mock" />,
}));

vi.mock('@/hooks/usePhotoUpload', () => ({
  usePhotoUpload: () => ({
    uploadPhotos: vi.fn(),
    isProcessing: false,
  }),
}));

vi.mock('@/components/photos/PhonePhotosDialog', () => ({
  PhonePhotosDialog: () => <div data-testid="phone-dialog-mock" />,
}));

describe('PhotosTab - Photo Orientation Toggle & Rotation', () => {
  const mockRotateImage90 = vi.mocked(rotateImage90);

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {
      currentClaim: null,
      addPhoto: vi.fn(),
      setPhotoTag: vi.fn(),
      deletePhoto: vi.fn(),
      updatePhotoName: vi.fn(),
      updatePhotoLayout: vi.fn(),
      replacePhotoImage: vi.fn(),
    };
  });

  describe('1. Orientation button displays correct symbol and rotate indicator', () => {
    it('displays ▯ for portrait photos with title, aria-label, and rotate indicator (RotateCw)', () => {
      const claim = createBlankClaim('final', 'private');
      claim.photos = [
        {
          name: 'Front Damage Portrait',
          dataUrl: 'data:image/jpeg;base64,portrait-data',
          w: 600,
          h: 800,
        },
      ];
      mockStoreState.currentClaim = claim;

      const html = renderToStaticMarkup(<PhotosTab />);

      // Must be a button
      expect(html).toContain('<button');
      // Symbol for portrait
      expect(html).toContain('▯');
      // Title indicating orientation and rotation capability
      expect(html).toContain('Portrait (click to rotate 90°)');
      // Aria-label
      expect(html).toContain('Rotate photo 90° (currently portrait)');
      // Lucide RotateCw icon SVG
      expect(html).toContain('lucide-rotate-cw');
      // Status color for portrait
      expect(html).toContain('bg-status-success-tint');
    });

    it('displays ▭ for landscape photos with title, aria-label, and rotate indicator (RotateCw)', () => {
      const claim = createBlankClaim('final', 'private');
      claim.photos = [
        {
          name: 'Side Damage Landscape',
          dataUrl: 'data:image/jpeg;base64,landscape-data',
          w: 800,
          h: 600,
        },
      ];
      mockStoreState.currentClaim = claim;

      const html = renderToStaticMarkup(<PhotosTab />);

      expect(html).toContain('<button');
      // Symbol for landscape
      expect(html).toContain('▭');
      // Title indicating orientation and rotation capability
      expect(html).toContain('Landscape (click to rotate 90°)');
      // Aria-label
      expect(html).toContain('Rotate photo 90° (currently landscape)');
      // Lucide RotateCw icon SVG
      expect(html).toContain('lucide-rotate-cw');
      // Status color for landscape
      expect(html).toContain('bg-status-warning-tint');
    });
  });

  describe('2. PhotoOrientationButton component states', () => {
    it('renders loader (animate-spin) when isRotating is true', () => {
      const html = renderToStaticMarkup(
        <PhotoOrientationButton
          item={{ w: 600, h: 800, dataUrl: 'data:image/jpeg;base64,test' }}
          index={0}
          isRotating={true}
          onRotate={vi.fn()}
        />
      );

      // Should display spinning loader
      expect(html).toContain('animate-spin');
      expect(html).toContain('data-testid="rotate-spinner"');
      // Should not display idle RotateCw
      expect(html).not.toContain('lucide-rotate-cw');
      // Should be disabled while rotating
      expect(html).toContain('disabled=""');
    });

    it('renders RotateCw when isRotating is false and triggers onRotate on click', () => {
      const onRotateMock = vi.fn();
      const el = PhotoOrientationButton({
        item: { w: 800, h: 600, dataUrl: 'data:image/jpeg;base64,test' },
        index: 2,
        isRotating: false,
        onRotate: onRotateMock,
      });

      expect(el).not.toBeNull();
      el?.props.onClick();

      expect(onRotateMock).toHaveBeenCalledWith(2, 'data:image/jpeg;base64,test');
    });

    it('returns null if photo item has no width or height', () => {
      const el = PhotoOrientationButton({
        item: { dataUrl: 'data:image/jpeg;base64,test' },
        index: 0,
        isRotating: false,
        onRotate: vi.fn(),
      });

      expect(el).toBeNull();
    });
  });

  describe('3. Rotation execution & store update (rotatePhoto handler)', () => {
    it('calls rotateImage90 and calls replacePhotoImage with swapped dimensions and rotated dataUrl', async () => {
      const replacePhotoImageMock = vi.fn();
      const setRotatingIndexMock = vi.fn();

      mockRotateImage90.mockResolvedValueOnce({
        dataUrl: 'data:image/jpeg;base64,rotated-90-deg',
        w: 800,
        h: 600,
      });

      await rotatePhoto(
        0,
        'data:image/jpeg;base64,original-portrait',
        replacePhotoImageMock,
        setRotatingIndexMock,
      );

      // Verify rotating index was set to 0 initially
      expect(setRotatingIndexMock).toHaveBeenCalledWith(0);

      // Verify rotateImage90 was called with the original dataUrl
      expect(mockRotateImage90).toHaveBeenCalledWith('data:image/jpeg;base64,original-portrait');

      // Verify replacePhotoImage was called with swapped dimensions and new dataUrl
      expect(replacePhotoImageMock).toHaveBeenCalledWith(
        0,
        'data:image/jpeg;base64,rotated-90-deg',
        800,
        600,
      );

      // Verify rotating index was reset back to null in finally
      expect(setRotatingIndexMock).toHaveBeenLastCalledWith(null);
    });

    it('shows toast error and resets rotatingIndex to null when rotateImage90 fails', async () => {
      const replacePhotoImageMock = vi.fn();
      const setRotatingIndexMock = vi.fn();

      mockRotateImage90.mockRejectedValueOnce(new Error('Canvas context error'));

      await expect(
        rotatePhoto(
          1,
          'data:image/jpeg;base64,corrupt-photo',
          replacePhotoImageMock,
          setRotatingIndexMock,
        )
      ).rejects.toThrow('Canvas context error');

      expect(toast.error).toHaveBeenCalledWith('Could not rotate this photo.');
      expect(replacePhotoImageMock).not.toHaveBeenCalled();
      // Verifies finally block executed and reset rotatingIndex
      expect(setRotatingIndexMock).toHaveBeenLastCalledWith(null);
    });
  });
});
