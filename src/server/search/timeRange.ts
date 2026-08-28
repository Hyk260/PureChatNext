export const SEARCH_TIME_RANGE_DAYS = {
  day: 1,
  month: 30,
  week: 7,
  year: 365,
} as const

export const getSearchTimeRangeDays = (value: string | undefined): number | undefined => {
  if (!value || value === 'anytime') return undefined
  return SEARCH_TIME_RANGE_DAYS[value as keyof typeof SEARCH_TIME_RANGE_DAYS]
}
