import { chromium } from 'playwright';

async function testFullNavigation() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log('1. Opening sandbox...');
  await page.goto('https://surveyos-v2-antigravity-in.web.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 2. Click New Claim
  console.log('2. Creating claim GJ26AE9189...');
  await page.locator('button:has-text("New claim")').first().click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder*="MH01"], input[placeholder*="Registration"], input[type="text"]').first().fill('GJ26AE9189');
  await page.locator('button:has-text("Create Claim")').first().click();
  await page.waitForTimeout(2000);

  // 3. Documents Tab
  console.log('3. In Documents tab...');
  await page.waitForTimeout(1500);

  // 4. Fill Claim Details
  console.log('4. Navigating to Claim Details...');
  await page.locator('button:has-text("Claim Details")').first().click();
  await page.waitForTimeout(1500);

  await page.locator('#v-make').fill('TATA MOTORS');
  await page.locator('#v-model').fill('NEXON XZ+ (P)');
  await page.locator('#v-year').fill('2022');
  await page.locator('#v-regdate').fill('2022-04-12');
  await page.locator('#p-polno').fill('0118003121P108924512');
  await page.locator('#p-idv').fill('945000');
  await page.locator('#p-name').fill('Dadabhai Pitambar Mistry');
  await page.locator('#p-office').fill('United India Insurance, Bharuch');

  console.log('Filled details successfully.');

  // 5. Navigate to Assessment
  console.log('5. Navigating to Assessment tab...');
  await page.locator('button:has-text("Assessment")').first().click();
  await page.waitForTimeout(1500);

  // Add 3 sample parts
  const addPartBtn = page.locator('button:has-text("Part"), button:has-text("Add Part")').first();
  if (await addPartBtn.isVisible()) {
    await addPartBtn.click();
    await page.waitForTimeout(500);
    await addPartBtn.click();
    await page.waitForTimeout(500);
  }

  // 6. Navigate to Bill Check
  console.log('6. Navigating to Bill Check...');
  await page.locator('button:has-text("Bill Check")').first().click();
  await page.waitForTimeout(1500);

  // 7. Navigate to Report Center
  console.log('7. Navigating to Report Center...');
  await page.locator('button:has-text("Report Center")').first().click();
  await page.waitForTimeout(1500);

  // 8. Navigate to Photo Sheet
  console.log('8. Navigating to Photo Sheet...');
  await page.locator('button:has-text("Photo Sheet")').first().click();
  await page.waitForTimeout(1500);

  console.log('Full navigation test successful!');
  await browser.close();
}

testFullNavigation().catch(console.error);
