'use client'

import { communityCardStyles } from './cardStyles'

import { Block, Icon, ModelIcon, ProviderIcon, Text, Flex } from '@pure/ui'
import { formatDate } from '@pure/utils/client'
import { cx } from '@lobehub/ui'
import { ClockIcon } from 'lucide-react'
import { memo } from 'react'

import ModelFeatureTags from '@/features/community/components/ModelFeatureTags'
import ModelTypeIcon from '@/features/community/components/ModelTypeIcon'
import type { DiscoverModelItem } from '@/features/community/types'

const ModelCard = memo<DiscoverModelItem>(
  ({ abilities, contextWindowTokens, description, displayName, identifier, providers, releasedAt, type }) => {
    return (
      <Block
        data-testid='model-item'
        className='flex flex-col'
        height='100%'
        variant='outlined'
        width='100%'
        style={{
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Flex className='items-start gap-4 justify-between p-4 w-full'>
          <Flex className='gap-3 overflow-hidden' title={identifier}>
            <ModelIcon model={identifier} size={40} style={{ flex: 'none' }} type='avatar' />
            <Flex className='flex-col flex-1 gap-0.5 overflow-hidden'>
              <Text ellipsis className={'!m-0 !text-base !font-medium'}>
                {displayName}
              </Text>
              <div className={communityCardStyles.secondaryDesc}>{identifier}</div>
            </Flex>
          </Flex>
          <ModelTypeIcon type={type} />
        </Flex>
        <Flex className='flex-col flex-1 gap-3 px-4'>
          <ModelFeatureTags abilities={abilities} contextWindowTokens={contextWindowTokens} />
          {description ? (
            <Text
              as='p'
              className={cx(communityCardStyles.desc, 'flex-1 !m-0')}
              ellipsis={{
                rows: 3,
              }}
            >
              {description}
            </Text>
          ) : null}
        </Flex>
        <Flex className={[cx(communityCardStyles.footer, 'mt-4 bg-app-surface'), 'flex-between p-4']}>
          <Flex className={[cx(communityCardStyles.secondaryDesc, 'text-xs'), 'items-center gap-1']}>
            {releasedAt ? (
              <>
                <Icon icon={ClockIcon} size={14} />
                <span>{formatDate(releasedAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </>
            ) : null}
          </Flex>
          <Flex className='items-center gap-1.5'>
            {providers.slice(0, 6).map((item) => (
              <ProviderIcon key={item} provider={item} size={14} type='mono' />
            ))}
          </Flex>
        </Flex>
      </Block>
    )
  }
)

ModelCard.displayName = 'ModelCard'

export default ModelCard
