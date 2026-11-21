import { chromium } from 'playwright';

async function checkUrl() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('https://surveyos-v2-antigravity-in.web.app/?tab=details&claim=SANDBOX-TEST-01', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('Final URL:', page.url());
  const bodyText = await page.innerText('body');
  console.log('Body snippet:', bodyText.slice(0, 500));

  await browser.close();
}

checkUrl().catch(console.error);
