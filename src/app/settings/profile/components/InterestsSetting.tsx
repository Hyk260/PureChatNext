'use client'

import { Block, Flexbox, Icon, Input, Text } from '@lobehub/ui'
import { cssVar } from 'antd-style'
import { BriefcaseIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { message } from '@/components/AntdStaticMethods'
import {
  INTEREST_AREAS,
  normalizeInterestsForStorage,
  resolveInterestAreaKey,
  type InterestAreaKey,
} from '@/features/settings/const/interests'

import { patchUserProfile } from './patchUserProfile'
import { SettingRow } from './SettingRow'

interface InterestsSettingProps {
  interests: string[]
  onUpdated: (interests: string[]) => void
}

export function InterestsSetting({ interests, onUpdated }: InterestsSettingProps) {
  const [customInput, setCustomInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [saving, setSaving] = useState(false)
  const normalizedInterests = useMemo(() => normalizeInterestsForStorage(interests), [interests])

  const saveInterests = useCallback(
    async (updated: string[]) => {
      setSaving(true)
      try {
        const result = await patchUserProfile({ interests: updated })
        onUpdated(result.interests)
      } catch (error) {
        message.error(error instanceof Error ? error.message : '兴趣领域更新失败')
      } finally {
        setSaving(false)
      }
    },
    [onUpdated],
  )

  const toggleInterest = useCallback(
    async (key: InterestAreaKey) => {
      if (saving) return
      const updated = normalizedInterests.includes(key)
        ? normalizedInterests.filter((item) => item !== key)
        : [...normalizedInterests, key]
      await saveInterests(updated)
    },
    [normalizedInterests, saveInterests, saving],
  )

  const removeCustomInterest = useCallback(
    async (interest: string) => {
      if (saving) return
      await saveInterests(normalizedInterests.filter((item) => item !== interest))
    },
    [normalizedInterests, saveInterests, saving],
  )

  const handleAddCustom = useCallback(async () => {
    const trimmed = customInput.trim()
    if (!trimmed || normalizedInterests.includes(trimmed) || saving) return

    setCustomInput('')
    await saveInterests([...normalizedInterests, trimmed])
  }, [customInput, normalizedInterests, saveInterests, saving])

  return (
    <SettingRow label="兴趣领域">
      <Flexbox gap={12} style={{ opacity: saving ? 0.7 : 1, pointerEvents: saving ? 'none' : 'auto' }}>
        <Flexbox align="center" gap={8} horizontal wrap="wrap">
          {INTEREST_AREAS.map((item) => {
            const isSelected = normalizedInterests.includes(item.key)
            return (
              <Block
                clickable
                gap={8}
                horizontal
                key={item.key}
                onClick={() => toggleInterest(item.key)}
                padding={8}
                style={
                  isSelected
                    ? {
                        background: cssVar.colorFillSecondary,
                        borderColor: cssVar.colorFillSecondary,
                      }
                    : undefined
                }
                variant="outlined"
              >
                <Icon color={cssVar.colorTextSecondary} icon={item.icon} size={14} />
                <Text fontSize={13} weight={500}>
                  {item.label}
                </Text>
              </Block>
            )
          })}
          {normalizedInterests
            .filter((item) => !resolveInterestAreaKey(item))
            .map((interest) => (
              <Block
                clickable
                key={interest}
                onClick={() => removeCustomInterest(interest)}
                padding={8}
                style={{
                  background: cssVar.colorFillSecondary,
                  borderColor: cssVar.colorFillSecondary,
                }}
                variant="outlined"
              >
                <Text fontSize={13} weight={500}>
                  {interest}
                </Text>
              </Block>
            ))}
          <Block
            clickable
            gap={8}
            horizontal
            onClick={() => setShowCustomInput((current) => !current)}
            padding={8}
            style={
              showCustomInput
                ? { background: cssVar.colorFillSecondary, borderColor: cssVar.colorFillSecondary }
                : undefined
            }
            variant="outlined"
          >
            <Icon color={cssVar.colorTextSecondary} icon={BriefcaseIcon} size={14} />
            <Text fontSize={13} weight={500}>
              其他领域
            </Text>
          </Block>
        </Flexbox>
        {showCustomInput ? (
          <Input
            onChange={(event) => setCustomInput(event.target.value)}
            onPressEnter={handleAddCustom}
            placeholder="输入自定义兴趣后按回车"
            size="small"
            style={{ width: 200 }}
            value={customInput}
          />
        ) : null}
      </Flexbox>
    </SettingRow>
  )
}
