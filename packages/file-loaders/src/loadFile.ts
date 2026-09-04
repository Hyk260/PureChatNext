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
 * 根据文件扩展名判断应使用的解析器。
 * @param filePath 文件路径。
 * @returns 文本可读类型返回 'txt'，专用格式返回对应类型，无法识别返回 undefined。
 */
const getFileType = (filePath: string): SupportedFileType | undefined => {
  log('正在根据扩展名判断文件类型：%s', filePath)
  const extension = path.extname(filePath).toLowerCase().replace('.', '')

  if (!extension) {
    log('未检测到文件扩展名，按纯文本处理')
    return 'txt' // 没有扩展名时也按文本尝试
  }

  // 先判断是否属于通用可读文本
  if (isTextReadableFile(extension)) {
    log('扩展名“%s”是可读取的文本类型，按纯文本处理', extension)
    return 'txt'
  }

  // 再匹配需要专用解析器的非文本格式
  log('正在匹配扩展名“%s”对应的专用解析器', extension)
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
      log('扩展名“%s”既不属于受支持的专用类型，也不是可读取的文本类型，无法解析', extension)
      // 既非专用格式也非可读文本，视为不支持
      return undefined
    }
  }
}

/**
 * 从指定路径加载文件，自动识别文件类型并调用相应解析器。
 *
 * @param filePath 待加载文件的路径。
 * @param fileMetadata 可选的元数据覆盖项，用于替代从文件系统读取的信息。
 * @returns 解析完成后的 FileDocument。
 */
