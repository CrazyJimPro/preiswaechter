// M4: Benachrichtigungen, Zahl am Symbol, Einstellungsseite, Sicherung + Wiederherstellung.
import { startShop, sleep } from './lib.mjs';

export const title = 'Benachrichtigungen und Einstellungen';

export default async function (t) {
  const { ok } = t;
  const state = { price: 95, stock: 'InStock' };
  const shop = await startShop({
    '/p.html': () => `<!doctype html><html><head><title>P</title>
      <script type="application/ld+json">{"@type":"Product","name":"Monitor 27 Zoll","offers":{"price":"${state.price}","priceCurrency":"EUR","availability":"https://schema.org/${state.stock}"}}</script>
      </head><body><h1>Monitor 27 Zoll</h1></body></html>`,
  });
  try {
    const kinds = async () => Object.keys(await t.call('return API.notifications.getAll()')).map((id) => id.split('|')[2]).sort();
    const badge = () => t.call('return API.action.getBadgeText({})');

    const added = await t.send({ type: 'addProduct', data: { url: `${shop.base}/p.html`, name: 'Monitor 27 Zoll', price: 100, currency: 'EUR', stockStatus: 'out_of_stock' } });
    const id = added.product.id;
    await t.patchProduct(id, { targetPrice: 80, dropThreshold: 10 });

    console.log('Benachrichtigungen');
    await t.send({ type: 'checkNow', id });
    await sleep(300);
    ok(JSON.stringify(await kinds()) === '["stock"]', `100 → 95 (−5 %, Schwelle 10 %) + wieder lieferbar → nur „stock“ (${await kinds()})`);
    ok((await badge()) === '1', `Zahl am Symbol: 1 (${await badge()})`);

    state.price = 85;
    await t.send({ type: 'checkNow', id });
    await sleep(300);
    ok((await kinds()).includes('drop'), '95 → 85 (−10,5 %) → „drop“');

    state.price = 79;
    await t.send({ type: 'checkNow', id });
    await sleep(300);
    ok((await kinds()).includes('target'), '85 → 79 unter Ziel 80 → „target“');
    ok((await badge()) === '1', 'weiterhin 1 Produkt am Symbol');

    console.log('Popup markiert neue Senkung und setzt die Zahl zurück');
    const pop = await t.openExtPage('popup/popup.html?m4');
    await pop.waitForSelector('.plist li', { timeout: 10000 });
    await sleep(500);
    ok(await pop.evaluate(() => document.querySelector('.plist li').classList.contains('fresh')), 'Zeile als „neu“ markiert');
    ok((await badge()) === '', `Zahl am Symbol gelöscht („${await badge()}“)`);
    ok(await pop.evaluate(() => !!document.getElementById('open-options')), '⚙ Link zu den Einstellungen');
    await t.shot(pop, 'popup-neu');
    await pop.close();

    console.log('Einstellungsseite');
    const opt = await t.openExtPage('options/options.html');
    const optErrors = [];
    opt.on('pageerror', (e) => optErrors.push(e.message));
    await opt.waitForSelector('#interval option', { timeout: 10000 });
    ok((await opt.evaluate(() => document.getElementById('ff-hint').hidden)) === (t.which !== 'firefox'), 'Firefox-Hinweis nur in Firefox');
    await opt.evaluate(() => document.getElementById('notifications').click());
    await sleep(300);
    ok((await t.storage()).settings.notifications === false, 'Benachrichtigungen ausgeschaltet');
    const before = (await kinds()).length;
    state.price = 60;
    await t.send({ type: 'checkNow', id });
    await sleep(300);
    ok((await kinds()).length === before, 'ausgeschaltet → keine neue Meldung bei 79 → 60');
    await opt.evaluate(() => document.getElementById('notifications').click());
    await opt.evaluate(() => document.getElementById('test-notification').click());
    await sleep(500);
    ok((await kinds()).includes('test'), 'Testbenachrichtigung');
    await opt.evaluate(() => { const s = document.getElementById('interval'); s.value = '360'; s.dispatchEvent(new Event('change')); });
    await sleep(200);
    await opt.evaluate(() => document.getElementById('apply-all').click());
    await sleep(500);
    ok((await t.storage()).settings.defaultIntervalMin === 360 && (await t.product(id)).p.intervalMin === 360, 'Intervall 6 Std. für neue + alle Produkte');
    await t.shot(opt, 'einstellungen', { fullPage: true });

    console.log('Sicherung herunterladen und einspielen');
    const exported = await opt.evaluate(async () => {
      let blob = null;
      const orig = URL.createObjectURL;
      URL.createObjectURL = (b) => { blob = b; return orig.call(URL, b); };
      HTMLAnchorElement.prototype.click = function () {}; // Download im Test nicht auslösen
      document.getElementById('export').click();
      for (let i = 0; i < 40 && !blob; i++) await new Promise((r) => setTimeout(r, 50));
      return blob ? blob.text() : null;
    });
    const backup = JSON.parse(exported);
    const histLen = (await t.product(id)).hist.length;
    ok(backup.app === 'preiswaechter' && backup.products.length === 1 && backup.products[0].history.length === histLen, `Sicherung mit 1 Produkt und ${histLen} Verlaufspunkten`);

    // alles löschen, dann einspielen
    await t.call('return API.storage.local.get(null).then(all => API.storage.local.remove(Object.keys(all).filter(k => k.startsWith("product:") || k.startsWith("history:")))).then(() => API.storage.local.set({productIds: []}))');
    await opt.evaluate((json) => {
      const input = document.getElementById('import-file');
      const dt = new DataTransfer();
      dt.items.add(new File([json], 'sicherung.json', { type: 'application/json' }));
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }, exported);
    await opt.waitForFunction(() => !document.getElementById('import-plan').hidden, { timeout: 5000 });
    const summary = await opt.evaluate(() => document.getElementById('import-summary').textContent);
    ok(summary.includes('1 neues Produkt'), `Vorschau: ${summary.slice(0, 60)} …`);
    await opt.evaluate(() => document.getElementById('import-go').click());
    await opt.waitForFunction(() => !document.getElementById('import-result').hidden, { timeout: 5000 });
    const restored = await t.product(id);
    ok(restored.p && restored.hist.length === histLen && restored.p.targetPrice === 80, 'Produkt, Verlauf und Zielpreis wiederhergestellt');
    // dieselbe Sicherung erneut → nichts zu tun
    await opt.evaluate((json) => {
      const input = document.getElementById('import-file');
      const dt = new DataTransfer();
      dt.items.add(new File([json], 'sicherung.json'));
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }, exported);
    await sleep(500);
    ok((await opt.evaluate(() => document.getElementById('import-summary').textContent)).includes('schon vorhanden'), 'zweiter Import: nichts doppelt');
    await opt.evaluate(() => {
      const input = document.getElementById('import-file');
      const dt = new DataTransfer();
      dt.items.add(new File(['{"foo":1}'], 'falsch.json'));
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    });
    await sleep(500);
    ok((await opt.evaluate(() => document.getElementById('import-result').textContent)).includes('keine Preiswächter-Sicherung'), 'fremde Datei abgelehnt');
    ok(optErrors.length === 0, `keine Skriptfehler (${optErrors.join('; ')})`);
  } finally {
    shop.close();
  }
}
