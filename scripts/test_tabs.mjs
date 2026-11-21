import { chromium } from 'playwright';

async function testTabs() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('https://surveyos-v2-antigravity-in.web.app/?tab=assessment&claim=SANDBOX-TEST-01', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('Current URL:', page.url());

  // Test clicking 'Claim Details'
  const detailsTab = page.locator('button:has-text("Claim Details")').first();
  if (await detailsTab.isVisible()) {
    await detailsTab.click();
    await page.waitForTimeout(1000);
    console.log('Clicked Claim Details. URL:', page.url());
    const inputs = await page.locator('input').evaluateAll(els => els.map(el => ({
      name: el.name,
      placeholder: el.placeholder,
      value: el.value,
      id: el.id
    })));
    console.log('Claim Details inputs:', inputs.slice(0, 10));
  }

  // Test clicking 'Documents'
  const docsTab = page.locator('button:has-text("Documents")').first();
  if (await docsTab.isVisible()) {
    await docsTab.click();
    await page.waitForTimeout(1000);
    console.log('Clicked Documents. URL:', page.url());
  }

  // Test clicking 'Assessment'
  const assessTab = page.locator('button:has-text("Assessment")').first();
  if (await assessTab.isVisible()) {
    await assessTab.click();
    await page.waitForTimeout(1000);
    console.log('Clicked Assessment. URL:', page.url());
  }

  // Test clicking 'Bill Check'
  const billTab = page.locator('button:has-text("Bill Check")').first();
  if (await billTab.isVisible()) {
    await billTab.click();
    await page.waitForTimeout(1000);
    console.log('Clicked Bill Check. URL:', page.url());
  }

  // Test clicking 'Report Center'
  const reportTab = page.locator('button:has-text("Report Center")').first();
  if (await reportTab.isVisible()) {
    await reportTab.click();
    await page.waitForTimeout(1000);
    console.log('Clicked Report Center. URL:', page.url());
  }

  // Test clicking 'Photo Sheet'
  const photoTab = page.locator('button:has-text("Photo Sheet")').first();
  if (await photoTab.isVisible()) {
    await photoTab.click();
    await page.waitForTimeout(1000);
    console.log('Clicked Photo Sheet. URL:', page.url());
  }

  await browser.close();
}

testTabs().catch(console.error);
