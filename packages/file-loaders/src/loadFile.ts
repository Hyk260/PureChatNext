import { stat } from 'node:fs/promises'
import path from 'node:path'

import debug from 'debug'

import { getFileLoader } from './loaders'
import type { DocumentPage, FileDocument, FileMetadata, SupportedFileType } from './types'
import { isTextReadableFile } from './utils/isTextReadableFile'

const log = debug('file-loaders:loadFile')

export class UnsupportedFileTypeError extends Error {
  fileType: string

  constructor(fileType: string, filename: string) {
    super(`Unsupported file type '${fileType || 'unknown'}' for file '${filename}'.`)
    this.name = 'UnsupportedFileTypeError'
    this.fileType = fileType
  }
}

/**
 * Determines the file type based on the filename extension.
 * @param filePath The path to the file.
 * @returns The determined file type or 'txt' if text-readable, undefined otherwise.
 */
const getFileType = (filePath: string): SupportedFileType | undefined => {
  log('正在根据文件名判断文件类型：%s', filePath)
  const extension = path.extname(filePath).toLowerCase().replace('.', '')

  if (!extension) {
    log('未检测到文件扩展名，按纯文本文件处理')
    return 'txt' // Treat files without extension as text?
  }

  // Prioritize checking if it's a generally text-readable type
  if (isTextReadableFile(extension)) {
    log('扩展名“%s”属于可读取的文本类型，按纯文本文件处理', extension)
    return 'txt'
  }

  // Handle specific non-text or complex types
  log('正在检查扩展名“%s”对应的专用文件类型', extension)
  switch (extension) {
    case 'pdf': {
      log('识别为 PDF 文件')
      return 'pdf'
    }
    case 'doc': {
      log('识别为 DOC 文件')
      return 'doc'
    }
    case 'docx': {
      log('识别为 DOCX 文件')
      return 'docx'
    }
    case 'xlsx':
    case 'xls': {
      log('识别为 Excel 文件')
      return 'excel'
    }
    case 'pptx': {
      log('识别为 PPTX 文件')
      return 'pptx'
    }
    default: {
      log('扩展名“%s”既不是已支持的专用类型，也不是可读取的文本类型，文件类型不受支持', extension)
      // If not text-readable and not a specific known type, it's unsupported
      return undefined
    }
  }
}

/**
 * Loads a file from the specified path, automatically detecting the file type
 * and using the appropriate loader class.
 *
 * @param filePath The path to the file to load.
 * @param fileMetadata Optional metadata to override information read from the filesystem.
 * @returns A Promise resolving to a FileDocument object.
 */
