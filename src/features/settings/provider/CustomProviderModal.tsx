'use client'

import { Flex, Input, InputPassword, Modal, Select, Text, TextArea } from '@pure/ui'
import { memo, useEffect, useState } from 'react'

import type { CustomProviderInput } from './customProvidersApi'

interface CustomProviderModalProps {
  existingProviderIds: string[]
  loading?: boolean
  open: boolean
  onCancel: () => void
  onCreate: (provider: CustomProviderInput) => void
}

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.hash && !url.search
  } catch {
    return false
  }
}

const CustomProviderModal = memo<CustomProviderModalProps>(
  ({ existingProviderIds, loading = false, onCancel, onCreate, open }) => {
    const [id, setId] = useState('')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [logo, setLogo] = useState('')
    const [baseURL, setBaseURL] = useState('')
    const [apiKey, setApiKey] = useState('')

    useEffect(() => {
      if (!open) return
      setId('')
      setName('')
      setDescription('')
      setLogo('')
      setBaseURL('')
      setApiKey('')
    }, [open])

    const normalizedId = id.trim().toLowerCase()
    const duplicate = existingProviderIds.includes(normalizedId)
    const validId =
      /^[a-z0-9][a-z0-9_-]{0,31}$/.test(normalizedId) &&
      !['__proto__', 'constructor', 'prototype'].includes(normalizedId)
    const validBaseURL = isHttpUrl(baseURL.trim())
    const validLogo = !logo.trim() || isHttpUrl(logo.trim())
    const canCreate = validId && !duplicate && name.trim().length > 0 && validBaseURL && validLogo && !loading

    const duplicateMessage = duplicate ? `服务商 ID「${normalizedId}」已存在` : null

    const handleCreate = () => {
      if (!canCreate) return
      onCreate({
        apiKey: apiKey.trim() || undefined,
        baseURL: baseURL.trim().replace(/\/+$/, ''),
        description: description.trim(),
        id: normalizedId,
        logo: logo.trim() || undefined,
        name: name.trim(),
      })
    }

    return (
      <Modal
        cancelText='取消'
        confirmLoading={loading}
        destroyOnHidden
        okButtonProps={{ disabled: !canCreate }}
        okText='新建'
        open={open}
        title='创建自定义 AI 服务商'
        width={720}
        onCancel={onCancel}
        onOk={handleCreate}
      >
        <Flex className='max-h-[70vh] w-full flex-col gap-5 overflow-y-auto py-2'>
          <Text className='text-sm font-medium' type='secondary'>
            基本信息
          </Text>
          <Flex className='w-full flex-col gap-1.5'>
            <Text className='font-medium'>服务商 ID *</Text>
            <Input
              autoFocus
              maxLength={32}
              placeholder='例如 openrouter、siliconflow'
              value={id}
              onChange={(event) => setId(event.target.value.toLowerCase())}
            />
            <Text type='secondary'>只允许小写字母、数字、下划线和连字符，创建后不可修改。</Text>
            {duplicateMessage ? <Text type='danger'>{duplicateMessage}</Text> : null}
            {id && !validId ? <Text type='danger'>ID 必须以字母或数字开头，长度不超过 32 位。</Text> : null}
          </Flex>

          <Flex className='w-full flex-col gap-1.5'>
            <Text className='font-medium'>服务商名称 *</Text>
            <Input
              maxLength={128}
              placeholder='请输入服务商的展示名称'
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Flex>

          <Flex className='w-full flex-col gap-1.5'>
            <Text className='font-medium'>服务商简介</Text>
            <TextArea
              maxLength={1000}
              placeholder='服务商简介（选填）'
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Flex>

          <Flex className='w-full flex-col gap-1.5'>
            <Text className='font-medium'>服务商 Logo</Text>
            <Input
              placeholder='https://example.com/logo.png'
              value={logo}
              onChange={(event) => setLogo(event.target.value)}
            />
            {!validLogo ? <Text type='danger'>Logo 必须是有效的 http(s) 地址。</Text> : null}
          </Flex>

          <Text className='pt-2 text-sm font-medium' type='secondary'>
            配置信息
          </Text>
          <Flex className='w-full flex-col gap-1.5'>
            <Text className='font-medium'>请求格式 *</Text>
            <Select
              className='w-full'
              disabled
              options={[{ label: 'OpenAI 兼容', value: 'openai' }]}
              value='openai'
            />
            <Text type='secondary'>当前版本支持 OpenAI Chat Completions 兼容接口。</Text>
          </Flex>

          <Flex className='w-full flex-col gap-1.5'>
            <Text className='font-medium'>代理地址 *</Text>
            <Input
              placeholder='https://your-proxy-url.com/v1'
              value={baseURL}
              onChange={(event) => setBaseURL(event.target.value)}
            />
            {baseURL && !validBaseURL ? <Text type='danger'>请输入有效的 http(s) 地址。</Text> : null}
          </Flex>

          <Flex className='w-full flex-col gap-1.5'>
            <Text className='font-medium'>API Key</Text>
            <InputPassword
              autoComplete='off'
              placeholder='请填写你的 API Key（选填）'
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </Flex>
        </Flex>
      </Modal>
    )
  }
)

CustomProviderModal.displayName = 'CustomProviderModal'

export default CustomProviderModal
