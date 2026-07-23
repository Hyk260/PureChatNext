// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadFile } from '../src';

const fixturePath = (filename: string) => path.join(__dirname, 'fixtures', filename);

const TEXT_FIXTURES = ['test.txt', 'test.csv', 'test.md'];

describe('loadFile integration (@pure/file-loaders)', () => {
  describe('plain text fixtures', () => {
    const assertTextFixture = (fileName: string) => {
      it(`loads ${fileName} from disk`, async () => {
        const filePath = fixturePath(fileName);
        const expectedContent = fs.readFileSync(filePath, 'utf8');

        const docs = await loadFile(filePath);

        expect(docs.content).toEqual(expectedContent);
        expect(docs.source).toEqual(filePath);

        // @ts-expect-error
        delete docs.source;
        // @ts-expect-error
        delete docs.createdTime;
        // @ts-expect-error
        delete docs.modifiedTime;
        expect(docs).toMatchSnapshot();
      });
    };

    TEXT_FIXTURES.forEach((file) => {
      assertTextFixture(file);
    });
  });

  describe('PDF fixtures', () => {
    it('loads test.pdf from disk', async () => {
      const filePath = fixturePath('test.pdf');

      const docs = await loadFile(filePath);

      expect(docs.content).toContain('123');
      expect(docs.source).toEqual(filePath);

      // @ts-expect-error
      delete docs.source;
      // @ts-expect-error
      delete docs.createdTime;
      // @ts-expect-error
      delete docs.modifiedTime;
      expect(docs).toMatchSnapshot();
    });
  });
});
