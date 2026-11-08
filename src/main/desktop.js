// Ein AppImage bringt keinen Eintrag im Startmenü mit. Die App legt ihn beim Start selbst an
// und zieht den Pfad nach, falls die Datei verschoben wurde.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataHome = () => process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
const entryFile = () => path.join(dataHome(), 'applications', 'preiswaechter.desktop');
const iconFile = () => path.join(dataHome(), 'icons', 'hicolor', '512x512', 'apps', 'preiswaechter.png');
const ICON_SRC = fileURLToPath(new URL('../../assets/icon.png', import.meta.url));

export const canIntegrate = () => process.platform === 'linux' && !!process.env.APPIMAGE;

export function installMenuEntry() {
  if (!canIntegrate()) return false;
  try {
    const exec = process.env.APPIMAGE.replace(/(["`$\\])/g, '\\$1');
    fs.mkdirSync(path.dirname(entryFile()), { recursive: true });
    fs.mkdirSync(path.dirname(iconFile()), { recursive: true });
    fs.writeFileSync(iconFile(), fs.readFileSync(ICON_SRC));
    const text = [
      '[Desktop Entry]',
      'Type=Application',
      'Name=Preiswächter',
      'Comment=Produktpreise verfolgen',
      `Exec="${exec}" %U`,
      'Icon=preiswaechter',
      'Terminal=false',
      'Categories=Utility;',
      'Keywords=Preis;Preisverlauf;Shop;',
      'StartupWMClass=preiswaechter',
      '',
    ].join('\n');
    const same = fs.existsSync(entryFile()) && fs.readFileSync(entryFile(), 'utf8') === text;
    if (!same) fs.writeFileSync(entryFile(), text);
    return true;
  } catch (err) {
    console.error('Eintrag im Startmenü konnte nicht angelegt werden:', err);
    return false;
  }
}

export function removeMenuEntry() {
  fs.rmSync(entryFile(), { force: true });
  fs.rmSync(iconFile(), { force: true });
}
