// Einheitlicher Zugriff auf die Erweiterungs-API: Firefox bietet `browser`,
// Chrome `chrome` – beide unterstützen in MV3 Promises.
export const api = globalThis.browser ?? globalThis.chrome;

export const isFirefox = typeof globalThis.browser !== 'undefined' &&
  typeof globalThis.browser.runtime?.getBrowserInfo === 'function';
