// Werte, die Hauptprozess und Oberfläche gemeinsam brauchen.

export const DEFAULT_SETTINGS = {
  defaultIntervalMin: 60,
  notifications: true,
  theme: 'system',
};

export const THEMES = [
  ['system', 'Wie das System'],
  ['light', 'Hell'],
  ['dark', 'Dunkel'],
];

export const INTERVALS = [
  [15, '15 Minuten'],
  [30, '30 Minuten'],
  [60, '1 Stunde'],
  [180, '3 Stunden'],
  [360, '6 Stunden'],
  [720, '12 Stunden'],
  [1440, '24 Stunden'],
];
