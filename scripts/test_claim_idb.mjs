import { chromium } from 'playwright';

async function testClaim() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('https://surveyos-v2-antigravity-in.web.app/?tab=assessment&claim=SANDBOX-TEST-01', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const claimData = await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('surveyos-v2');
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('claims', 'readonly');
        const store = tx.objectStore('claims');
        const getReq = store.get('SANDBOX-TEST-01');
        getReq.onsuccess = () => resolve(getReq.result);
        getReq.onerror = () => reject(getReq.error);
      };
      req.onerror = () => reject(req.error);
    });
  });

  console.log('Claim found in surveyos-v2:', {
    id: claimData?.id,
    reportNo: claimData?.reportNo,
    surveyType: claimData?.surveyType,
    vehicleNo: claimData?.vehicle?.registrationNumber,
    assessmentRowsCount: claimData?.assessmentRows?.length,
  });

  await browser.close();
}

testClaim().catch(console.error);
