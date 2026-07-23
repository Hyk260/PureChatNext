import { describe, expect, it } from 'vitest';

import { isTextReadableFile } from '../src/utils/isTextReadableFile';

describe('isTextReadableFile (@pure/file-loaders)', () => {
  it('accepts common text extensions', () => {
    const positives = [
      'txt',
      'md',
      'mdx',
      'json',
      'yaml',
      'yml',
      'csv',
      'html',
      'css',
      'js',
      'ts',
      'py',
      'log',
      'sql',
      'patch',
      'diff',
    ];

    for (const ext of positives) {
      expect(isTextReadableFile(ext)).toBe(true);
    }
  });

  it('ignores extension casing', () => {
    expect(isTextReadableFile('Md')).toBe(true);
    expect(isTextReadableFile('JSON')).toBe(true);
    expect(isTextReadableFile('YML')).toBe(true);
  });

  it('rejects binary / office extensions that need dedicated loaders', () => {
    const negatives = ['pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'gif'];
    for (const ext of negatives) {
      expect(isTextReadableFile(ext)).toBe(false);
    }
  });
});
