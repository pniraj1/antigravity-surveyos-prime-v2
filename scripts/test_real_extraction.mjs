import { chromium } from 'playwright';
import path from 'path';

async function testUpload() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  console.log('Navigating to sandbox...');
  await page.goto('https://surveyos-v2-antigravity-in.web.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Create claim GJ26AE9189
  await page.locator('button:has-text("New claim")').first().click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder*="MH01"], input[placeholder*="Registration"], input[type="text"]').first().fill('GJ26AE9189');
  await page.locator('button:has-text("Create Claim")').first().click();
  await page.waitForTimeout(2000);

  console.log('On Documents tab:', page.url());

  // Check the RC file input
  // In DocumentsTab.tsx:
  // Each slot has an input[type="file"].
  // Let's find all file inputs
  const fileInputs = page.locator('input[type="file"]');
  const count = await fileInputs.count();
  console.log(`Found ${count} file inputs.`);

  // Let's set file on the first file input
  const rcPath = path.resolve('C:/Users/Manasi/Downloads/Final report testing/rc (5).pdf');
  console.log('Setting file:', rcPath);

  // Find the RC upload slot or trigger it
  // In DocumentsTab, the card has an input or click target
  // Let's inspect the cards
  const cards = await page.locator('.cursor-pointer, [role="button"]').allInnerTexts();
  console.log('Clickable cards:', cards.filter(c => c.includes('RC') || c.includes('Policy') || c.includes('Bill')));

  // Set file on the first accept="image/*,application/pdf"
  const docInput = page.locator('input[accept*="pdf"]').first();
  await docInput.setInputFiles(rcPath);
  console.log('File set on first input!');
  await page.waitForTimeout(3000);

  // Check if review sheet or modal popped up
  const modals = await page.locator('[role="dialog"], .fixed.inset-0').allInnerTexts();
  console.log('Modals after file set:', modals);

  await page.screenshot({ path: 'recordings/after_file_upload.png' });

  await browser.close();
}

testUpload().catch(console.error);
