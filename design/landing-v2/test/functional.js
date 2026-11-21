const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require(path.join(
  'C:', 'Users', 'Manasi', 'OneDrive', 'Desktop',
  'Antigravity Surveyor V6 fixed', 'SurveyOS-Prime-V2', 'node_modules', 'puppeteer'
));

const FILE = pathToFileURL(path.join(__dirname, 'landing-rev-b.html')).href;
let fails = 0;
const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected);
  if (!ok) fails++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + label +
    (ok ? '  = ' + actual : '  expected ' + expected + ', got ' + actual));
};

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(FILE, { waitUntil: 'networkidle0' });

  console.log('\n--- depreciation engine ---');
  const calc = async (part, age, est) => page.evaluate(async (p, a, e) => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('part', p); set('age', a); set('est', e);
    return {
      rate: document.getElementById('rRate').textContent,
      dep:  document.getElementById('rDep').textContent,
      net:  document.getElementById('rNet').textContent,
      tot:  document.getElementById('rTot').textContent,
      why:  document.getElementById('rWhy').textContent,
    };
  }, part, age, est);

  let r = await calc('metal', '2', '18500');
  check('metal / 1-2yr rate', r.rate, '10%');
  check('metal / 1-2yr dep',  r.dep,  '−₹1,850');
  check('metal / 1-2yr net',  r.net,  '₹16,650');
  check('metal / 1-2yr total', r.tot, '₹19,647');

  r = await calc('plastic', '2', '18500');
  check('plastic fixed rate', r.rate, '50%');

  r = await calc('glass', '7', '18500');
  check('glass nil dep', r.rate, '0%');
  check('glass net = estimate', r.net, '₹18,500');

  r = await calc('metal', '7', '10000');
  check('metal / >10yr rate', r.rate, '50%');
  check('metal / >10yr total', r.tot, '₹5,900');

  r = await calc('metal', '0', '5000');
  check('metal / <6mo nil dep', r.rate, '0%');

  console.log('\n--- extraction animation ---');
  await page.evaluate(() => document.getElementById('extract').scrollIntoView());
  await new Promise(r => setTimeout(r, 4500));
  const ex = await page.evaluate(() => ({
    count: document.getElementById('exCount').textContent,
    filled: [...document.querySelectorAll('#extract .fval')].filter(f => f.textContent.trim().length).length,
    chassis: [...document.querySelectorAll('#extract .fval')][1].textContent,
    carets: document.querySelectorAll('#extract .caret').length,
  }));
  check('all 6 fields typed', ex.filled, 6);
  check('counter finished', ex.count, '6 / 6');
  check('chassis value correct', ex.chassis, 'MA3EYD32S00123456');
  check('no caret left behind', ex.carets, 0);

  console.log('\n--- stamp ---');
  await page.evaluate(() => document.getElementById('recon').scrollIntoView());
  await new Promise(r => setTimeout(r, 1200));
  const st = await page.evaluate(() => {
    const s = document.getElementById('stamp');
    return { landed: s.classList.contains('is-in'), opacity: getComputedStyle(s).opacity };
  });
  check('stamp landed', st.landed, 'true');
  check('stamp visible', Math.round(parseFloat(st.opacity)), 1);

  console.log('\n--- reveals ---');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 900));
  const rev = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.reveal')];
    return { total: all.length, hidden: all.filter(e => !e.classList.contains('is-in')).length };
  });
  check('all reveals fired', rev.hidden, 0);
  console.log('       (' + rev.total + ' reveal blocks)');

  console.log('--- deep link straight to #price (the real jump case) ---');
  const p4 = await browser.newPage();
  await p4.setViewport({ width: 1440, height: 900 });
  await p4.goto(FILE + '#price', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  const deep = await p4.evaluate(() => ({
    hidden: [...document.querySelectorAll('.reveal')].filter(e => getComputedStyle(e).opacity !== '1').length,
    aboveHidden: [...document.querySelectorAll('.reveal')]
      .filter(e => e.getBoundingClientRect().bottom < 0)
      .filter(e => getComputedStyle(e).opacity !== '1').length,
    extractFilled: [...document.querySelectorAll('#extract .fval')].filter(f => f.textContent.trim().length).length,
    stampLanded: document.getElementById('stamp').classList.contains('is-in'),
  }));
  check('deep link: nothing above stays hidden', deep.aboveHidden, 0);
  check('deep link: extraction still filled', deep.extractFilled, 6);
  check('deep link: stamp still landed', deep.stampLanded, 'true');
  await p4.close();

  console.log('\n--- nav sheet (mobile) ---');
  await page.setViewport({ width: 375, height: 812 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 300));
  await page.click('#navBtn');
  await new Promise(r => setTimeout(r, 400));
  let nav = await page.evaluate(() => ({
    open: document.getElementById('navSheet').dataset.open,
    aria: document.getElementById('navBtn').getAttribute('aria-expanded'),
    vis:  getComputedStyle(document.getElementById('navSheet')).visibility,
  }));
  check('sheet opens', nav.open, 'true');
  check('aria-expanded true', nav.aria, 'true');
  check('sheet visible', nav.vis, 'visible');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 400));
  nav = await page.evaluate(() => ({
    open: document.getElementById('navSheet').dataset.open,
    aria: document.getElementById('navBtn').getAttribute('aria-expanded'),
  }));
  check('Escape closes sheet', nav.open, 'false');
  check('aria-expanded reset', nav.aria, 'false');

  console.log('\n--- reduced motion ---');
  const p2 = await browser.newPage();
  await p2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p2.setViewport({ width: 1440, height: 900 });
  await p2.goto(FILE, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  const rm = await p2.evaluate(() => ({
    revealsHidden: [...document.querySelectorAll('.reveal')].filter(e => getComputedStyle(e).opacity !== '1').length,
    fieldsFilled: [...document.querySelectorAll('#extract .fval')].filter(f => f.textContent.trim().length).length,
    stampVisible: getComputedStyle(document.getElementById('stamp')).opacity,
    pinsVisible: [...document.querySelectorAll('.pin')].filter(p => getComputedStyle(p).opacity === '1').length,
  }));
  check('reduced: nothing hidden', rm.revealsHidden, 0);
  check('reduced: fields filled instantly', rm.fieldsFilled, 6);
  check('reduced: stamp visible', Math.round(parseFloat(rm.stampVisible)), 1);
  check('reduced: all 3 pins visible', rm.pinsVisible, 3);

  console.log('\n--- no-JS fallback ---');
  const p3 = await browser.newPage();
  await p3.setJavaScriptEnabled(false);
  await p3.setViewport({ width: 1440, height: 900 });
  await p3.goto(FILE, { waitUntil: 'networkidle0' });
  const nj = await p3.evaluate(() => 1).catch(() => null);
  const nojs = await p3.$$eval('.reveal', els =>
    els.filter(e => getComputedStyle(e).opacity !== '1').length);
  const nojsPins = await p3.$$eval('.pin', els =>
    els.filter(e => getComputedStyle(e).opacity !== '1').length);
  check('no-JS: all content visible', nojs, 0);
  check('no-JS: pins visible', nojsPins, 0);

  console.log('\n--- page errors ---');
  check('no uncaught errors', errs.length, 0);
  if (errs.length) console.log('   ', errs);

  await browser.close();
  console.log('\n' + (fails ? '*** ' + fails + ' check(s) failed ***' : 'all functional checks passed'));
  process.exit(fails ? 1 : 0);
})();
