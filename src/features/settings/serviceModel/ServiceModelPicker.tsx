'use client'

import { Button, Flex, Text } from '@pure/ui'
import type { ServiceModelReference } from '@pure/types'
import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import { ChevronDown } from 'lucide-react'

import { useProviderConfigStore } from '@/features/settings/provider/store/useProviderConfigStore'
import { SETTINGS_PROVIDERS } from '@/features/settings/provider/const'
import { useCustomProviderRegistry } from '@/features/settings/provider/useCustomProviderRegistry'
import ModelSwitchMenu from '@/features/chat/ModelSwitchMenu'
import ProviderMark from '@/features/settings/provider/ProviderMark'

export function ServiceModelPicker({
  ability,
  onChange,
  onReset,
  resetLabel,
  unselectedLabel,
  selected,
}: {
  ability?: 'textToSpeech'
  onChange: (model: ServiceModelReference) => void
  onReset?: () => void
  resetLabel?: string
  selected?: ServiceModelReference
  unselectedLabel: string
}) {
  const configs = useProviderConfigStore((state) => state.configs)
  const { data: customProviders = [] } = useCustomProviderRegistry()
  const modelConfig = selected
    ? configs[selected.provider]?.models.find((item) => item.id === selected.model)
    : undefined
  const catalog = selected ? getAiModel(selected.provider as ModelProviderId, selected.model) : undefined
  const modelName = modelConfig?.displayName ?? catalog?.displayName ?? selected?.model
  const selectedCustomProvider = customProviders.find((provider) => provider.id === selected?.provider)
  const providerName = selected
    ? selectedCustomProvider?.name ?? SETTINGS_PROVIDERS.find((provider) => provider.id === selected.provider)?.name ?? selected.provider
    : undefined
  const select = (provider: string, model: string) => {
    const selectedModel = configs[provider]?.models.find((item) => item.id === model)
    const modelCard = getAiModel(provider as ModelProviderId, model)
    onChange({
      model,
      provider,
      ...(selectedModel?.contextWindowTokens ?? modelCard?.contextWindowTokens
        ? { contextWindowTokens: selectedModel?.contextWindowTokens ?? modelCard?.contextWindowTokens }
        : {}),
    })
  }

  return (
    <Flex className='items-center gap-2'>
      <ModelSwitchMenu
        includeCustomProviders
        openOnHover={false}
        placement='bottomRight'
        requiredAbility={ability}
        excludedAbilities={ability ? undefined : ['textToSpeech']}
        selectedModel={selected?.model ?? ''}
        selectedProvider={selected?.provider ?? ''}
        onSelect={select}
      >
        <Button className='min-w-52 justify-between' type='default'>
          {selected && providerName ? (
            <Flex className='min-w-0 items-center gap-2'>
              <ProviderMark
                id={selected.provider}
                logo={customProviders.find((provider) => provider.id === selected.provider)?.logo}
                name={providerName}
                size={18}
              />
              <Text className='truncate'>{modelName}</Text>
              <Text className='shrink-0' type='secondary'>
                {providerName}
              </Text>
            </Flex>
          ) : (
            <Text>{unselectedLabel}</Text>
          )}
          <ChevronDown aria-hidden size={15} />
        </Button>
      </ModelSwitchMenu>
      {onReset && selected ? (
        <Button type='text' onClick={onReset}>
          {resetLabel ?? '重置'}
        </Button>
      ) : null}
    </Flex>
  )
}
