import { type LocalChatTopic, type TopicGroupMode, type TopicSortBy } from '@/features/chat/types'

export type TopicGroup = {
  id: string
  title: string
  topics: LocalChatTopic[]
}

const getSortTime = (topic: LocalChatTopic, sortBy: TopicSortBy) => topic[sortBy]

export const sortTopics = (topics: LocalChatTopic[], sortBy: TopicSortBy) =>
  [...topics].sort((left, right) => getSortTime(right, sortBy) - getSortTime(left, sortBy))

const startOfDay = (timestamp: number) => {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

const startOfDaysAgo = (timestamp: number, days: number) => {
  const date = new Date(startOfDay(timestamp))
  date.setDate(date.getDate() - days)
  return date.getTime()
}

const getTimeGroupId = (timestamp: number, now: number) => {
  const date = new Date(timestamp)
  const current = new Date(now)
  const today = startOfDay(now)
  const topicDay = startOfDay(timestamp)

  if (topicDay === today) return 'today'
  if (topicDay === startOfDaysAgo(now, 1)) return 'yesterday'
  if (topicDay >= startOfDaysAgo(now, 6)) return 'week'
  if (date.getFullYear() === current.getFullYear() && date.getMonth() === current.getMonth()) return 'month'
  if (date.getFullYear() === current.getFullYear()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }
  return String(date.getFullYear())
}

const getTimeGroupTitle = (id: string) => {
  if (id === 'today') return '今天'
  if (id === 'yesterday') return '昨天'
  if (id === 'week') return '过去 7 天'
  if (id === 'month') return '本月'
  if (/^\d{4}-\d{2}$/.test(id)) return `${Number(id.slice(5))}月`
  return `${id}年`
}

const TIME_GROUP_ORDER = new Map([
  ['today', 0],
  ['yesterday', 1],
  ['week', 2],
  ['month', 3],
])

const groupByTime = (topics: LocalChatTopic[], sortBy: TopicSortBy, now: number): TopicGroup[] => {
  const groups = new Map<string, LocalChatTopic[]>()
  for (const topic of sortTopics(topics, sortBy)) {
    const id = getTimeGroupId(getSortTime(topic, sortBy), now)
    groups.set(id, [...(groups.get(id) ?? []), topic])
  }

  return [...groups.entries()]
    .map(([id, items]) => ({ id, title: getTimeGroupTitle(id), topics: items }))
    .sort((left, right) => {
      const leftOrder = TIME_GROUP_ORDER.get(left.id) ?? Number.MAX_SAFE_INTEGER
      const rightOrder = TIME_GROUP_ORDER.get(right.id) ?? Number.MAX_SAFE_INTEGER
      if (leftOrder !== rightOrder) return leftOrder - rightOrder
      return right.id.localeCompare(left.id)
    })
}

const groupByProject = (topics: LocalChatTopic[], sortBy: TopicSortBy): TopicGroup[] => {
  const groups = new Map<string | null, LocalChatTopic[]>()
  for (const topic of topics) {
    groups.set(topic.projectName, [...(groups.get(topic.projectName) ?? []), topic])
  }

  return [...groups.entries()]
    .map(([projectName, items]) => ({
      id: projectName === null ? 'no-project' : `project:${projectName}`,
      title: projectName ?? '无项目',
      topics: sortTopics(items, sortBy),
    }))
    .sort((left, right) => {
      if (left.id === 'no-project') return 1
      if (right.id === 'no-project') return -1
      return getSortTime(right.topics[0]!, sortBy) - getSortTime(left.topics[0]!, sortBy)
    })
}

export const organizeTopics = (
  topics: LocalChatTopic[],
  groupMode: TopicGroupMode,
  sortBy: TopicSortBy,
  now = Date.now(),
  limit = Number.POSITIVE_INFINITY
): TopicGroup[] => {
  const orderedTopics = [
    ...sortTopics(
      topics.filter((topic) => topic.favorite),
      sortBy
    ),
    ...sortTopics(
      topics.filter((topic) => !topic.favorite),
      sortBy
    ),
  ].slice(0, limit)
  const favorites = orderedTopics.filter((topic) => topic.favorite)
  const regular = orderedTopics.filter((topic) => !topic.favorite)

  if (groupMode === 'flat') {
    return [
      {
        id: 'flat',
        title: '',
        topics: orderedTopics,
      },
    ]
  }

  const groups = groupMode === 'byProject' ? groupByProject(regular, sortBy) : groupByTime(regular, sortBy, now)
  if (favorites.length === 0) return groups

  return [{ id: 'favorite', title: '收藏', topics: sortTopics(favorites, sortBy) }, ...groups]
}
