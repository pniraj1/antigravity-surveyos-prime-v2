import { chromium } from 'playwright';

async function testCreate() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('https://surveyos-v2-antigravity-in.web.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click New claim button in sidebar
  await page.locator('button:has-text("New claim")').first().click();
  await page.waitForTimeout(1000);

  // Fill Registration Number
  const regInput = page.locator('input[placeholder*="MH01"], input[placeholder*="Registration"], input[type="text"]').first();
  await regInput.fill('GJ26AE9189');
  console.log('Filled Reg in modal: GJ26AE9189');

  // Select Private Vehicle
  const privateVehBtn = page.locator('button:has-text("Private"), label:has-text("Private")').first();
  if (await privateVehBtn.isVisible()) {
    await privateVehBtn.click();
    console.log('Selected Private Vehicle');
  }

  // Click Create Claim button
  const createBtn = page.locator('button:has-text("Create Claim")').first();
  await createBtn.click();
  await page.waitForTimeout(2000);

  console.log('After create URL:', page.url());

  // Check header text
  const headerText = await page.locator('header').innerText().catch(() => '');
  console.log('Header text:', headerText);

  // Take screenshot of fresh claim
  await page.screenshot({ path: 'recordings/created_claim_success.png' });

  // Now click Claim Details
  await page.locator('button:has-text("Claim Details")').first().click();
  await page.waitForTimeout(1500);

  // Check if #v-reg has GJ26AE9189
  const vReg = await page.locator('#v-reg').inputValue().catch(() => 'NOT FOUND');
  console.log('Details Tab #v-reg value:', vReg);

  await page.screenshot({ path: 'recordings/details_tab_success.png' });

  await browser.close();
}

testCreate().catch(console.error);
