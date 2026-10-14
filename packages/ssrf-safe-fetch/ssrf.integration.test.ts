// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { ssrfSafeFetch } from './index'

describe('ssrfSafeFetch connection filtering', () => {
  it('blocks a loopback target before connecting', async () => {
    delete process.env.SSRF_ALLOW_PRIVATE_IP_ADDRESS
    delete process.env.SSRF_ALLOW_IP_ADDRESS_LIST

    await expect(ssrfSafeFetch('http://127.0.0.1:9/')).rejects.toThrow(/SSRF blocked/)
  })
})
