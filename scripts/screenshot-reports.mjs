/**
 * Screenshot script — captures rendered report pages and assessment tab as PNG images.
 * Run AFTER starting the dev server: npm run dev
 *
 * Usage:
 *   node scripts/screenshot-reports.mjs
 *
 * Output: public/images/report-spot-hero.png, report-spot.png,
 *         report-final-pdf.png, report-assessment.png
 */

import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'images');
const TMP_DIR = join(__dirname, '..', '.tmp-screenshots');

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

const BASE = 'http://localhost:3000';

async function screenshotPage(browser, { url, file, label, waitMs = 1500, fullPage = false, clip = null }) {
  console.log(`Capturing: ${label}`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, waitMs));

  const opts = { path: file, type: 'png' };
  if (clip) Object.assign(opts, { clip });
  else opts.fullPage = fullPage;

  await page.screenshot(opts);
  await page.close();
  console.log(`  ✓ Saved → ${file}`);
}

async function screenshotPdf(browser, { file, label }) {
  console.log(`Capturing PDF: ${label}`);

  // 1. Generate PDF via tsx script
  const pdfPath = join(TMP_DIR, 'report-demo.pdf');
  if (!existsSync(pdfPath)) {
    console.log('  Generating PDF via tsx…');
    execSync('npx tsx scripts/generate-pdf.ts', { stdio: 'inherit' });
  }
  console.log(`  PDF ready at ${pdfPath}`);

  // 2. Open the PDF in a new browser page
  const page = await browser.newPage();
  await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 }); // A4 proportions
  // #toolbar=0&navpanes=0 hides Chrome PDF viewer chrome
  const fileUrl = `file:///${pdfPath.replace(/\\/g, '/')}#toolbar=0&navpanes=0&scrollbar=0`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3000));

  // Clip to just the document content — skip any browser toolbar / padding
  await page.screenshot({ path: file, type: 'png', fullPage: false, clip: { x: 0, y: 0, width: 1240, height: 1754 } });
  await page.close();
  console.log(`  ✓ Saved → ${file}`);
}

(async () => {
  console.log('Launching browser…');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-web-security', '--allow-file-access-from-files', '--enable-local-file-accesses'],
  });

  // 1. Spot report — hero strip (top of form)
  await screenshotPage(browser, {
    url: `${BASE}/screenshots/spot`,
    file: join(OUT_DIR, 'report-spot-hero.png'),
    label: 'Spot Report Hero',
    clip: { x: 20, y: 20, width: 1180, height: 700 },
  });

  // 2. Spot report — tall crop showing damage section
  await screenshotPage(browser, {
    url: `${BASE}/screenshots/spot`,
    file: join(OUT_DIR, 'report-spot.png'),
    label: 'Spot Report Full',
    clip: { x: 20, y: 20, width: 900, height: 1200 },
  });

  // 3. Final PDF report — generated via tsx, opened in browser
  await screenshotPdf(browser, {
    file: join(OUT_DIR, 'report-final-pdf.png'),
    label: 'Final PDF Report',
  });

  // 4. Assessment tab mockup
  await screenshotPage(browser, {
    url: `${BASE}/screenshots/assessment`,
    file: join(OUT_DIR, 'report-assessment.png'),
    label: 'Assessment Tab',
    waitMs: 800,
    fullPage: true,
  });

  await browser.close();
  console.log('\nDone. Screenshots saved to public/images/');
})();
