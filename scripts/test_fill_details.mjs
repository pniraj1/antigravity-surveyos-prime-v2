import { chromium } from 'playwright';

async function testFillDetails() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('https://surveyos-v2-antigravity-in.web.app/?tab=details&claim=SANDBOX-TEST-01', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Fill Vehicle details
  const regInput = page.locator('#v-reg');
  if (await regInput.isVisible()) {
    await regInput.fill('GJ26AE9189');
    console.log('Filled Reg No: GJ26AE9189');
  }

  const makeInput = page.locator('#v-make');
  if (await makeInput.isVisible()) {
    await makeInput.fill('TATA MOTORS');
    console.log('Filled Make: TATA MOTORS');
  }

  const modelInput = page.locator('#v-model');
  if (await modelInput.isVisible()) {
    await modelInput.fill('NEXON XZ+ (P)');
    console.log('Filled Model: NEXON XZ+ (P)');
  }

  const yearInput = page.locator('#v-year');
  if (await yearInput.isVisible()) {
    await yearInput.fill('2022');
    console.log('Filled Year: 2022');
  }

  const regDateInput = page.locator('#v-regdate');
  if (await regDateInput.isVisible()) {
    await regDateInput.fill('2022-04-12');
    console.log('Filled Reg Date: 2022-04-12');
  }

  // Fill Policy details
  const polInput = page.locator('#p-polno');
  if (await polInput.isVisible()) {
    await polInput.fill('0118003121P108924512');
    console.log('Filled Policy No');
  }

  const idvInput = page.locator('#p-idv');
  if (await idvInput.isVisible()) {
    await idvInput.fill('945000');
    console.log('Filled IDV: 945000');
  }

  const nameInput = page.locator('#p-name');
  if (await nameInput.isVisible()) {
    await nameInput.fill('Dadabhai Pitambar Mistry');
    console.log('Filled Insured Name');
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'recordings/details_filled.png' });

  // Now switch to Assessment tab and see if age depreciation is calculated!
  const assessTab = page.locator('button:has-text("Assessment")').first();
  await assessTab.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'recordings/assessment_after_fill.png' });

  await browser.close();
}

testFillDetails().catch(console.error);
