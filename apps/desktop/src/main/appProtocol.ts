import { promises as fs } from 'node:fs'
import path from 'node:path'

import { isAppRendererUrl } from './rendererSecurity'

interface AppProtocolOptions {
  fetch: (url: string, init?: RequestInit) => Promise<Response>
  getRemoteServerUrl: () => Promise<string | null>
  rendererDir: string
}

const isApiPath = (pathname: string) => pathname === '/api' || pathname.startsWith('/api/')

const removeBrowserOriginHeaders = (headers: Headers) => {
  for (const name of [
    'connection', 'content-length', 'host', 'origin', 'referer',
    'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site', 'sec-fetch-user',
  ]) headers.delete(name)
}

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

export const createAppProtocolHandler = (options: AppProtocolOptions) => {
  const root = path.resolve(options.rendererDir)

  return async (request: Request): Promise<Response> => {
    // Check the host before accessing configuration, files or the upstream session.
    if (!isAppRendererUrl(request.url)) return new Response('Forbidden', { status: 403 })
    const url = new URL(request.url)

    if (isApiPath(url.pathname)) {
      const remoteServerUrl = await options.getRemoteServerUrl()
      if (!remoteServerUrl) return Response.json({ error: '尚未配置远程服务地址' }, { status: 503 })

      const targetUrl = new URL(`${url.pathname}${url.search}`, `${remoteServerUrl}/`)
      const headers = new Headers(request.headers)
      removeBrowserOriginHeaders(headers)
      const init: RequestInit = {
        credentials: 'include', headers, method: request.method, signal: request.signal,
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') init.body = await request.arrayBuffer()

      try {
        return await options.fetch(targetUrl.toString(), init)
      } catch {
        return Response.json({ error: '无法连接远程服务' }, { status: 502 })
      }
    }

    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
    }

    let pathname: string
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return new Response('Bad Request', { status: 400 })
    }
    if (pathname.includes('\0') || pathname.includes('\\')) return new Response('Forbidden', { status: 403 })
    const relativePath = pathname.replace(/^\/+/, '')
    let resolvedPath = path.resolve(root, relativePath || 'index.html')
    if (!resolvedPath.startsWith(`${root}${path.sep}`)) return new Response('Forbidden', { status: 403 })

    try {
      if (!(await fs.stat(resolvedPath)).isFile()) throw new Error('Not a file')
    } catch {
      // Missing assets must not return successful HTML and hide broken CSS/JS builds.
      if (path.extname(pathname) || pathname.startsWith('/assets/')) {
        return new Response('Not Found', { status: 404 })
      }
      resolvedPath = path.join(root, 'index.html')
    }

    try {
      const content = await fs.readFile(resolvedPath)
      return new Response(request.method === 'HEAD' ? null : content, {
        headers: {
          'Content-Type': contentTypes[path.extname(resolvedPath).toLowerCase()] || 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  }
}
