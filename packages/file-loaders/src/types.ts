export type SupportedFileType = 'pdf' | 'doc' | 'docx' | 'txt' | 'excel' | 'pptx'

/** Fully loaded document: file-level fields plus optional page/chunk list. */
export interface FileDocument {
  /** Aggregated text content. */
  content: string

  /** Creation time from filesystem (or override). */
  createdTime: Date

  /** Original basename. */
  filename: string

  /** Extension / loader kind. */
  fileType: string

  /**
   * File-scoped metadata (title/author from properties, or a top-level load error).
   */
  metadata: {
    [key: string]: any
    author?: string
    error?: string
    title?: string
  }

  /** Last modified time from filesystem (or override). */
  modifiedTime: Date

  /** Logical pages / sheets / slides / chunks, in natural file order when present. */
  pages?: DocumentPage[]

  /** Original path or caller-supplied source id. */
  source: string

  /** Sum of page `charCount` values after load. */
  totalCharCount: number

  /** Sum of page `lineCount` values after load. */
  totalLineCount: number
}

/** One logical page / sheet / slide / chunk within a document. */
export interface DocumentPage {
  charCount: number
  lineCount: number

  metadata: {
    [key: string]: any
    chunkIndex?: number
    error?: string
    lineNumberEnd?: number
    lineNumberStart?: number
    /** PDF / DOCX page index. */
    pageNumber?: number
    sectionTitle?: string
    /** Excel sheet name. */
    sheetName?: string
    /** PPTX slide index. */
    slideNumber?: number
    totalChunks?: number
  }

  pageContent: string
}

/** Optional overrides when filesystem stats are unavailable or should be replaced. */
export interface FileMetadata {
  createdTime?: Date
  filename?: string
  fileType?: string
  modifiedTime?: Date
  /** e.g. object-storage URL or original path. */
  source?: string
}

/** Contract implemented by each format-specific loader. */
export interface FileLoaderInterface {
  /** Join `loadPages` results into one content string. */
  aggregateContent: (pages: DocumentPage[]) => Promise<string>

  attachDocumentMetadata?: (filePath: string) => Promise<Record<string, any>>

  /** Parse `filePath` into ordered pages/chunks. */
  loadPages: (filePath: string) => Promise<DocumentPage[]>
}
