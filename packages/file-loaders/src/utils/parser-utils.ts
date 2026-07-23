import { DOMParser } from '@xmldom/xmldom';
import concat from 'concat-stream';
import yauzl from 'yauzl';

/** Helpers for Office Open XML packages used by @pure/file-loaders. */

const PARSER_ERRORS = {
  invalidInput: `[file-loaders]: Expected a Buffer or a readable file path`,
};

/** Parse an XML string into a DOM document. */
export const parseString = (xml: string) => {
  const parser = new DOMParser();
  return parser.parseFromString(xml, 'text/xml') as unknown as XMLDocument;
};

export interface ExtractedFile {
  content: string;
  path: string;
}

/**
 * Pull matching entries from a ZIP (buffer or path).
 * `filterFn` receives each entry name and returns whether to extract it.
 */
export function extractFiles(
  zipInput: Buffer | string,
  filterFn: (fileName: string) => boolean,
): Promise<ExtractedFile[]> {
  return new Promise((resolve, reject) => {
    const processZipfile = (zipfile: yauzl.ZipFile) => {
      const extractedFiles: ExtractedFile[] = [];
      zipfile.readEntry();

      zipfile.on('entry', (entry: yauzl.Entry) => {
        if (entry.fileName.endsWith('/')) {
          zipfile.readEntry();
          return;
        }

        if (filterFn(entry.fileName)) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              zipfile.close();
              return reject(err);
            }
            if (!readStream) {
              zipfile.close();
              return reject(new Error(`Could not open read stream for ${entry.fileName}`));
            }

            readStream.pipe(
              concat((data) => {
                extractedFiles.push({
                  content: data.toString('utf8'),
                  path: entry.fileName,
                });
                zipfile.readEntry();
              }),
            );
            readStream.on('error', (streamErr) => {
              zipfile.close();
              reject(streamErr);
            });
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        resolve(extractedFiles);
        zipfile.close();
      });

      zipfile.on('error', (err) => {
        zipfile.close();
        reject(err);
      });
    };

    if (Buffer.isBuffer(zipInput)) {
      yauzl.fromBuffer(zipInput, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return reject(err || new Error('Failed to open zip from buffer'));
        processZipfile(zipfile);
      });
    } else if (typeof zipInput === 'string') {
      yauzl.open(zipInput, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile)
          return reject(err || new Error(`Failed to open zip file: ${zipInput}`));
        processZipfile(zipfile);
      });
    } else {
      reject(new Error(PARSER_ERRORS.invalidInput));
    }
  });
}
