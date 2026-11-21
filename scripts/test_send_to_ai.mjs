import { chromium } from 'playwright';
import path from 'path';

async function testSendToAI() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('https://surveyos-v2-antigravity-in.web.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Create claim GJ26AE9189
  await page.locator('button:has-text("New claim")').first().click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder*="MH01"], input[placeholder*="Registration"], input[type="text"]').first().fill('GJ26AE9189');
  await page.locator('button:has-text("Create Claim")').first().click();
  await page.waitForTimeout(2000);

  // 2. Set file on RC input
  const rcPath = path.resolve('C:/Users/Manasi/Downloads/Final report testing/rc (5).pdf');
  const docInput = page.locator('input[accept*="pdf"]').first();
  await docInput.setInputFiles(rcPath);
  await page.waitForTimeout(1000);

  // 3. Click Send to AI
  const sendBtn = page.locator('button:has-text("Send to AI")').first();
  console.log('Clicking Send to AI...');
  await sendBtn.click();
  
  // Wait up to 15 seconds to see what happens
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000);
    const toasts = await page.locator('[data-sonner-toast]').allInnerTexts();
    const progress = await page.locator('text=Extracting, text=Reading, text=Processing, text=Analyzing').allInnerTexts();
    const dialogs = await page.locator('[role="dialog"]').allInnerTexts();
    console.log(`[t=${i+1}s] Toasts:`, toasts, 'Dialogs:', dialogs.slice(0, 1));
    if (toasts.some(t => t.includes('extracted') || t.includes('failed') || t.includes('Applied'))) break;
  }

  await page.screenshot({ path: 'recordings/after_send_to_ai.png' });
  await browser.close();
}

testSendToAI().catch(console.error);
