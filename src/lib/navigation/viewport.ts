/** Phone layout: below Tailwind's `md` breakpoint (768 px). */
export function isNarrowViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
}
