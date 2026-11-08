// Nur Chrome: wertet vom Hintergrund geladenes HTML mit DOMParser aus.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'offscreen' || msg.type !== 'parseHtml') return false;
  try {
    const doc = new DOMParser().parseFromString(msg.html, 'text/html');
    sendResponse({ ok: true, result: globalThis.Preiswaechter.extractFromDocument(doc, msg.url) });
  } catch (e) {
    sendResponse({ ok: false, error: String((e && e.message) || e) });
  }
  return false;
});
