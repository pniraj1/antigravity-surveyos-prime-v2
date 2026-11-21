import { chromium } from 'playwright';

async function testDB() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('https://surveyos-v2-antigravity-in.web.app/?tab=assessment&claim=SANDBOX-TEST-01', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const dbs = await page.evaluate(async () => {
    const list = await indexedDB.databases();
    return list;
  });

  console.log('IndexedDB Databases:', dbs);

  await browser.close();
}

testDB().catch(console.error);
