// Browsertests ausführen: node run.mjs [chrome|firefox|all] [m2 m3 m4 …]
import { setup } from './lib.mjs';

const args = process.argv.slice(2);
const which = ['chrome', 'firefox', 'all'].includes(args[0]) ? args.shift() : 'all';
const browsers = which === 'all' ? ['chrome', 'firefox'] : [which];
const names = args.length ? args : ['m2', 'm3', 'm4'];

const results = [];
for (const b of browsers) {
  for (const n of names) {
    const mod = await import(`./${n}.mjs`);
    console.log(`\n=== ${b}: ${mod.title} ===`);
    let t;
    try {
      t = await setup(b);
      await mod.default(t);
    } catch (e) {
      if (t) t.errors.push('Abbruch: ' + (e && e.stack || e));
      else results.push({ b, n, errors: ['Start fehlgeschlagen: ' + e] });
    } finally {
      if (t) {
        await t.close();
        results.push({ b, n, errors: t.errors });
      }
    }
  }
}
console.log('\n=== Ergebnis ===');
for (const r of results) {
  console.log(`${r.errors.length ? '✗' : '✓'} ${r.b} ${r.n}${r.errors.length ? ': ' + r.errors.join(' | ').slice(0, 400) : ''}`);
}
process.exit(results.some((r) => r.errors.length) ? 1 : 0);
