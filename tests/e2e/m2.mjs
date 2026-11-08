// M2: Produkt per Popup anlegen, Abruf, Hintergrund-Tab, Besuch, Fehler, Alarm.
import { startShop, sleep } from './lib.mjs';

export const title = 'Hintergrundprüfung';

export default async function (t) {
  const state = { dyn: 549, js: 77.77 };
  const shop = await startShop({
    '/dyn.html': () => `<!doctype html><html><head><title>Dyn</title>
      <script type="application/ld+json">{"@type":"Product","name":"Testprodukt Dyn","offers":{"price":"${state.dyn}","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}</script>
      </head><body><h1>Testprodukt Dyn</h1></body></html>`,
    '/js.html': () => `<!doctype html><html><head><title>JS-Shop</title></head><body><h1>JS-Produkt</h1>
      <div class="product-price" id="p"></div>
      <script>setTimeout(()=>{document.getElementById('p').textContent='${String(state.js).replace('.', ',')} €'},800)</script>
      </body></html>`,
    '/gone.html': () => ({ status: 404, body: 'weg' }),
  });
  const { ok } = t;
  try {
    async function addViaPopup(file, waitMs = 0) {
      const page = await t.browser.newPage();
      await page.goto(`${shop.base}/${file}?utm_source=popup`);
      await page.bringToFront();
      await sleep(waitMs);
      const popup = await t.openExtPage('popup/popup.html', { active: false });
      await sleep(1500); // Analyse läuft, solange die Shopseite aktiv ist
      await t.activate(popup);
      await popup.waitForSelector('#track', { timeout: 15000 });
      await t.click(popup, '#track');
      await popup.waitForFunction(() => document.querySelector('#current .hint')?.textContent.includes('bereits verfolgt'), { timeout: 15000 });
      await popup.close();
      await page.close();
    }

    console.log('1) Produkt per Popup anlegen');
    await addViaPopup('dyn.html');
    let { p } = await t.product('dyn.html');
    ok(p && p.currentPrice === 549 && !p.url.includes('utm_'), `dyn.html mit 549 und ohne Tracking-Parameter gespeichert (${p && p.url})`);

    console.log('2) „Jetzt prüfen“ per Abruf');
    state.dyn = 444;
    const r = await t.send({ type: 'checkNow', id: p.id });
    let hist;
    ({ p, hist } = await t.product('dyn.html'));
    ok(r && r.ok && p.currentPrice === 444 && p.lastVia === 'abruf', `444 über Abruf (via ${p.lastVia})`);
    ok(p.previousPrice === 549 && hist.length === 2, 'vorheriger Preis gemerkt, 2 Verlaufspunkte');

    console.log('3) JS-Seite → Hintergrund-Tab');
    await addViaPopup('js.html', 1500);
    let js = (await t.product('js.html')).p;
    ok(js && js.currentPrice === 77.77, `js.html mit 77,77 gespeichert (${js && js.currentPrice})`);
    state.js = 66.66;
    await t.send({ type: 'checkNow', id: js.id });
    js = (await t.product('js.html')).p;
    ok(js.currentPrice === 66.66 && js.lastVia === 'tab', `66,66 über Hintergrund-Tab (via ${js.lastVia}, Fehler ${js.lastError})`);
    const open = (await Promise.all((await t.browser.pages()).map(t.realUrl))).filter((u) => u.includes('js.html')).length;
    ok(open === 0, 'Hintergrund-Tab wieder geschlossen');

    console.log('4) Besuch der Produktseite');
    state.dyn = 333;
    await t.patchProduct(p.id, { lastChecked: 0 });
    const visit = await t.browser.newPage();
    await visit.goto(`${shop.base}/dyn.html?utm_source=newsletter`);
    await visit.bringToFront();
    let seen = false;
    for (let i = 0; i < 20 && !seen; i++) { await sleep(500); seen = (await t.product('dyn.html')).p.currentPrice === 333; }
    ({ p } = await t.product('dyn.html'));
    ok(seen && p.lastVia === 'besuch', `333 beim Besuch übernommen (via ${p.lastVia})`);
    await visit.close();

    console.log('5) Seite gelöscht (404)');
    const added = await t.send({ type: 'addProduct', data: { url: `${shop.base}/gone.html`, name: 'Weg', price: 10, currency: 'EUR', stockStatus: 'in_stock' } });
    await t.send({ type: 'checkNow', id: added.product.id });
    const gone = (await t.product('gone.html')).p;
    ok(gone.lastError && gone.lastError.includes('404') && gone.currentPrice === 10, `Fehler gemerkt, Preis bleibt (${gone.lastError})`);
    ok(gone.nextCheck - Date.now() <= 5 * 60e3 + 1000, 'erneuter Versuch in ≤ 5 Min.');

    console.log('6) Alarm prüft fällige Produkte selbst (bis 90 s)');
    state.dyn = 222;
    await t.patchProduct(p.id, { nextCheck: 0 });
    const t0 = Date.now();
    let auto = false;
    for (let i = 0; i < 90 && !auto; i++) { await sleep(1000); auto = (await t.product('dyn.html')).p.currentPrice === 222; }
    ({ p, hist } = await t.product('dyn.html'));
    ok(auto && p.lastVia === 'abruf', `222 automatisch nach ${Math.round((Date.now() - t0) / 1000)} s`);
    ok(p.nextCheck > Date.now() + 50 * 60e3, 'nächste Prüfung in ~1 Std.');
    console.log('  Verlauf:', hist.map((x) => x.price).join(' → '));
  } finally {
    shop.close();
  }
}
