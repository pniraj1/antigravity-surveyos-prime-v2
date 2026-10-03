// One-off: renders the app icon to the PNG sizes the web manifest needs.
// Run: node scripts/make-pwa-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) {
  await sharp('src/app/icon.svg').resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
  console.log(`public/icons/icon-${size}.png`);
}
