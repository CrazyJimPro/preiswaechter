// Versionsvergleich für den Hinweis auf neue Versionen.

function parts(v) {
  return String(v || '').replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
}

/** true, wenn `latest` neuer ist als `current`. */
export function isNewer(latest, current) {
  const a = parts(latest);
  const b = parts(current);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}