export const loadFile = async (filePath: string, fileMetadata?: FileMetadata): Promise<FileDocument> => {
  log('开始加载文件：%s，附加元数据：%O', filePath, fileMetadata)
  let stats
  let fsError: string | undefined

  try {
    log('正在读取文件属性：%s', filePath)
    stats = await stat(filePath)
    log('文件属性读取完成：%O', stats)
  } catch (e) {
    const error = e as Error
    log('读取文件属性失败，文件：%s，原因：%s', filePath, error.message)
    console.error(`Error getting file stats for ${filePath}: ${error.message}`)
    fsError = `Failed to access file stats: ${error.message}`
  }

  // Determine base file info from path and stats (if available)
  log('正在确定文件基础信息')
  const fileExtension = path.extname(filePath).slice(1).toLowerCase()
  const baseFilename = path.basename(filePath)

  // Apply overrides from fileMetadata or use defaults
  const source = fileMetadata?.source ?? filePath
  const filename = fileMetadata?.filename ?? baseFilename
  const fileType = fileMetadata?.fileType ?? fileExtension
  const createdTime = fileMetadata?.createdTime ?? stats?.ctime ?? new Date()
  const modifiedTime = fileMetadata?.modifiedTime ?? stats?.mtime ?? new Date()
  log('文件基础信息已确定（含元数据覆盖项）：%O', {
    createdTime,
    fileType,
    filename,
    modifiedTime,
    source,
  })

  const parserType = getFileType(filePath)
  log('已确定解析器类型：%s', parserType ?? '未识别')

  if (!parserType && !fsError) {
    console.warn(`No specific loader found for file type '${fileType}'. Rejecting unsupported file type.`)
    throw new UnsupportedFileTypeError(fileType, filename)
  }

  // Use lazy loading to get the loader class - this prevents heavy dependencies
  // like pdfjs-dist from being loaded until they're actually needed
  const LoaderClass = await getFileLoader(parserType ?? 'txt')
  log('已选择文件加载器：%s', LoaderClass.name)

  let pages: DocumentPage[]
  let aggregatedContent = ''
  let loaderError: string | undefined
  let aggregationError: string | undefined
  let metadataError: string | undefined
  let loaderSpecificMetadata: any | undefined

  // Instantiate the loader
  log('正在初始化文件加载器：%s', LoaderClass.name)
  const loaderInstance = new LoaderClass()

  // If we couldn't even get stats, skip loader execution
  if (!fsError) {
    log('文件属性可用，开始执行文件加载器')
    try {
      // 1. Load pages using the instance
      log('正在使用 %s 加载文件页面：%s', LoaderClass.name, filePath)
      pages = await loaderInstance.loadPages(filePath)
      log('文件页面加载完成，共 %d 页', pages.length)

      try {
        // 2. Aggregate content using the instance
        log('正在使用 %s 聚合文件内容', LoaderClass.name)
        aggregatedContent = await loaderInstance.aggregateContent(pages)
        log('文件内容聚合完成，字符数：%d', aggregatedContent.length)
      } catch (aggError) {
        const error = aggError as Error
        console.error(`Error aggregating content for ${filePath} using ${LoaderClass.name}: ${error.message}`)
        aggregationError = `Content aggregation failed: ${error.message}`
        // Keep the pages loaded, but content might be empty/incomplete
      }

      // 3. Attach document-specific metadata if loader supports it
      if (typeof loaderInstance.attachDocumentMetadata === 'function') {
        log('当前加载器支持附加文档元数据，正在提取')
        try {
          loaderSpecificMetadata = await loaderInstance.attachDocumentMetadata(filePath)
          log('文档专属元数据提取完成：%O', loaderSpecificMetadata)
        } catch (metaErr) {
          const error = metaErr as Error
          console.error(`Error attaching metadata for ${filePath} using ${LoaderClass.name}: ${error.message}`)
          metadataError = `Metadata attachment failed: ${error.message}`
        }
      } else {
        log('当前加载器不支持附加文档元数据')
      }
    } catch (loadErr) {
      const error = loadErr as Error
      console.error(`Error loading pages for ${filePath} using ${LoaderClass.name}: ${error.message}`)
      loaderError = `Loader execution failed: ${error.message}`
      // Provide a minimal error page if loader failed critically
      pages = [
        {
          charCount: 0,
          lineCount: 0,
          metadata: { error: loaderError },
          pageContent: '',
        },
      ]
      // Aggregated content remains empty
    }
  } else {
    log('文件属性读取失败（%s），正在创建最小错误页面', fsError)
    // If stats failed, create a minimal error page
    pages = [
      {
        charCount: 0,
        lineCount: 0,
        metadata: { error: fsError },
        pageContent: '',
      },
    ]
    // Aggregated content remains empty
  }

  // Calculate totals from the loaded pages
  let totalCharCount = 0
  let totalLineCount = 0
  log('正在统计所有页面的字符数和行数')
  for (const page of pages) {
    totalCharCount += page.charCount
    totalLineCount += page.lineCount
  }
  log('页面统计完成：%O', { totalCharCount, totalLineCount })

  // Combine all potential errors
  const combinedError = [fsError, loaderError, aggregationError, metadataError].filter(Boolean).join('; ') || undefined
  if (combinedError) log('文件加载过程中发现错误：%s', combinedError)

  // Construct the final FileDocument
  log('正在构建最终文件文档对象')
  const fileDocument: FileDocument = {
    content: aggregatedContent, // Use content from aggregateContent
    createdTime,
    fileType,
    filename,
    metadata: {
      // Include combined errors
      error: combinedError,
      // Add loader specific metadata under a namespace
      loaderSpecific: loaderSpecificMetadata ?? undefined,
      // Add other file-level metadata
      ...fileMetadata,
    },
    modifiedTime,
    pages, // Use pages from loadPages
    source,
    totalCharCount,
    totalLineCount,
  }

  // Clean up undefined error field if no error occurred
  if (!fileDocument.metadata.error) {
    delete fileDocument.metadata.error
  }

  log('文件加载完成：%s，返回文档摘要：%O', filePath, {
    fileType: fileDocument.fileType,
    filename: fileDocument.filename,
    pages: fileDocument.pages?.length,
  })
  return fileDocument
}
