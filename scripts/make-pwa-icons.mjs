// One-off: renders the app icon to the PNG sizes the web manifest needs.
// Run: node scripts/make-pwa-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) {
  await sharp('src/app/icon.svg').resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
  console.log(`public/icons/icon-${size}.png`);
}
// iOS ignores manifest icons; Next serves src/app/apple-icon.png as the apple-touch-icon.
await sharp('src/app/icon.svg').resize(180, 180).png().toFile('src/app/apple-icon.png');
console.log('src/app/apple-icon.png');
