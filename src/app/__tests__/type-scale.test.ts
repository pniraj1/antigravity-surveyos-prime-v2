import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const PAGES = ['pricing', 'features', 'about', 'faq', 'contact', 'refund'].map(
  (p) => [`/${p}`, readFileSync(`src/app/${p}/page.tsx`, 'utf8')] as const,
);

/**
 * The marketing pages previously had one hero size and then a cliff: 43 uses
 * of 8-14px text against 4 large sizes, every weight bold or black. These
 * guard the scale defined in globals.css from eroding back to that.
 */
describe('marketing type scale', () => {
  test('the scale tokens are defined', () => {
    const css = readFileSync('src/app/globals.css', 'utf8');
    for (const token of ['--text-display', '--text-h1', '--text-h2', '--text-h3', '--text-lead', '--text-body', '--text-caption']) {
      expect(css).toContain(token);
    }
  });

  test('body copy is 17px with a readable line height', () => {
    const css = readFileSync('src/app/globals.css', 'utf8');
    expect(css).toContain('--text-body: 1.0625rem');
    expect(css).toContain('--text-body--line-height: 1.65');
  });

  test.each(PAGES)('%s uses no arbitrary pixel font sizes', (_route, src) => {
    expect(src.match(/text-\[\d+px\]/g)).toBeNull();
  });

  test.each(PAGES)('%s uses one grey family (slate, never gray)', (_route, src) => {
    expect(src.match(/(text|bg|border)-gray-\d+/g)).toBeNull();
  });

  test.each(PAGES)('%s has no section heading rendered at body size', (_route, src) => {
    // text-base font-black was a 16px heading — body size pretending to be a heading
    expect(src).not.toContain('text-base font-black');
  });
});
