import { chromium } from 'playwright';

async function inspect() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('https://surveyos-v2-antigravity-in.web.app/?tab=assessment&claim=SANDBOX-TEST-01', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const tabs = await page.locator('nav button, nav a, header button, [role="tab"], button').allInnerTexts();
  console.log('Buttons/Tabs found:', tabs.map(t => t.trim().replace(/\n+/g, ' ')).filter(t => t.length > 0 && t.length < 40).slice(0, 30));

  const headings = await page.locator('h1, h2, h3, h4').allInnerTexts();
  console.log('Headings:', headings);

  await page.screenshot({ path: 'recordings/assessment_tab.png' });
  await browser.close();
}

inspect().catch(console.error);
