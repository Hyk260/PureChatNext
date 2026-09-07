import type { UniformSearchResult } from '@pure/types'

const WEATHER_QUERY_PATTERN = /天气|气温|温度|降雨|下雨|降雪|下雪|湿度|风力|天气预报/u
const WEATHER_RESULT_PATTERN =
  /天气|气温|温度|降雨|降水|雨量|降雪|湿度|风力|风速|预报|晴|阴|多云|雷阵雨|weather|temperature|forecast|rain|snow/iu

const NEWS_QUERY_PATTERN = /新闻|头条|要闻|快报|简报|资讯|headline|headlines|breaking\s*news/iu
const NEWS_BLOCKED_HOST_PATTERN = /(?:^|\.)wikipedia\.org$/i
const NEWS_BLOCKED_URL_PATTERN = /timeanddate\.com\/calendar|calendarr\.com|\/year\/\d{4}\/?$/i
const NEWS_STALE_MS = 14 * 24 * 60 * 60 * 1000

const isWeatherQuery = (query: string) => WEATHER_QUERY_PATTERN.test(query)
const isNewsQuery = (query: string) => NEWS_QUERY_PATTERN.test(query)

const isWeatherResult = (result: UniformSearchResult) =>
  WEATHER_RESULT_PATTERN.test(`${result.title} ${result.content}`)

const isBlockedNewsSource = (result: UniformSearchResult) =>
  NEWS_BLOCKED_HOST_PATTERN.test(result.parsedUrl) || NEWS_BLOCKED_URL_PATTERN.test(result.url)

const isStaleNewsResult = (result: UniformSearchResult, now: number) => {
  if (!result.publishedDate) return false
  const publishedAt = Date.parse(result.publishedDate)
  if (Number.isNaN(publishedAt)) return false
  return now - publishedAt > NEWS_STALE_MS
}

const isUsableNewsResult = (result: UniformSearchResult, now: number) =>
  !isBlockedNewsSource(result) && !isStaleNewsResult(result, now)

/**
 * Reject clearly off-topic results for intents where false positives are more
 * harmful than an empty result. Other queries keep provider ranking unchanged.
 */
export function filterRelevantSearchResults(
  query: string,
  results: UniformSearchResult[],
  now = Date.now()
) {
  if (isWeatherQuery(query)) return results.filter(isWeatherResult)
  if (isNewsQuery(query)) return results.filter((result) => isUsableNewsResult(result, now))
  return results
}
