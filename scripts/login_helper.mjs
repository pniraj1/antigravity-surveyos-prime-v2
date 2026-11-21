import { chromium } from 'playwright';
import path from 'path';

async function main() {
  console.log('====================================================');
  console.log('Launching Google Chrome for SurveyOS sign-in...');
  console.log('====================================================');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--start-maximized',
      '--no-sandbox',
    ],
  });

  const context = await browser.newContext({
    viewport: null, // allows native full-screen browser window
  });

  const page = await context.newPage();

  console.log('Navigating to https://surveyos.in ...');
  await page.goto('https://surveyos.in', { waitUntil: 'load' });

  // Inject a clear, helpful top banner for the user
  await page.evaluate(() => {
    const banner = document.createElement('div');
    banner.id = 'login-helper-banner';
    banner.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: #0f172a;
        color: #f8fafc;
        padding: 12px 24px;
        border-radius: 9999px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
        z-index: 9999999;
        display: flex;
        align-items: center;
        gap: 16px;
        font-family: system-ui, sans-serif;
        font-size: 14px;
        border: 2px solid #38bdf8;
      ">
        <span>👋 Please sign in with your Google account.</span>
        <button id="save-session-btn" style="
          background: #10b981;
          color: white;
          border: none;
          padding: 6px 16px;
          border-radius: 9999px;
          font-weight: bold;
          cursor: pointer;
        ">✓ Click here when signed in</button>
      </div>
    `;
    document.body.appendChild(banner);
  });

  console.log('\n--> ACTION REQUIRED:');
  console.log('    1. In the Chrome window, sign in with your Google account.');
  console.log('    2. Once on your dashboard, either click the green "Click here when signed in" button,');
  console.log('       or just navigate to your dashboard — the script will auto-detect it.\n');

  // Loop checking for sign-in or button click
  const startTime = Date.now();
  let signedIn = false;

  while (Date.now() - startTime < 300000) { // 5 minutes timeout
    try {
      // Check 1: User clicked the banner button
      const clicked = await page.evaluate(() => {
        return window.__sessionSavedClicked === true;
      });

      // Attach click listener if not attached
      await page.evaluate(() => {
        const btn = document.getElementById('save-session-btn');
        if (btn && !btn.__hasListener) {
          btn.__hasListener = true;
          btn.addEventListener('click', () => {
            window.__sessionSavedClicked = true;
            btn.innerText = 'Saving session...';
            btn.style.background = '#059669';
          });
        }
      });

      // Check 2: Dashboard URL or elements detected
      const url = page.url();
      const hasDashboardText = await page.locator('text=Dashboard').count() > 0;
      const hasNewClaim = await page.locator('text=New claim').count() > 0;

      if (clicked || (url.includes('tab=dashboard') && (hasDashboardText || hasNewClaim))) {
        signedIn = true;
        break;
      }
    } catch (e) {
      // ignore page navigation transient errors
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (signedIn) {
    console.log('\n[SUCCESS] Login confirmed! Synchronizing storage...');
    await page.waitForTimeout(4000);

    const authFile = path.resolve('auth-state.json');
    await context.storageState({ path: authFile });
    console.log(`[SAVED] Session state saved to: ${authFile}`);
  } else {
    console.log('\n[TIMEOUT] 5 minutes elapsed without sign-in confirmation.');
  }

  await browser.close();
  console.log('Browser closed cleanly.');
}

main().catch((err) => {
  console.error('Fatal error in login helper:', err);
  process.exit(1);
});
