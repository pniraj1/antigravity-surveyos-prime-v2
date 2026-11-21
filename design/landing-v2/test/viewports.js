const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require(path.join(
  'C:', 'Users', 'Manasi', 'OneDrive', 'Desktop',
  'Antigravity Surveyor V6 fixed', 'SurveyOS-Prime-V2', 'node_modules', 'puppeteer'
));

const FILE = pathToFileURL(path.join(__dirname, process.argv[2])).href;

const VIEWPORTS = [
  { w: 1440, h: 900,  n: 'desktop' },
  { w: 768,  h: 1024, n: 'tablet'  },
  { w: 375,  h: 812,  n: 'mobile'  },
];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files'] });
  let failures = 0;

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

    await page.setViewport({ width: vp.w, height: vp.h });
    await page.goto(FILE, { waitUntil: 'networkidle0' });

    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const sel = '.btn,.nav__link,.footer__links a,.nav__toggle,.field select,.field input';
      const targets = [...document.querySelectorAll(sel)]
        .filter(e => !e.classList.contains('btn--quiet'))
        .filter(e => e.getBoundingClientRect().height > 0);
      const small = targets
        .filter(e => e.getBoundingClientRect().height < 44)
        .map(e => String(e.className).slice(0, 44) + ' -> ' + Math.round(e.getBoundingClientRect().height) + 'px');

      const wide = [...document.querySelectorAll('body *')]
        .filter(e => e.getBoundingClientRect().width > de.clientWidth + 1)
        .filter(e => getComputedStyle(e).overflowX !== 'auto')
        .slice(0, 5)
        .map(e => e.tagName + '.' + String(e.className).slice(0, 30));

      return {
        overflowX: de.scrollWidth - de.clientWidth,
        wide,
        targetCount: targets.length,
        small,
        bodyFont: parseFloat(getComputedStyle(document.body).fontSize),
        displayFont: getComputedStyle(document.querySelector('.display')).fontFamily.split(',')[0],
        audit: [...document.querySelectorAll('.audit-row')]
          .map(row => row.children[2].textContent.toUpperCase().padEnd(5) + row.children[0].textContent),
        navSheet: (function(){
          const cs = getComputedStyle(document.getElementById('navSheet'));
          const h  = document.getElementById('navSheet').getBoundingClientRect().height;
          return 'display:' + cs.display + ' visibility:' + cs.visibility + ' height:' + Math.round(h);
        })(),
      };
    });

    const ok = {
      overflow: r.overflowX <= 1,
      targets:  r.small.length === 0,
      font:     r.bodyFont >= 16,
      console:  errs.length === 0,
    };
    if (Object.values(ok).some(v => !v)) failures++;

    console.log('\n=== ' + vp.n + '  ' + vp.w + 'x' + vp.h + ' ===');
    console.log('  h-overflow  : ' + r.overflowX + 'px ' + (ok.overflow ? 'OK' : '*** FAIL *** wide: ' + r.wide.join(', ')));
    console.log('  tap targets : ' + r.targetCount + ' checked, ' + (ok.targets ? 'all >=44px OK' : '*** FAIL *** ' + r.small.join(' | ')));
    console.log('  body font   : ' + r.bodyFont + 'px ' + (ok.font ? 'OK' : '*** FAIL ***'));
    console.log('  display font: ' + r.displayFont);
    console.log('  nav sheet   : ' + r.navSheet);
    console.log('  console     : ' + (ok.console ? 'clean' : '*** ' + errs.join(' | ')));
    r.audit.forEach(a => console.log('   ' + a));

    await page.close();
  }

  await browser.close();
  console.log('\n' + (failures ? '*** ' + failures + ' viewport(s) with failures ***' : 'all viewports clean'));
  process.exit(failures ? 1 : 0);
})();
