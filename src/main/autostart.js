// Autostart beim Anmelden. Die Prüfung läuft nur, solange die App läuft – deshalb ist er
// beim ersten Start der installierten App an.
// Linux: Eintrag in ~/.config/autostart. Windows: Registry-Wert unter HKCU\...\Run, den
// Electron schreibt und der Deinstaller wieder entfernt (build/installer.nsh).
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const ARG = '--autostart';
const IS_WINDOWS = process.platform === 'win32';

export const startedByAutostart = () => process.argv.includes(ARG);

const linuxFile = () => path.join(app.getPath('appData'), 'autostart', 'preiswaechter.desktop');

function quote(p) {
  return `"${p.replace(/(["`$\\])/g, '\\$1')}"`;
}

/** Programmdatei: beim AppImage die Datei selbst, nicht der temporäre Mount-Ordner. */
export function programPath() {
  return process.env.APPIMAGE || process.execPath;
}

function linuxExec() {
  const parts = app.isPackaged ? [programPath()] : [process.execPath, app.getAppPath()];
  return [...parts.map(quote), ARG].join(' ');
}

export function isAutostartEnabled() {
  if (IS_WINDOWS) {
    const item = app.getLoginItemSettings({ args: [ARG] });
    return item.openAtLogin && item.executableWillLaunchAtLogin;
  }
  try {
    const text = fs.readFileSync(linuxFile(), 'utf8');
    return !/^Hidden=true/m.test(text) && !/^X-GNOME-Autostart-enabled=false/m.test(text);
  } catch {
    return false;
  }
}

export function setAutostart(on) {
  try {
    if (IS_WINDOWS) {
      app.setLoginItemSettings({ openAtLogin: on, enabled: on, args: [ARG] });
    } else if (on) {
      fs.mkdirSync(path.dirname(linuxFile()), { recursive: true });
      fs.writeFileSync(linuxFile(), [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Preiswächter',
        'Comment=Produktpreise verfolgen',
        `Exec=${linuxExec()}`,
        'Icon=preiswaechter',
        'Terminal=false',
        'Categories=Utility;',
        // Kurz warten, bis Panel und Infobereich der Oberfläche bereit sind
        'X-GNOME-Autostart-Delay=5',
        '',
      ].join('\n'));
    } else {
      fs.rmSync(linuxFile(), { force: true });
    }
  } catch (err) {
    console.error('Autostart konnte nicht geändert werden:', err);
  }
  return isAutostartEnabled();
}

/** Beim Start: verschobenes AppImage nachziehen, damit der Autostart weiter funktioniert. */
export function refreshAutostartPath() {
  if (!IS_WINDOWS && app.isPackaged && isAutostartEnabled()) setAutostart(true);
}
