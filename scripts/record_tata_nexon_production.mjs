import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.resolve('recordings');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  console.log('--- Starting SurveyOS Tata Nexon Production Recording ---');
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: OUT_DIR,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  // 1. Inject High-Precision Animated Surveyor Cursor
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const cursor = document.createElement('div');
      cursor.id = 'demo-cursor';
      cursor.style.cssText = `
        width: 22px;
        height: 22px;
        background: rgba(220, 38, 38, 0.9);
        border: 2px solid #ffffff;
        border-radius: 50%;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 9999999;
        pointer-events: none;
        box-shadow: 0 0 10px rgba(220,38,38,0.6), 0 4px 12px rgba(0,0,0,0.3);
        transition: transform 0.12s ease-out, background 0.12s;
        transform: translate(-50%, -50%);
      `;
      document.body.appendChild(cursor);

      window.addEventListener('mousemove', (e) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
      });

      window.addEventListener('mousedown', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(0.7)';
        cursor.style.background = 'rgba(16, 185, 129, 0.95)'; // emerald on click
      });

      window.addEventListener('mouseup', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        cursor.style.background = 'rgba(220, 38, 38, 0.9)';
      });
    });
  });

  // 2. Open Sandbox Landing Page
  console.log('[00:00] Loading SurveyOS Sandbox...');
  await page.goto('https://surveyos-v2-antigravity-in.web.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Apply strict DPDP Act Privacy Blur CSS
  await page.addStyleTag({
    content: `
      input[type="tel"], 
      input[name*="phone"], 
      input[name*="mobile"], 
      input[id*="phone"], 
      input[id*="mobile"],
      input[name*="bank"], 
      input[name*="account"],
      input[id*="bank"], 
      input[id*="account"],
      .pii-blur {
        filter: blur(5px) !important;
      }
    `,
  });

  // Smooth mouse move & click helper
  async function smoothClick(selector, delayAfter = 1200) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible()) {
        const box = await el.boundingBox();
        if (box) {
          const targetX = box.x + box.width / 2;
          const targetY = box.y + box.height / 2;
          await page.mouse.move(targetX, targetY, { steps: 22 });
          await page.waitForTimeout(300);
          await el.click();
          await page.waitForTimeout(delayAfter);
          return true;
        }
      }
    } catch (e) {
      console.warn(`Click failed for ${selector}:`, e.message);
    }
    return false;
  }

  // Hover helper
  async function smoothHover(selector, delayAfter = 1500) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible()) {
        const box = await el.boundingBox();
        if (box) {
          const targetX = box.x + box.width / 2;
          const targetY = box.y + box.height / 2;
          await page.mouse.move(targetX, targetY, { steps: 20 });
          await page.waitForTimeout(delayAfter);
          return true;
        }
      }
    } catch (e) {
      console.warn(`Hover failed for ${selector}:`, e.message);
    }
    return false;
  }

  // --- ACT 1: NEW CLAIM CREATION (00:00 - 00:08) ---
  console.log('[00:02] Clicking New Claim...');
  await smoothClick('button:has-text("New claim")');

  console.log('[00:04] Entering Registration Number: GJ26AE9189...');
  const regInput = page.locator('input[placeholder*="MH01"], input[placeholder*="Registration"], input[type="text"]').first();
  await regInput.click();
  await regInput.pressSequentially('GJ26AE9189', { delay: 60 });
  await page.waitForTimeout(600);

  console.log('[00:06] Selecting Private Vehicle & Creating Claim...');
  await smoothClick('button:has-text("Private"), label:has-text("Private")', 500);
  await smoothClick('button:has-text("Create Claim")', 2500);

  // --- ACT 2: DOCUMENTS TAB & OCR INGESTION (00:08 - 00:18) ---
  console.log('[00:08] In Documents Workspace...');
  await page.waitForTimeout(1000);
  await smoothHover('text=Core Documents', 1200);
  await smoothHover('text=RC Book', 1000);
  await smoothHover('text=Policy Schedule', 1000);
  await smoothHover('text=Final Garage Bill', 1000);

  // --- ACT 3: CLAIM DETAILS TAB & ZERO TYPING (00:18 - 00:28) ---
  console.log('[00:18] Navigating to Claim Details Tab...');
  await smoothClick('button:has-text("Claim Details")');
  await page.waitForTimeout(1000);

  // Populate Tata Nexon details
  await page.locator('#v-make').fill('TATA MOTORS');
  await page.locator('#v-model').fill('NEXON XZ+ (PETROL)');
  await page.locator('#v-year').fill('2022');
  await page.locator('#v-regdate').fill('2022-04-12');
  await page.locator('#p-polno').fill('0118003121P108924512');
  await page.locator('#p-idv').fill('945000');
  await page.locator('#p-name').fill('Dadabhai Pitambar Mistry');
  await page.locator('#p-office').fill('United India Insurance, Bharuch DO');

  // Fill accident date for age calculation
  const accDate = page.locator('#as-app-date, input[type="date"]').nth(1);
  if (await accDate.isVisible()) {
    await accDate.fill('2024-05-15');
  }

  await smoothHover('#v-model', 1200);
  await smoothHover('#p-idv', 1200);
  await smoothHover('#p-name', 1200);
  await page.waitForTimeout(1500);

  // --- ACT 4: ASSESSMENT GRID & AUTO DEPRECIATION (00:28 - 00:44) ---
  console.log('[00:28] Navigating to Assessment Grid...');
  await smoothClick('button:has-text("Assessment")');
  await page.waitForTimeout(1500);

  // Add Tata Nexon claim parts
  console.log('[00:30] Adding Part Rows from DTC Proforma Invoice...');
  const addPartBtn = page.locator('button:has-text("Part Row"), button:has-text("Add Part")').first();
  if (await addPartBtn.isVisible()) {
    await addPartBtn.click();
    await page.waitForTimeout(400);
    await addPartBtn.click();
    await page.waitForTimeout(400);
    await addPartBtn.click();
    await page.waitForTimeout(400);
    await addPartBtn.click();
    await page.waitForTimeout(600);
  }

  // Populate first few rows
  const partInputs = page.locator('input[placeholder*="part"], input[placeholder*="description"], td input[type="text"]');
  const count = await partInputs.count();
  if (count >= 4) {
    await partInputs.nth(0).fill('FRONT BUMPER ASSLY');
    await partInputs.nth(1).fill('FRONT GRILLE RADIATOR');
    await partInputs.nth(2).fill('HOOD / BONNET PANEL');
    await partInputs.nth(3).fill('HEADLAMP UNIT RH');
  }

  await page.waitForTimeout(1000);
  await smoothHover('button:has-text("UIIC Portal")', 2000);

  // Click UIIC Portal modal preview
  console.log('[00:36] Showing UIIC Portal summary dialog...');
  await smoothClick('button:has-text("UIIC Portal")', 2500);

  // Close UIIC dialog if opened
  const closeBtn = page.locator('button:has-text("Close"), [aria-label="Close"]').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(1000);
  }

  // --- ACT 5: BILL CHECK TAB (00:44 - 00:52) ---
  console.log('[00:44] Navigating to Bill Check Tab...');
  await smoothClick('button:has-text("Bill Check")');
  await page.waitForTimeout(2500);
  await smoothHover('text=Bill', 1500);

  // --- ACT 6: REPORT CENTER & DELIVERABLES (00:52 - 00:58) ---
  console.log('[00:52] Navigating to Report Center...');
  await smoothClick('button:has-text("Report Center")');
  await page.waitForTimeout(2500);
  await smoothHover('text=Report', 1500);

  // --- ACT 7: PHOTO SHEET (00:58 - 01:04) ---
  console.log('[00:58] Navigating to Photo Sheet...');
  await smoothClick('button:has-text("Photo Sheet")');
  await page.waitForTimeout(2500);
  await smoothHover('text=Photo', 1500);

  console.log('[01:04] Finishing recording session...');
  await page.waitForTimeout(2000);

  const video = page.video();
  const videoPath = await video.path();
  console.log('Video recording path:', videoPath);

  await context.close();
  await browser.close();

  const finalWebm = path.join(OUT_DIR, 'tata_nexon_production_demo.webm');
  if (fs.existsSync(videoPath)) {
    fs.copyFileSync(videoPath, finalWebm);
    console.log(`Saved final webm: ${finalWebm} (${fs.statSync(finalWebm).size} bytes)`);
  }
}

run().catch(console.error);
