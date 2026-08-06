import type { UniformSearchResult } from '@pure/types'

const WEATHER_QUERY_PATTERN = /天气|气温|温度|降雨|下雨|降雪|下雪|湿度|风力|天气预报/u
const WEATHER_RESULT_PATTERN =
  /天气|气温|温度|降雨|降水|雨量|降雪|湿度|风力|风速|预报|晴|阴|多云|雷阵雨|weather|temperature|forecast|rain|snow/iu

/**
 * Reject clearly off-topic results for intents where false positives are more
 * harmful than an empty result. Other queries keep provider ranking unchanged.
 */
export function filterRelevantSearchResults(query: string, results: UniformSearchResult[]) {
  if (!WEATHER_QUERY_PATTERN.test(query)) return results

  return results.filter((result) => WEATHER_RESULT_PATTERN.test(`${result.title} ${result.content}`))
}
