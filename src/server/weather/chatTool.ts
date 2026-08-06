import { tool } from 'ai'
import debug from 'debug'
import { z } from 'zod'

const log = debug('chat:weather')
const REQUEST_TIMEOUT_MS = 10_000
const WEATHER_SOURCE_URL = 'https://open-meteo.com/'
const WEATHER_UNAVAILABLE_MESSAGE = '天气服务暂不可用，请稍后重试。'

const describeWeatherCode = (code: unknown) => {
  if (code === 0) return '晴'
  if (code === 1) return '大部晴朗'
  if (code === 2) return '多云'
  if (code === 3) return '阴'
  if (code === 45 || code === 48) return '雾'
  if ([51, 53, 55].includes(Number(code))) return '毛毛雨'
  if ([56, 57].includes(Number(code))) return '冻毛毛雨'
  if ([61, 63, 65].includes(Number(code))) return '雨'
  if ([66, 67].includes(Number(code))) return '冻雨'
  if ([71, 73, 75, 77].includes(Number(code))) return '雪'
  if ([80, 81, 82].includes(Number(code))) return '阵雨'
  if ([85, 86].includes(Number(code))) return '阵雪'
  if ([95, 96, 99].includes(Number(code))) return '雷暴'
  return '未知'
}

type GeocodingResponse = {
  results?: Array<{
    admin1?: string
    admin2?: string
    country?: string
    latitude: number
    longitude: number
    name: string
    timezone?: string
  }>
}

type ForecastResponse = {
  current?: Record<string, number | string>
  current_units?: Record<string, string>
  daily?: Record<string, Array<number | string>>
  daily_units?: Record<string, string>
  timezone?: string
}

const requestJson = async <T>(url: URL, abortSignal?: AbortSignal): Promise<T> => {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const signal = abortSignal ? AbortSignal.any([abortSignal, timeoutSignal]) : timeoutSignal
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new Error(`Weather upstream returned ${response.status}`)
  return (await response.json()) as T
}

export const buildWeatherLocationCandidates = (location: string) => {
  const candidates = new Set([location])
  const compact = location.replace(/\s+/g, '')
  const cityMarker = compact.indexOf('市')
  if (cityMarker >= 2) {
    const beforeCity = compact.slice(0, cityMarker)
    candidates.add(beforeCity.slice(Math.max(beforeCity.lastIndexOf('省') + 1, 0)))
  }

  const core = compact.replace(/(?:特别行政区|自治区|自治州|新区|区|县|旗|镇|市)$/u, '')
  candidates.add(core)
  for (const length of [4, 3, 2]) {
    if (core.length > length) candidates.add(core.slice(0, length))
  }
  return [...candidates].filter((candidate) => candidate.length >= 2).slice(0, 6)
}

const geocodeLocation = async (location: string, abortSignal?: AbortSignal) => {
  for (const candidate of buildWeatherLocationCandidates(location)) {
    const geocodingUrl = new URL('https://geocoding-api.open-meteo.com/v1/search')
    geocodingUrl.search = new URLSearchParams({ count: '1', language: 'zh', name: candidate }).toString()
    const geocoding = await requestJson<GeocodingResponse>(geocodingUrl, abortSignal)
    const place = geocoding.results?.[0]
    if (place) return place
  }
  return undefined
}

export const createWeatherTool = () =>
  tool({
    description:
      'Get structured current weather and a 3-day forecast for a named location. Use this instead of webSearch for weather questions. Cite https://open-meteo.com/ as the data source.',
    inputSchema: z.object({
      location: z.string().trim().min(2).max(100).describe('Specific city, district, or place name'),
    }),
    execute: async ({ location }, { abortSignal }) => {
      const startedAt = Date.now()
      try {
        const place = await geocodeLocation(location, abortSignal)
        if (!place) {
          log('location not found q=%d durationMs=%d', location.length, Date.now() - startedAt)
          return { error: '未找到该地点，请提供更具体的城市或区县名称。', location, success: false as const }
        }

        const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast')
        forecastUrl.search = new URLSearchParams({
          current:
            'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
          daily:
            'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
          forecast_days: '3',
          latitude: String(place.latitude),
          longitude: String(place.longitude),
          timezone: place.timezone || 'auto',
        }).toString()
        const forecast = await requestJson<ForecastResponse>(forecastUrl, abortSignal)
        const dailyWeatherCodes = forecast.daily?.weather_code

        log('completed q=%d durationMs=%d', location.length, Date.now() - startedAt)
        return {
          current: forecast.current,
          currentUnits: forecast.current_units,
          daily: forecast.daily,
          dailyUnits: forecast.daily_units,
          dailyWeatherDescriptions: dailyWeatherCodes?.map(describeWeatherCode),
          location: {
            admin1: place.admin1,
            admin2: place.admin2,
            country: place.country,
            name: place.name,
          },
          source: WEATHER_SOURCE_URL,
          success: true as const,
          timezone: forecast.timezone || place.timezone,
          weatherDescription: describeWeatherCode(forecast.current?.weather_code),
        }
      } catch (error) {
        log('failed q=%d durationMs=%d: %O', location.length, Date.now() - startedAt, error)
        return { error: WEATHER_UNAVAILABLE_MESSAGE, location, success: false as const }
      }
    },
  })

export const weatherTool = createWeatherTool()
