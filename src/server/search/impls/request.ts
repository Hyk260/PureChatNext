import type { Debugger } from 'debug'
import type { SearchProviderOptions } from './type'

export async function postSearchRequest(
  endpoint: string,
  body: unknown,
  apiKey: string | undefined,
  options: SearchProviderOptions,
  provider: string,
  log: Debugger
) {
  const startAt = Date.now()
  let response: Response
  try {
    log('Sending request to endpoint: %s', endpoint)
    response = await (options.fetch ?? fetch)(endpoint, {
      body: JSON.stringify(body),
      headers: { Authorization: apiKey ? `Bearer ${apiKey}` : '', 'Content-Type': 'application/json' },
      method: 'POST',
    })
    log('Received response with status: %d', response.status)
  } catch (error) {
    log.extend('error')('%s fetch error: %o', provider, error)
    throw new Error(`Failed to connect to ${provider}.`, { cause: error })
  }
  return { response, costTime: Date.now() - startAt }
}
