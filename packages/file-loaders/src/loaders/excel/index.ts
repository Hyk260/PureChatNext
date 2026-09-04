import { readFile } from 'node:fs/promises'

import debug from 'debug'
import * as xlsx from 'xlsx'

import type { DocumentPage, FileLoaderInterface } from '../../types'
import { promptTemplate } from './prompt'

const log = debug('file-loaders:excel')

/**
 * 将工作表数据（对象数组）转换为 Markdown 表格。
 * 兼容空表场景，并转义单元格中的竖线字符。
 */
function sheetToMarkdownTable(jsonData: Record<string, any>[]): string {
  log('正在将工作表数据转换为 Markdown 表格，数据行数：%d', jsonData?.length || 0)
  if (!jsonData || jsonData.length === 0) {
    log('工作表为空，返回空表占位内容')
    return '*Sheet is empty or contains no data.*'
  }

  // 以第一行键名对齐各行，保证稀疏单元格位置一致
  const headers = Object.keys(jsonData[0] || {})
  log('工作表列名：%O', headers)
  if (headers.length === 0) {
    log('未检测到列名，返回空表占位内容')
    return '*Sheet has headers but no data.*'
  }

  const headerRow = `| ${headers.join(' | ')} |`
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`

  log('正在构建 Markdown 表格内容')
  const dataRows = jsonData
    .map((row) => {
      const cells = headers.map((header) => {
        const value = row[header]
        // 空值转为空字符串，并转义单元格内的竖线
        const cellContent = value === null || value === undefined ? '' : String(value).replaceAll('|', '\\|')
        return cellContent.trim() // 去除单元格首尾空白
      })
      return `| ${cells.join(' | ')} |`
    })
    .join('\n')

  const result = `${headerRow}\n${separatorRow}\n${dataRows}`
  log('Markdown 表格创建完成，字符数：%d', result.length)
  return result
}

/**
 * 使用 xlsx 库加载 Excel 文件（.xlsx / .xls）。
 * 每个工作表转换为一个包含 Markdown 表格的 DocumentPage。
 */
export class ExcelLoader implements FileLoaderInterface {
  async loadPages(filePath: string): Promise<DocumentPage[]> {
    log('开始加载 Excel 文件：%s', filePath)
    const pages: DocumentPage[] = []
    try {
      // 使用异步 readFile，保持与其它解析器一致
      log('正在以 Buffer 方式读取 Excel 文件')
      const dataBuffer = await readFile(filePath)
      log('Excel 文件读取完成，大小：%d 字节', dataBuffer.length)

      log('正在解析 Excel 工作簿')
      const workbook = xlsx.read(dataBuffer, { type: 'buffer' })
      log('Excel 工作簿解析完成，包含 %d 个工作表', workbook.SheetNames.length)

      for (const sheetName of workbook.SheetNames) {
        log('正在处理工作表：%s', sheetName)
        const worksheet = workbook.Sheets[sheetName]
        // 将每行转为对象，便于后续渲染成 Markdown
        const jsonData = xlsx.utils.sheet_to_json<Record<string, any>>(worksheet, {
          // 取格式化后的展示值，而不是原始值
          defval: '',
          raw: false, // 空白单元格使用空字符串
        })
        log('工作表“%s”已解析为对象数组，数据行数：%d', sheetName, jsonData.length)

        // 将工作表行转换为 Markdown 表格
        const tableMarkdown = sheetToMarkdownTable(jsonData)

        const lines = tableMarkdown.split('\n')
        const lineCount = lines.length
        const charCount = tableMarkdown.length
        log('工作表“%s”已转为 Markdown：%d 行、%d 字符', sheetName, lineCount, charCount)

        pages.push({
          // 去除表格整体首尾空白
          charCount,
          lineCount,
          metadata: {
            sheetName,
          },
          pageContent: tableMarkdown.trim(),
        })
        log('工作表“%s”已添加为文档页面', sheetName)
      }

      if (pages.length === 0) {
        log('Excel 文件不含工作表，创建空错误页面')
        pages.push({
          charCount: 0,
          lineCount: 0,
          metadata: {
            error: 'Excel file contains no sheets.',
          },
          pageContent: '',
        })
      }

      log('Excel 文件加载完成，共生成 %d 个文档页面', pages.length)
      return pages
    } catch (e) {
      const error = e as Error
      log('Excel 文件加载失败：%O', error)
      console.error(`Excel 文件加载失败（${filePath}）：${error.message}`)
      const errorPage: DocumentPage = {
        charCount: 0,
        lineCount: 0,
        metadata: {
          error: `Failed to load Excel file: ${error.message}`,
        },
        pageContent: '',
      }
      log('已为加载失败的 Excel 文件生成错误页面')
      return [errorPage]
    }
  }

  /**
   * 聚合 Excel 各工作表内容（Markdown 表格），并在每个表格前标注工作表名。
   * @param pages loadPages 返回的 DocumentPage 数组。
   * @returns 聚合后的文本内容。
   */
  async aggregateContent(pages: DocumentPage[]): Promise<string> {
    log('正在聚合 %d 个 Excel 工作表页面的内容', pages.length)
    const result = promptTemplate(pages)

    log('Excel 内容聚合完成，字符数：%d', result.length)
    return result
  }
}
