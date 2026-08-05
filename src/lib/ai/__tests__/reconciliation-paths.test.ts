import { describe, it, expect } from 'vitest';
import { FIELD_MAPPINGS } from '../reconciliation';
import { createBlankClaim } from '@/types/claim';

/**
 * Every FIELD_MAPPINGS entry carries a `path` that reconcileField / batchReconcile
 * write to when the surveyor resolves a conflict in the Reconciliation Hub.
 *
 * Those setters do a blind deep-set — they create whatever key they are given.
 * So a typo'd path does not throw: it quietly writes to a property nothing
 * reads, while the form keeps rendering the real one. The surveyor clicks a
 * value, sees the field stay empty, and concludes the AI failed.
 *
 * This asserts each path actually exists on a blank claim.
 */
describe('FIELD_MAPPINGS paths', () => {
  const claim = createBlankClaim() as unknown as Record<string, unknown>;

  it.each(FIELD_MAPPINGS.map((m) => [m.label, m.path] as const))(
    '%s → %s resolves on a blank claim',
    (_label, path) => {
      const parts = path.split('.');
      let cursor: unknown = claim;

      for (const part of parts) {
        expect(
          cursor !== null && typeof cursor === 'object',
          `"${path}" — segment before "${part}" is not an object`,
        ).toBe(true);
        const obj = cursor as Record<string, unknown>;
        expect(
          Object.prototype.hasOwnProperty.call(obj, part),
          `"${path}" — no such key "${part}". Available: ${Object.keys(obj).join(', ')}`,
        ).toBe(true);
        cursor = obj[part];
      }
    },
  );
});
