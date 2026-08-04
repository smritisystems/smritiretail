import { describe, expect, it } from 'vitest';

const bannedPatterns = [
  /\b(bg|text|border)-(white|black)\b/,
  /\b(bg|text|border)-(gray|slate|zinc|neutral|stone)-[0-9]{2,3}\b/,
];

describe('theme governance', () => {
  it('keeps the business UI token contract free of raw color utilities', () => {
    const samples = [
      'bg-surface',
      'bg-surface-elevated',
      'text-primary',
      'text-secondary',
      'border-default',
      'border-subtle',
    ];

    for (const sample of samples) {
      expect(bannedPatterns.some((pattern) => pattern.test(sample))).toBe(false);
    }

    const banned = ['bg-white', 'text-black', 'border-gray-200', 'bg-gray-50'];
    for (const sample of banned) {
      expect(bannedPatterns.some((pattern) => pattern.test(sample))).toBe(true);
    }
  });
});
