'use client'

import { memo, useCallback, useState } from 'react'

import { Flex, TypewriterEffect } from '@pure/ui'
import { sessionStg } from '@pure/utils/storage'
import HomeChatInput from '@/features/home/components/HomeChatInput'

const HOME_WELCOME_TYPEWRITER_INDEX_KEY = 'purechat.home.welcome-typewriter-index'

const welcomeMessages = {
  '1': '欢迎回来 👋',
  '2': '嗨，我在呢 😊',
  '3': '我已就绪 ✨',
  '4': '很高兴见到你 🌷',
  '5': '准备开始了吗 🚀',
  '6': '今日事，我来帮 💪',
  '7': '继续前行吧 🌱',
  '8': '一起推进吧 🤝',
  '9': '开工咯 ☀️',
  '10': '状态就绪 ✅',
  '11': '听候差遣 🙌',
  '12': '久等了 👋',
  '13': '开始行动吧 🚀',
  '14': '带着新问题来了吧 💡',
  '15': '今天也辛苦啦 🌼',
  '16': '灵感加载中 💭',
  '17': '已就绪 ✨',
  '18': '开始吧 🎉',
  '19': '我的思绪已跟上节奏 🎯',
  '20': '灵感即将出现 ✨',
  '21': '只等你的召唤 🔔',
  '22': '再启动高效模式 ⚡',
  '23': '已进入待命状态 🟢',
  '24': '准备迎接挑战 🧗',
  '25': '新思路正在生成中 🧠',
  '26': '前路清晰，启程 🧭',
  '27': '系统在线，随时帮你 🤖',
  '28': '努力加载好心情 🌈',
  '29': '掌控节奏，从现在开始 🎵',
  '30': '效率提升中 📈',
  '31': '今日目标，稳步达成 🎯',
  '32': '让灵感多一点闪光 ✨',
  '33': '任务更新完成 ✅',
  '34': '一切准备就绪 🛠️',
  '35': '加速度模式启动 ⚡',
  '36': '嗯！我们开始吧 🙌',
  '37': '我在这儿。需要时随时叫我 👋',
  '38': '继续保持好状态 🌟',
  '39': '记得休息一下 ☕',
} as const

const welcomeSentences = Object.values(welcomeMessages)

const getSavedWelcomeSentenceIndex = () => {
  const savedIndex = Number(sessionStg.getString(HOME_WELCOME_TYPEWRITER_INDEX_KEY))

  if (!Number.isInteger(savedIndex) || savedIndex < 0 || savedIndex >= welcomeSentences.length) return 0

  return savedIndex
}

const getWelcomeSentencesFrom = (index: number) => [
  ...welcomeSentences.slice(index),
  ...welcomeSentences.slice(0, index),
]

const HomeContent = memo(() => {
  const [welcomeStartIndex] = useState(getSavedWelcomeSentenceIndex)
  const sentences = getWelcomeSentencesFrom(welcomeStartIndex)

  const handleSentenceComplete = useCallback(
    (_sentence: string, index: number) => {
      const nextIndex = (welcomeStartIndex + index + 1) % welcomeSentences.length
      sessionStg.setString(HOME_WELCOME_TYPEWRITER_INDEX_KEY, String(nextIndex))
    },
    [welcomeStartIndex]
  )

  return (
    <Flex className='w-full flex-col gap-6'>
      <Flex className='flex-col-center'>
        <TypewriterEffect
          className='text-base font-medium text-primary'
          cursorClassName='text-primary'
          pauseDuration={12400}
          deletePauseDuration={500}
          hideCursorWhileTyping='afterTyping'
          typingSpeed={48}
          deletingSpeed={30}
          loop
          onSentenceComplete={handleSentenceComplete}
          sentences={sentences}
        />
      </Flex>
      <HomeChatInput />
    </Flex>
  )
})

HomeContent.displayName = 'HomeContent'

export default HomeContent
