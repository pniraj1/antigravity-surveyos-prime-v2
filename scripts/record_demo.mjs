import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.resolve('recordings');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  console.log('Launching Chromium with video recording...');
  const browser = await chromium.launch({
    headless: true, // runs in background
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: OUT_DIR,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  // Inject visual cursor and click animations
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const cursor = document.createElement('div');
      cursor.id = 'demo-cursor';
      cursor.style.cssText = `
        width: 24px;
        height: 24px;
        background: rgba(220, 38, 38, 0.85);
        border: 2px solid white;
        border-radius: 50%;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 999999;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: transform 0.15s ease-out, background 0.15s;
        transform: translate(-50%, -50%);
      `;
      document.body.appendChild(cursor);

      window.addEventListener('mousemove', (e) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
      });

      window.addEventListener('mousedown', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(0.75)';
        cursor.style.background = 'rgba(16, 185, 129, 0.9)'; // emerald click
      });

      window.addEventListener('mouseup', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        cursor.style.background = 'rgba(220, 38, 38, 0.85)';
      });
    });
  });

  console.log('Navigating to live SurveyOS Sandbox...');
  await page.goto('https://motorsurveyos-in.web.app/?sandbox=true', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  await page.waitForTimeout(2000);

  // Apply privacy blur on any phone or bank inputs
  await page.addStyleTag({
    content: `
      input[type="tel"], input[name*="phone"], input[name*="mobile"], input[name*="bank"] {
        filter: blur(5px) !important;
      }
    `,
  });

  console.log('Navigating through claim tabs...');

  // Helper for smooth mouse movements
  async function smoothMove(selector, delay = 800) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible()) {
        const box = await el.boundingBox();
        if (box) {
          const targetX = box.x + box.width / 2;
          const targetY = box.y + box.height / 2;
          await page.mouse.move(targetX, targetY, { steps: 20 });
          await page.waitForTimeout(delay);
          await el.click();
          await page.waitForTimeout(1000);
          return true;
        }
      }
    } catch (e) {
      console.warn(`Could not click ${selector}:`, e.message);
    }
    return false;
  }

  // 1. Details Tab
  console.log('Showing Details Tab...');
  await smoothMove('button:has-text("Claim Details")');
  await page.waitForTimeout(2000);

  // 2. Assessment Tab
  console.log('Showing Assessment Tab...');
  await smoothMove('button:has-text("Assessment")');
  await page.waitForTimeout(3000);

  // 3. Bill Check Tab
  console.log('Showing Bill Check Tab...');
  await smoothMove('button:has-text("Bill Check")');
  await page.waitForTimeout(2500);

  // 4. Report Center
  console.log('Showing Report Center...');
  await smoothMove('button:has-text("Report Center")');
  await page.waitForTimeout(3000);

  // 5. Photo Sheet Tab
  console.log('Showing Photo Sheet Tab...');
  await smoothMove('button:has-text("Photo Sheet")');
  await page.waitForTimeout(2500);

  console.log('Finishing recording...');
  await page.waitForTimeout(1000);

  const video = page.video();
  await context.close();
  await browser.close();

  if (video) {
    const videoPath = await video.path();
    console.log(`Video recorded successfully to: ${videoPath}`);
  }
}

run().catch((err) => {
  console.error('Recording error:', err);
  process.exit(1);
});
