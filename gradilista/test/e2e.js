/*
 * Automatski test cijelog tijeka u pravom pregledniku:
 * voditelj na računalu + radnik na mobitelu, QR prijava, fotografije, status, uklanjanje uređaja.
 *
 * Test očekuje PRAZNU bazu (prvo postavljanje). Pokretanje iz mape gradilista/:
 *   1. npm install --no-save playwright && npx playwright install chromium   (samo prvi put)
 *   2. u jednom prozoru (prazna testna baza):
 *        DB_FILE=test/tmp/test.db UPLOAD_DIR=test/tmp/uploads SETUP_CODE=test123 PORT=3100 npm start
 *   3. u drugom prozoru:  node test/e2e.js
 *   Snimke ekrana spremaju se u test/shots/. Prije ponovnog pokretanja obriši test/tmp/.
 */
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const SETUP_CODE = process.env.SETUP_CODE || 'test123';
const SHOTS = path.join(__dirname, 'shots') + path.sep;
const IMG = path.join(__dirname, '..', '..', 'assets', 'radovi') + path.sep;
fs.mkdirSync(SHOTS, { recursive: true });
const errors = [];
const watch = (page, who) => {
  page.on('pageerror', e => errors.push(`${who} pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${who} console: ${m.text()}`); });
};
(async () => {
  const browser = await chromium.launch();
  // ----- Voditelj na računalu -----
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'hr-HR' });
  const a = await adminCtx.newPage(); watch(a, 'admin');
  await a.goto(BASE);
  await a.fill('input[name=name]', 'Marko Ecoterm');
  await a.fill('input[name=code]', 'krivo');
  await a.click('text=Započni');
  await a.waitForSelector('.error:not([hidden])');
  console.log('wrong code error:', await a.textContent('.error'));
  await a.fill('input[name=code]', SETUP_CODE);
  await a.click('text=Započni');
  await a.waitForSelector('#list');

  const sites = [
    ['Kuća Horvat – Samobor', 'Perkovčeva 12, Samobor', 'Ivan Horvat', '091 234 5678', 'Dizalica topline zrak-voda 9 kW + podno grijanje prizemlje', 'u_tijeku'],
    ['Stambena zgrada Trešnjevka', 'Ozaljska 88, Zagreb', 'Upravitelj Zgrada d.o.o.', '01 555 1234', '', 'priprema'],
    ['Vikendica Kovač – Krk', 'Malinska', 'Ana Kovač', '', '', 'zavrseno'],
  ];
  for (const s of sites) {
    await a.click('#newSite');
    const f = a.locator('#siteForm');
    await f.locator('[name=name]').fill(s[0]);
    await f.locator('[name=address]').fill(s[1]);
    await f.locator('[name=clientName]').fill(s[2]);
    await f.locator('[name=clientPhone]').fill(s[3]);
    await f.locator('[name=note]').fill(s[4]);
    await f.locator(`input[value=${s[5]}]`).check({ force: true });
    await f.locator('button:has-text("Spremi")').click();
    await a.waitForSelector('#chatHead b');
    await a.waitForTimeout(300);
  }
  // Kuća Horvat: poruke i slike
  await a.click('.site-item:has-text("Kuća Horvat")');
  await a.waitForSelector('.sys');
  await a.fill('#text', 'Dovezena vanjska jedinica, sutra montaža na konzolu.');
  await a.keyboard.press('Enter');
  await a.waitForSelector('.msg.me .text');
  await a.setInputFiles('#pickGallery', [IMG + 'rad-01.jpg', IMG + 'rad-02.jpg']);
  await a.fill('#text', 'Razvod podnog grijanja – prizemlje gotovo');
  await a.click('#sendBtn');
  await a.waitForFunction(() => document.querySelectorAll('.msg .photo').length === 2, null, { timeout: 15000 });
  await a.waitForSelector('#sending', { state: 'hidden' });

  // Pozivnica za radnika
  await a.goto(BASE + '/#/ljudi');
  await a.waitForSelector('#addPerson');
  await a.click('#addPerson');
  await a.fill('#inviteForm [name=name]', 'Josip Radnik');
  await a.click('text=Napravi QR kod');
  await a.waitForSelector('.qr svg');
  await a.screenshot({ path: SHOTS + '04-qr-pozivnica.png' });
  const url = await a.inputValue('.link-box input');
  console.log('invite url', url);
  await a.click('[data-done]');

  // ----- Radnik na mobitelu -----
  const mobCtx = await browser.newContext({ ...devices['Pixel 7'], locale: 'hr-HR' });
  const m = await mobCtx.newPage(); watch(m, 'radnik');
  await m.goto(BASE);
  await m.waitForSelector('text=Ovaj uređaj nije prijavljen');
  await m.screenshot({ path: SHOTS + '05-mob-nije-prijavljen.png' });
  await m.goto(url);
  await m.waitForSelector('#inviteForm');
  await m.screenshot({ path: SHOTS + '06-mob-pozivnica.png' });
  await m.click('text=Prijavi ovaj uređaj');
  await m.waitForSelector('#list .site-item');
  await m.screenshot({ path: SHOTS + '07-mob-popis.png' });
  // isti QR ne smije raditi drugi put
  const m2ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const m2 = await m2ctx.newPage();
  await m2.goto(url);
  await m2.waitForSelector('text=QR kod ne vrijedi');
  console.log('reused invite rejected: ok');
  // radnik ne vidi gumb + niti ljude
  console.log('worker has fab:', await m.locator('#newSite').count());
  const r = await m.evaluate(() => fetch('/api/people').then(r => r.status));
  console.log('worker /api/people status:', r);

  await m.click('.site-item:has-text("Kuća Horvat")');
  await m.waitForSelector('.msg .photo img');
  await m.fill('#text', 'Montirana vanjska jedinica, spojeno freonsko. Sutra tlačna proba.');
  await m.click('#sendBtn');
  await m.waitForSelector('.msg.me .text');
  await m.setInputFiles('#pickCamera', [IMG + 'rad-05.jpg']);
  await m.click('#sendBtn');
  await m.waitForFunction(() => document.querySelectorAll('.msg.me .photo').length === 1, null, { timeout: 15000 });
  await m.waitForTimeout(800);
  await m.screenshot({ path: SHOTS + '08-mob-chat.png' });
  // pregled slike
  await m.click('.msg.me .photo');
  await m.waitForSelector('.viewer img');
  await m.waitForTimeout(500);
  await m.screenshot({ path: SHOTS + '09-mob-slika.png' });
  await m.click('[data-v=close]');
  // natrag na popis
  await m.click('.back');
  await m.waitForSelector('#list .site-item');

  // ----- Voditelj vidi nove poruke (polling) -----
  await a.goto(BASE + '/#/');
  await a.waitForSelector('.site-item .badge', { timeout: 15000 });
  console.log('admin unread badge:', await a.textContent('.site-item .badge'));
  await a.screenshot({ path: SHOTS + '01-racunalo-popis.png' });
  await a.click('.site-item:has-text("Kuća Horvat")');
  await a.waitForFunction(() => document.querySelectorAll('.msg .photo').length === 3);
  await a.waitForTimeout(800);
  await a.screenshot({ path: SHOTS + '02-racunalo-chat.png' });
  // status + panel
  await a.click('#chatHead [data-act=panel] >> nth=1');
  await a.waitForSelector('.panel');
  await a.click('[data-status=zavrseno]');
  await a.waitForSelector('.sys:has-text("Završeno")', { timeout: 10000 });
  await a.waitForTimeout(500);
  await a.screenshot({ path: SHOTS + '03-racunalo-podaci.png' });
  // radnik vidi promjenu statusa u popisu
  await m.waitForSelector('.site-item:has-text("Kuća Horvat") .tag.zavrseno', { timeout: 15000 }).catch(() => {});
  await m.click('.chip[data-filter=sva]');
  await m.waitForSelector('.site-item:has-text("Kuća Horvat") .tag.zavrseno', { timeout: 15000 });
  console.log('worker sees status change: ok');

  // ljudi
  await a.goto(BASE + '/#/ljudi');
  await a.waitForSelector('.person:has-text("Josip Radnik")');
  await a.screenshot({ path: SHOTS + '10-racunalo-ljudi.png' });
  // ukloni radnikov uređaj -> radnik je odjavljen
  a.once('dialog', d => d.accept());
  await a.click('.person:has-text("Josip Radnik") [data-rm-device]');
  await a.waitForSelector('.person:has-text("Josip Radnik") >> text=Nema prijavljenih uređaja');
  await m.reload();
  await m.waitForSelector('text=Ovaj uređaj nije prijavljen');
  console.log('removed device is locked out: ok');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no browser errors');
})().catch(e => { console.error('FAIL', e); console.log(errors.join('\n')); process.exit(1); });
