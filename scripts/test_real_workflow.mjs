import { chromium } from 'playwright';

async function testWorkflow() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('https://surveyos-v2-antigravity-in.web.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click New Claim
  const newClaimBtn = page.locator('button:has-text("New claim")').first();
  await newClaimBtn.click();
  await page.waitForTimeout(1000);

  // Click Final
  const finalBtn = page.locator('button:has-text("Final")').first();
  if (await finalBtn.isVisible()) {
    await finalBtn.click();
    await page.waitForTimeout(2000);
  }

  console.log('Active claim URL:', page.url());

  // Click Claim Details
  const detailsTab = page.locator('button:has-text("Claim Details")').first();
  await detailsTab.click();
  await page.waitForTimeout(1500);

  // Check inputs in Details Tab
  const regVal = await page.locator('#v-reg').inputValue().catch(() => 'NOT FOUND');
  console.log('Current #v-reg value:', regVal);

  if (regVal !== 'NOT FOUND') {
    // Fill Tata Nexon Details
    await page.locator('#v-reg').fill('GJ26AE9189');
    await page.locator('#v-make').fill('TATA MOTORS');
    await page.locator('#v-model').fill('NEXON XZ+ (P)');
    await page.locator('#v-year').fill('2022');
    await page.locator('#v-regdate').fill('2022-04-12');
    await page.locator('#p-polno').fill('0118003121P108924512');
    await page.locator('#p-idv').fill('945000');
    await page.locator('#p-name').fill('Dadabhai Pitambar Mistry');
    console.log('Successfully filled Tata Nexon details!');
    await page.screenshot({ path: 'recordings/real_details_filled.png' });
  }

  // Switch to Assessment Tab
  const assessTab = page.locator('button:has-text("Assessment")').first();
  await assessTab.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'recordings/real_assessment.png' });

  // Check what buttons exist in Assessment
  const assessButtons = await page.locator('button').allInnerTexts();
  console.log('Assessment buttons:', assessButtons.filter(b => b.includes('Add') || b.includes('Part') || b.includes('Row') || b.includes('Labour')));

  await browser.close();
}

testWorkflow().catch(console.error);
