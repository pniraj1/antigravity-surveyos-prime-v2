import { describe, it, expect, vi } from 'vitest';
import { compressImage } from '../compress-image';

describe('compressImage default mime and quality', () => {
  it('defaults to image/jpeg with high fidelity quality (0.85)', async () => {
    const toDataURLSpy = vi.fn().mockReturnValue('data:image/jpeg;base64,mockdata');
    const getContextSpy = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
    });

    vi.stubGlobal('document', {
      createElement: (tagName: string) => {
        if (tagName === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: getContextSpy,
            toDataURL: toDataURLSpy,
          };
        }
        return {};
      },
    } as unknown as Document);

    const file = new File(['mock'], 'test.jpg', { type: 'image/jpeg' });

    class MockFileReader {
      onload: ((e: any) => void) | null = null;
      readAsDataURL() {
        setTimeout(() => {
          this.onload?.({ target: { result: 'data:image/jpeg;base64,xxx' } });
        }, 5);
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    class MockImage {
      width = 1200;
      height = 800;
      onload: (() => void) | null = null;
      set src(_val: string) {
        setTimeout(() => this.onload?.(), 5);
      }
    }
    vi.stubGlobal('Image', MockImage);

    // Call compressImage without specifying mime or quality
    const result = await compressImage(file, 600);
    // It should default to image/jpeg and 0.85
    expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.85);
    expect(result.dataUrl).toContain('data:image/jpeg');
  });
});
