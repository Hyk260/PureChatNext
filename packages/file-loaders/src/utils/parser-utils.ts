import { DOMParser } from '@xmldom/xmldom'
import concat from 'concat-stream'
import yauzl from 'yauzl'

/** Helpers for Office Open XML packages used by @pure/file-loaders. */

const PARSER_ERRORS = {
  invalidInput: `[file-loaders]: Expected a Buffer or a readable file path`,
}

/** Parse an XML string into a DOM document. */
export const parseString = (xml: string) => {
  const parser = new DOMParser()
  return parser.parseFromString(xml, 'text/xml') as unknown as XMLDocument
}

export interface ExtractedFile {
  content: string
  path: string
}

export interface ExtractFilesLimits {
  maxBytesPerFile: number
  maxEntries: number
  maxFiles: number
  maxTotalBytes: number
}

/**
 * Pull matching entries from a ZIP (buffer or path).
 * `filterFn` receives each entry name and returns whether to extract it.
 */
export function extractFiles(
  zipInput: Buffer | string,
  filterFn: (fileName: string) => boolean,
  limits: ExtractFilesLimits
): Promise<ExtractedFile[]> {
  return new Promise((resolve, reject) => {
    const processZipfile = (zipfile: yauzl.ZipFile) => {
      const extractedFiles: ExtractedFile[] = []
      let entryCount = 0
      let extractedBytes = 0
      let settled = false

      const fail = (error: Error, stream?: { destroy?: () => void }) => {
        if (settled) return
        settled = true
        stream?.destroy?.()
        zipfile.close()
        reject(error)
      }

      zipfile.readEntry()

      zipfile.on('entry', (entry: yauzl.Entry) => {
        entryCount += 1
        if (entryCount > limits.maxEntries) {
          fail(new Error('ZIP entry limit exceeded'))
          return
        }
        if (entry.fileName.endsWith('/')) {
          zipfile.readEntry()
          return
        }

        if (filterFn(entry.fileName)) {
          if (extractedFiles.length >= limits.maxFiles || entry.uncompressedSize > limits.maxBytesPerFile) {
            fail(new Error('ZIP extracted file limit exceeded'))
            return
          }
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              return fail(err)
            }
            if (!readStream) {
              return fail(new Error(`Could not open read stream for ${entry.fileName}`))
            }

            let fileBytes = 0
            readStream.on('data', (chunk: Buffer) => {
              fileBytes += chunk.byteLength
              extractedBytes += chunk.byteLength
              if (fileBytes > limits.maxBytesPerFile || extractedBytes > limits.maxTotalBytes) {
                fail(new Error('ZIP extracted byte limit exceeded'), readStream)
              }
            })
            readStream.pipe(
              concat((data) => {
                if (settled) return
                extractedFiles.push({
                  content: data.toString('utf8'),
                  path: entry.fileName,
                })
                zipfile.readEntry()
              })
            )
            readStream.on('error', (streamErr) => {
              fail(streamErr, readStream)
            })
          })
        } else {
          zipfile.readEntry()
        }
      })

      zipfile.on('end', () => {
        if (settled) return
        settled = true
        resolve(extractedFiles)
        zipfile.close()
      })

      zipfile.on('error', (err) => {
        fail(err)
      })
    }

    if (Buffer.isBuffer(zipInput)) {
      yauzl.fromBuffer(zipInput, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return reject(err || new Error('Failed to open zip from buffer'))
        processZipfile(zipfile)
      })
    } else if (typeof zipInput === 'string') {
      yauzl.open(zipInput, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return reject(err || new Error(`Failed to open zip file: ${zipInput}`))
        processZipfile(zipfile)
      })
    } else {
      reject(new Error(PARSER_ERRORS.invalidInput))
    }
  })
}
