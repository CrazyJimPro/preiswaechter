// Einfaches Logbuch: schreibt alles zusätzlich in eine Datei
// (Linux: ~/.config/Preiswaechter/logs/preiswaechter.log,
//  Windows: %APPDATA%\Preiswaechter\logs\preiswaechter.log)
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';

const MAX_BYTES = 1024 * 1024;
let file = null;

function write(level, args) {
  if (!file) return;
  try {
    fs.appendFileSync(file, `${new Date().toISOString()} [${level}] ${util.format(...args)}\n`);
  } catch { /* Logbuch darf nie stören */ }
}

export function initLog() {
  const dir = path.join(app.getPath('userData'), 'logs');
  try {
    fs.mkdirSync(dir, { recursive: true });
    file = path.join(dir, 'preiswaechter.log');
    if (fs.existsSync(file) && fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, `${file}.1`);
  } catch {
    file = null;
  }
  for (const level of ['log', 'info', 'warn', 'error']) {
    const orig = console[level].bind(console);
    console[level] = (...args) => { orig(...args); write(level.toUpperCase(), args); };
  }
  process.on('uncaughtException', (err) => console.error('Unerwarteter Fehler:', err));
  process.on('unhandledRejection', (err) => console.error('Unbehandelter Fehler:', err));
  console.info(`Preiswächter ${app.getVersion()} gestartet (Electron ${process.versions.electron}, ${process.platform})`);
}
