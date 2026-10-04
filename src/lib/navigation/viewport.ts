/** Phone layout: below Tailwind's `md` breakpoint (768 px). */
export const NARROW_QUERY = '(max-width: 767px)';

export function isNarrowViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches;
}
