'use client'

import { ActionIcon, confirmModal, Flex, Text } from '@pure/ui'
import { toast, createStaticStyles, cssVar } from '@lobehub/ui'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { memo } from 'react'

import { getSettingsProviderMeta } from './const'
import { deleteCustomProvider } from './customProvidersApi'
import ProviderMark from './ProviderMark'
import { providerDetailStyles as styles } from './styles'
import type { ProviderId } from './types'
import ModelList from './features/ModelList'
import ProviderConfig from './features/ProviderConfig'
import { useProviderConfigStore } from './store/useProviderConfigStore'
import { useCustomProviderRegistry } from './useCustomProviderRegistry'
import { useProviderSecrets } from './secretsApi'
import { useHomeStore } from '@/features/home/store/useHomeStore'
import { DEFAULT_HOME_MODEL } from '@/const/home/models'
interface ProviderDetailPageProps {
  id: ProviderId
}

const localStyles = createStaticStyles(({ css }) => ({
  mobileHeader: css`
    display: none;

    @media (max-width: 768px) {
      display: flex;
      position: sticky;
      z-index: 20;
      inset-block-start: 0;
      padding-block: 8px;
      background: ${cssVar.colorBgContainer};
      border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    }
  `,
}))

const ProviderDetailPage = memo<ProviderDetailPageProps>(({ id }) => {
  const router = useRouter()
  const registry = useCustomProviderRegistry()
  const customProviders = useProviderConfigStore((state) => state.customProviders)
  const removeCustomProvider = useProviderConfigStore((state) => state.removeCustomProvider)
  const selectedProvider = useHomeStore((state) => state.selectedProvider)
  const setSelectedModel = useHomeStore((state) => state.setSelectedModel)
  const { mutate: mutateSecrets } = useProviderSecrets()
  const availableCustomProviders = registry.data ?? customProviders
  const customProvider = availableCustomProviders.find((provider) => provider.id === id)
  const meta = getSettingsProviderMeta(id, availableCustomProviders)

  const handleDelete = () => {
    if (!customProvider) return
    confirmModal({
      cancelText: '取消',
      content: `删除「${meta.name}」会同时清除 API Key、模型列表、模型选择和历史会话中的服务商信息；聊天正文会保留。`,
      okButtonProps: { danger: true },
      okText: '删除服务商',
      title: '删除自定义服务商？',
      onOk: async () => {
        try {
          await deleteCustomProvider(id)
          const nextProviders = availableCustomProviders.filter((provider) => provider.id !== id)
          await registry.mutate(nextProviders, { revalidate: false })
          removeCustomProvider(id)
          await mutateSecrets((items) => (items ?? []).filter((item) => item.providerId !== id), { revalidate: false })
          if (selectedProvider === id) setSelectedModel(DEFAULT_HOME_MODEL.provider, DEFAULT_HOME_MODEL.model)
          toast.success(`已删除服务商 ${meta.name}`)
          router.push('/settings/provider/all')
        } catch (error) {
          toast.error(error instanceof Error ? error.message : '删除服务商失败')
        }
      },
    })
  }

  return (
    <Flex className={[styles.page, 'flex-col gap-6 w-full']}>
      {customProvider ? (
        <Flex className='hidden w-full items-center justify-between md:flex'>
          <Flex className='items-center gap-3'>
            <ProviderMark combined id={id} logo={meta.logo} name={meta.name} size={32} />
            <Flex className='flex-col gap-0.5'>
              <Text strong>{meta.name}</Text>
              <Text className='text-[12px]' type='secondary'>
                {id}
              </Text>
            </Flex>
          </Flex>
          <ActionIcon
            aria-label='删除自定义服务商'
            icon={Trash2}
            size='small'
            title='删除自定义服务商'
            onClick={handleDelete}
          />
        </Flex>
      ) : null}
      <Flex className={[localStyles.mobileHeader, 'items-center gap-2']}>
        <ActionIcon
          aria-label='返回全部服务商'
          icon={ArrowLeft}
          size='small'
          title='返回全部服务商'
          onClick={() => router.push('/settings/provider/all')}
        />
        <ProviderMark id={id} logo={meta.logo} name={meta.name} size={20} />
        <Text strong>{meta.name}</Text>
        {customProvider ? (
          <ActionIcon
            aria-label='删除自定义服务商'
            className='ml-auto'
            icon={Trash2}
            size='small'
            title='删除自定义服务商'
            onClick={handleDelete}
          />
        ) : null}
      </Flex>
      <ProviderConfig id={id} />
      <ModelList id={id} />
    </Flex>
  )
})

ProviderDetailPage.displayName = 'ProviderDetailPage'

export default ProviderDetailPage
