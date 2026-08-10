import { describe, it, expect } from 'vitest';
import { resolveVisionChunkSize, assertWithinImageCap } from '../image-cap';

describe('resolveVisionChunkSize', () => {
  it('clamps the preferred size down to a cap of 1 (NVIDIA)', () => {
    expect(resolveVisionChunkSize(2, 1)).toBe(1);
  });

  it('keeps the preferred size when the cap is larger (Groq at 5)', () => {
    expect(resolveVisionChunkSize(2, 5)).toBe(2);
  });

  it('keeps the preferred size when there is no cap (Gemini)', () => {
    expect(resolveVisionChunkSize(2, null)).toBe(2);
  });

  it('never returns less than 1, even for a nonsense cap', () => {
    expect(resolveVisionChunkSize(2, 0)).toBe(1);
    expect(resolveVisionChunkSize(2, -3)).toBe(1);
  });
});

describe('assertWithinImageCap', () => {
  it('accepts a chunk at exactly the cap', () => {
    expect(() => assertWithinImageCap(1, 1, 'nvidia')).not.toThrow();
    expect(() => assertWithinImageCap(5, 5, 'groq')).not.toThrow();
  });

  it('accepts any size when uncapped', () => {
    expect(() => assertWithinImageCap(9, null, 'gemini')).not.toThrow();
  });

  it('throws rather than silently dropping pages when over the cap', () => {
    expect(() => assertWithinImageCap(2, 1, 'nvidia'))
      .toThrow('nvidia accepts at most 1 image per request, got 2');
  });
});
