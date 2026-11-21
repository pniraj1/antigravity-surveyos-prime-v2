import { chromium } from 'playwright';

async function checkDocInputs() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('https://surveyos-v2-antigravity-in.web.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Create claim
  await page.locator('button:has-text("New claim")').first().click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder*="MH01"], input[placeholder*="Registration"], input[type="text"]').first().fill('GJ26AE9189');
  await page.locator('button:has-text("Create Claim")').first().click();
  await page.waitForTimeout(2000);

  // We are on Documents tab
  console.log('On Documents tab:', page.url());

  // Find all file inputs or upload buttons
  const fileInputs = await page.locator('input[type="file"]').evaluateAll(els => els.map(el => ({
    id: el.id,
    name: el.name,
    accept: el.accept
  })));
  console.log('File inputs:', fileInputs);

  const cards = await page.locator('button, [role="button"]').evaluateAll(els => 
    els.map(el => el.innerText.trim().replace(/\n+/g, ' ')).filter(t => t.includes('RC') || t.includes('DL') || t.includes('Policy') || t.includes('Upload'))
  );
  console.log('Doc cards/buttons:', cards.slice(0, 15));

  await browser.close();
}

checkDocInputs().catch(console.error);
