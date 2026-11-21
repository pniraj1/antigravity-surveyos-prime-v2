import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  console.log('Opening sandbox...');
  await page.goto('https://surveyos-v2-antigravity-in.web.app', { waitUntil: 'networkidle' });
  console.log('Loaded:', page.url());

  const newClaimBtn = page.locator('button:has-text("New claim")').first();
  console.log('New claim button visible:', await newClaimBtn.isVisible());
  
  if (await newClaimBtn.isVisible()) {
    await newClaimBtn.click();
    await page.waitForTimeout(2000);
    console.log('After New Claim URL:', page.url());
    
    // Check if dialog opened (e.g. Survey Type / Vehicle Type)
    const dialogTitle = await page.locator('[role="dialog"]').allInnerTexts();
    console.log('Dialog contents:', dialogTitle);
    
    // Look for create/confirm button
    const confirmBtn = page.locator('button:has-text("Create"), button:has-text("Final"), button:has-text("Start")').first();
    if (await confirmBtn.isVisible()) {
      console.log('Clicking confirm button:', await confirmBtn.innerText());
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }

    console.log('Final URL:', page.url());
    await page.screenshot({ path: 'recordings/after_new_claim.png' });
  }

  await browser.close();
}

test().catch(console.error);
