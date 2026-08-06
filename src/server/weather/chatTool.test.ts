// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildWeatherLocationCandidates, createWeatherTool } from './chatTool'

const executeTool = async (location = '武汉市洪山区') => {
  const weatherTool = createWeatherTool()
  if (!weatherTool.execute) throw new Error('Expected executable weather tool')
  return weatherTool.execute(
    { location },
    { abortSignal: undefined, context: {}, messages: [], toolCallId: 'weather-call-1' }
  )
}

describe('weatherTool', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns structured current conditions and forecast', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                admin1: '湖北省',
                admin2: '武汉市',
                country: '中国',
                latitude: 30.5,
                longitude: 114.4,
                name: '洪山区',
                timezone: 'Asia/Shanghai',
              },
            ],
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            current: { temperature_2m: 32, weather_code: 2 },
            current_units: { temperature_2m: '°C' },
            daily: { temperature_2m_max: [34, 35, 33], time: ['2026-08-06', '2026-08-07', '2026-08-08'] },
            daily_units: { temperature_2m_max: '°C' },
            timezone: 'Asia/Shanghai',
          })
        )
      )
    vi.stubGlobal('fetch', fetchMock)

    const output = await executeTool()

    expect(output).toEqual(
      expect.objectContaining({
        current: { temperature_2m: 32, weather_code: 2 },
        source: 'https://open-meteo.com/',
        success: true,
        timezone: 'Asia/Shanghai',
        weatherDescription: '多云',
      })
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1]![0])).toContain('forecast_days=3')
  })

  it('returns a safe error without exposing upstream details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret upstream detail')))

    const output = await executeTool()

    expect(output).toEqual({ error: '天气服务暂不可用，请稍后重试。', location: '武汉市洪山区', success: false })
    expect(JSON.stringify(output)).not.toContain('secret upstream')
  })

  it('falls back from a district phrase to its city', async () => {
    const fetchMock = vi.fn().mockImplementation((input: URL | RequestInfo) => {
      const url = new URL(String(input))
      if (url.hostname === 'geocoding-api.open-meteo.com') {
        const name = url.searchParams.get('name')
        return Promise.resolve(
          new Response(
            JSON.stringify(
              name === '武汉'
                ? {
                    results: [
                      {
                        admin1: '湖北',
                        admin2: '武汉市',
                        country: '中国',
                        latitude: 30.58,
                        longitude: 114.27,
                        name: '武汉',
                        timezone: 'Asia/Shanghai',
                      },
                    ],
                  }
                : { results: [] }
            )
          )
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ current: { weather_code: 1 }, daily: {}, timezone: 'Asia/Shanghai' }))
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const output = await executeTool('武汉市洪山区')

    expect(buildWeatherLocationCandidates('武汉市洪山区')).toContain('武汉')
    expect(output).toEqual(expect.objectContaining({ success: true, weatherDescription: '大部晴朗' }))
  })
})
