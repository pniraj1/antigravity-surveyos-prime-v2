import type { AssessmentRow, AssessmentSection, PartType } from '@/types/assessment';

/**
 * Resolves what changes when a row moves to a different section.
 *
 * Returns only the fields that change, so callers can spread it over the row.
 * An empty object means the row is already in the target section.
 *
 * Two rules earn their keep here:
 *
 * `partType` decides depreciation — plastic 50%, metal by vehicle age, fibre
 * glass 30%, glass and labour and paint Nil. A labour row must carry
 * `partType: 'labour'`, so moving a plastic part into Labour overwrites its
 * type. `previousPartType` remembers what it was, so moving it back restores
 * plastic instead of defaulting to metal. Without that, a round trip re-prices
 * a 10,000 part on a three-year-old car from 5,000 to 7,500 with nothing on
 * screen reporting it.
 *
 * A manual `depOverride` is cleared on every section change. Labour and paint
 * are Nil depreciation under the tariff, so an override riding along from the
 * parts section would silently reduce the line.
 */
export function resolveSectionMove(
  row: AssessmentRow,
  target: AssessmentSection
): Partial<AssessmentRow> {
  if (row.section === target) return {};

  // `undefined` is written explicitly rather than omitted: callers spread this
  // over the existing row, and an omitted key would leave the old value in place.
  const base = { section: target, depOverride: undefined } as Partial<AssessmentRow>;

  if (target === 'parts') {
    return {
      ...base,
      partType: row.previousPartType ?? 'metal',
      previousPartType: undefined,
    };
  }

  const partType: PartType = target === 'labour' ? 'labour' : 'paint';

  // Only remember a type worth restoring. Moving labour → paint must not
  // overwrite the plastic that was stashed on the way out of parts.
  const previousPartType = row.section === 'parts' ? row.partType : row.previousPartType;

  return { ...base, partType, previousPartType };
}
