import { chromium } from 'playwright';

async function checkApp() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('https://surveyos-v2-antigravity-in.web.app/?tab=assessment&claim=SANDBOX-TEST-01', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Check what is in IndexedDB
  const dbData = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const req = indexedDB.open('surveyos-sandbox-surveyor');
      req.onsuccess = (e) => {
        const db = e.target.result;
        console.log('Stores in DB:', Array.from(db.objectStoreNames));
        const tx = db.transaction('claims', 'readonly');
        const store = tx.objectStore('claims');
        const getReq = store.get('SANDBOX-TEST-01');
        getReq.onsuccess = () => resolve(getReq.result);
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  });

  console.log('SANDBOX-TEST-01 Claim from IndexedDB:', dbData ? {
    id: dbData.id,
    reportNo: dbData.reportNo,
    vehicle: dbData.vehicle,
    policy: dbData.policy,
    assessmentCount: dbData.assessment?.length,
  } : 'NOT FOUND');

  await browser.close();
}

checkApp().catch(console.error);