export const loadFile = async (filePath: string, fileMetadata?: FileMetadata): Promise<FileDocument> => {
  log('开始加载文件：%s（元数据：%O）', filePath, fileMetadata)
  let stats
  let fsError: string | undefined

  try {
    log('正在读取文件属性：%s', filePath)
    stats = await stat(filePath)
    log('文件属性读取完成：%O', stats)
  } catch (e) {
    const error = e as Error
    log('读取文件属性失败：%s（原因：%s）', filePath, error.message)
    console.error(`Error getting file stats for ${filePath}: ${error.message}`)
    fsError = `Failed to access file stats: ${error.message}`
  }

  // 根据路径与文件状态确定基础信息
  log('正在确定文件基础信息')
  const fileExtension = path.extname(filePath).slice(1).toLowerCase()
  const baseFilename = path.basename(filePath)

  // 使用 fileMetadata 覆盖默认值
  const source = fileMetadata?.source ?? filePath
  const filename = fileMetadata?.filename ?? baseFilename
  const fileType = fileMetadata?.fileType ?? fileExtension
  const createdTime = fileMetadata?.createdTime ?? stats?.ctime ?? new Date()
  const modifiedTime = fileMetadata?.modifiedTime ?? stats?.mtime ?? new Date()
  log('文件基础信息已确定（含传入的元数据覆盖）：%O', {
    createdTime,
    fileType,
    filename,
    modifiedTime,
    source,
  })

  const parserType = getFileType(filePath)
  log('解析器类型：%s', parserType ?? '未识别')

  if (!parserType && !fsError) {
    console.warn(`No specific loader found for file type '${fileType}'. Rejecting unsupported file type.`)
    throw new UnsupportedFileTypeError(fileType, filename)
  }

  // 延迟加载重型解析器，避免 pdfjs-dist 等大依赖过早进入主包
  const LoaderClass = await getFileLoader(parserType ?? 'txt')
  log('已选择文件加载器：%s', LoaderClass.name)

  let pages: DocumentPage[]
  let aggregatedContent = ''
  let loaderError: string | undefined
  let aggregationError: string | undefined
  let metadataError: string | undefined
  let loaderSpecificMetadata: any | undefined

  // 实例化解析器
  log('正在初始化文件加载器：%s', LoaderClass.name)
  const loaderInstance = new LoaderClass()

  // 读取不到文件属性时跳过解析，只生成错误页
  if (!fsError) {
    log('文件属性读取成功，开始解析')
    try {
      // 1. 调用解析器读取页面
      log('正在使用加载器 %s 读取页面：%s', LoaderClass.name, filePath)
      pages = await loaderInstance.loadPages(filePath)
      log('页面读取完成，共 %d 页', pages.length)
      const pageLoadError = pages.find((page) => page.metadata?.error)?.metadata.error
      if (pageLoadError) loaderError = pageLoadError

      try {
        // 2. 调用解析器聚合页面内容
        log('正在使用加载器 %s 聚合页面内容', LoaderClass.name)
        aggregatedContent = await loaderInstance.aggregateContent(pages)
        log('内容聚合完成，字符数：%d', aggregatedContent.length)
      } catch (aggError) {
        const error = aggError as Error
        console.error(`Error aggregating content for ${filePath} using ${LoaderClass.name}: ${error.message}`)
        aggregationError = `Content aggregation failed: ${error.message}`
        // 页面数据保留，但聚合结果可能为空或不完整
      }

      // 3. 若解析器支持，附加文档级元数据
      if (!loaderError && typeof loaderInstance.attachDocumentMetadata === 'function') {
        log('当前加载器支持附加文档元数据，开始提取')
        try {
          loaderSpecificMetadata = await loaderInstance.attachDocumentMetadata(filePath)
          log('文档元数据提取完成：%O', loaderSpecificMetadata)
        } catch (metaErr) {
          const error = metaErr as Error
          console.error(`Error attaching metadata for ${filePath} using ${LoaderClass.name}: ${error.message}`)
          metadataError = `Metadata attachment failed: ${error.message}`
        }
      } else if (typeof loaderInstance.attachDocumentMetadata !== 'function') {
        log('当前加载器不支持附加文档元数据')
      }
    } catch (loadErr) {
      const error = loadErr as Error
      console.error(`Error loading pages for ${filePath} using ${LoaderClass.name}: ${error.message}`)
      loaderError = `Loader execution failed: ${error.message}`
      // 解析器崩溃时返回最小错误页
      pages = [
        {
          charCount: 0,
          lineCount: 0,
          metadata: { error: loaderError },
          pageContent: '',
        },
      ]
      // 聚合内容保持为空
    }
  } else {
    log('文件属性读取失败（%s），正在生成最小错误页面', fsError)
    // 文件属性读取失败时也返回最小错误页
    pages = [
      {
        charCount: 0,
        lineCount: 0,
        metadata: { error: fsError },
        pageContent: '',
      },
    ]
    // 聚合内容保持为空
  }

  // 汇总所有页面的字符数与行数
  let totalCharCount = 0
  let totalLineCount = 0
  log('正在统计所有页面的字符数和行数')
  for (const page of pages) {
    totalCharCount += page.charCount
    totalLineCount += page.lineCount
  }
  log('页面统计完成：%O', { totalCharCount, totalLineCount })

  // 合并所有阶段的错误
  const combinedError = [fsError, loaderError, aggregationError, metadataError].filter(Boolean).join('; ') || undefined
  if (combinedError) log('文件加载过程中发现错误：%s', combinedError)

  // 组装最终 FileDocument
  log('正在构建最终 FileDocument')
  const fileDocument: FileDocument = {
    content: aggregatedContent, // 内容来自聚合结果
    createdTime,
    fileType,
    filename,
    metadata: {
      // 汇总各阶段错误
      error: combinedError,
      // 解析器专属元数据统一放在 loaderSpecific
      loaderSpecific: loaderSpecificMetadata ?? undefined,
      // 保留其它文件级元数据
      ...fileMetadata,
    },
    modifiedTime,
    pages, // 页面来自 loadPages 的返回值
    source,
    totalCharCount,
    totalLineCount,
  }

  // 无错误时移除空的 error 字段
  if (!fileDocument.metadata.error) {
    delete fileDocument.metadata.error
  }

  log('文件加载完成：%s，文档摘要：%O', filePath, {
    fileType: fileDocument.fileType,
    filename: fileDocument.filename,
    pages: fileDocument.pages?.length,
  })
  return fileDocument
}
