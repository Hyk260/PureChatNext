/** Ambient types for the `word-extractor` package used by the legacy `.doc` loader. */
declare module 'word-extractor' {
  export default class WordExtractor {
    extract(filePath: string): Promise<{
      getBody: () => string;
      getHeaders?: () => Record<string, string> | undefined;
      text?: string;
    }>;
  }
}
