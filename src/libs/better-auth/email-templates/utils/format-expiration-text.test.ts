import { describe, expect, it } from 'vitest';

import { formatExpirationText } from './format-expiration-text';

describe('formatExpirationText', () => {
  it('formats hours as whole numbers', () => {
    expect(formatExpirationText(3600)).toBe('1 小时');
    expect(formatExpirationText(5400)).toBe('2 小时');
  });

  it('formats minutes as whole numbers', () => {
    expect(formatExpirationText(344)).toBe('6 分钟');
    expect(formatExpirationText(300)).toBe('5 分钟');
  });

  it('formats sub-minute durations in seconds', () => {
    expect(formatExpirationText(45)).toBe('45 秒');
  });
});
