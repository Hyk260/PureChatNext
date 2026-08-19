import { useEffect, useState } from 'react'

import { getDesktopApi } from '@/types/desktop'

const DesktopServerSetup = () => {
  const api = getDesktopApi()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(Boolean(api))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!api) return
    void api.getRemoteServer().then((config) => {
      setUrl(config.url ?? '')
      setLoading(false)
    })
  }, [api])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!api) return
    setSaving(true)
    setError('')
    try {
      await api.setRemoteServer(url)
      window.location.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存远程服务地址失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main style={styles.center}>正在加载桌面配置…</main>

  return (
    <main style={styles.center}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h1 style={styles.title}>连接 PureChat 服务</h1>
        <p style={styles.description}>请输入 PureChatNext 服务地址，桌面端将通过该地址访问账号和聊天 API。</p>
        <label style={styles.label}>
          服务地址
          <input
            autoComplete='url'
            onChange={(event) => setUrl(event.target.value)}
            placeholder='https://chat.example.com'
            style={styles.input}
            type='url'
            value={url}
          />
        </label>
        {error ? <p style={styles.error}>{error}</p> : null}
        <button disabled={saving} style={styles.button} type='submit'>
          {saving ? '保存中…' : '连接'}
        </button>
      </form>
    </main>
  )
}

const styles = {
  button: {
    background: '#1677ff',
    border: 0,
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    padding: '10px 16px',
  },
  center: {
    alignItems: 'center',
    background: '#f8f8f8',
    display: 'flex',
    height: '100vh',
    justifyContent: 'center',
  },
  description: { color: '#666', lineHeight: 1.6, margin: '0 0 24px' },
  error: { color: '#d4380d', fontSize: 13, margin: '12px 0' },
  form: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 8px 32px #00000012',
    maxWidth: 460,
    padding: 32,
    width: 'calc(100% - 48px)',
  },
  input: {
    border: '1px solid #d9d9d9',
    borderRadius: 8,
    boxSizing: 'border-box' as const,
    fontSize: 14,
    marginTop: 8,
    padding: '10px 12px',
    width: '100%',
  },
  label: { color: '#333', display: 'block', fontSize: 14 },
  title: { fontSize: 24, margin: '0 0 12px' },
}

export default DesktopServerSetup
