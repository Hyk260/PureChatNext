import { ImageResponse } from 'next/og'

import { SITE_DESCRIPTION, SITE_NAME } from '@/const/site'

export const alt = 'PureChat — 把你的 AI 助手接入微信和 QQ'
export const size = { height: 630, width: 1200 }
export const contentType = 'image/png'

const OpenGraphImage = () => {
  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background:
          'radial-gradient(circle at 15% 15%, rgba(76, 129, 255, 0.32), transparent 38%), radial-gradient(circle at 90% 80%, rgba(67, 208, 160, 0.2), transparent 35%), #090b12',
        color: '#ffffff',
        display: 'flex',
        height: '100%',
        justifyContent: 'center',
        padding: '72px 84px',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, width: '100%' }}>
        <div style={{ alignItems: 'center', display: 'flex', gap: 18 }}>
          <div
            style={{
              alignItems: 'center',
              background: 'linear-gradient(145deg, #ffffff, #9bb8ff)',
              borderRadius: 22,
              color: '#12182a',
              display: 'flex',
              fontSize: 42,
              fontWeight: 800,
              height: 76,
              justifyContent: 'center',
              width: 76,
            }}
          >
            P
          </div>
          <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em' }}>{SITE_NAME}</div>
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.28)',
              borderRadius: 999,
              color: '#b7c9ff',
              display: 'flex',
              fontSize: 22,
              padding: '9px 18px',
            }}
          >
            Open Source · Self-hosted
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 72,
            fontWeight: 800,
            letterSpacing: '-0.045em',
            lineHeight: 1.15,
            maxWidth: 960,
          }}
        >
          把你的 AI 助手接入微信和 QQ
        </div>
        <div style={{ color: '#b9c0d3', display: 'flex', fontSize: 28, lineHeight: 1.45, maxWidth: 980 }}>
          {SITE_DESCRIPTION}
        </div>
        <div style={{ color: '#87a7ff', display: 'flex', fontSize: 24, gap: 24 }}>
          <span>多模型</span>
          <span>联网搜索</span>
          <span>文件处理</span>
          <span>私有部署</span>
        </div>
      </div>
    </div>,
    size
  )
}

export default OpenGraphImage
