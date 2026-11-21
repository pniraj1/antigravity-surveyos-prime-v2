import { chromium } from 'playwright';

async function checkModal() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('https://surveyos-v2-antigravity-in.web.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const newClaimBtn = page.locator('button:has-text("New claim")').first();
  await newClaimBtn.click();
  await page.waitForTimeout(1000);

  const finalBtn = page.locator('button:has-text("Final")').first();
  if (await finalBtn.isVisible()) {
    await finalBtn.click();
    await page.waitForTimeout(1000);
  }

  // Check what modal dialog is visible!
  const modalText = await page.locator('.fixed.inset-0').allInnerTexts();
  console.log('Modal text:', modalText);

  await page.screenshot({ path: 'recordings/intercepting_modal.png' });
  await browser.close();
}

checkModal().catch(console.error);
