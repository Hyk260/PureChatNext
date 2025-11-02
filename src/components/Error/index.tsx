'use client';

import { Button, FluentEmoji } from '@lobehub/ui';
import Link from 'next/link';
import { memo, useLayoutEffect } from 'react';
import { Flexbox } from 'react-layout-kit';

interface ErrorCaptureProps {
  error: Error;
  reset: () => void;
}

const ErrorCapture = memo<ErrorCaptureProps>(({ reset, error }) => {

  useLayoutEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Flexbox align={'center'} justify={'center'} style={{ minHeight: '100%', width: '100%' }}>
      <h1
        style={{
          filter: 'blur(8px)',
          fontSize: `min(${1440 / 6}px, 25vw)`,
          fontWeight: 900,
          margin: 0,
          opacity: 0.12,
          position: 'absolute',
          zIndex: 0,
        }}
      >
        ERROR
      </h1>
      <FluentEmoji emoji={'🤧'} size={64} />
      <h2 style={{ fontWeight: 'bold', marginTop: '1em', textAlign: 'center' }}>
        错误
      </h2>
      <p style={{ marginBottom: '2em' }}>错误描述</p>
      <Flexbox gap={12} horizontal style={{ marginBottom: '1em' }}>
        <Button onClick={() => reset()}>重试</Button>
        <Link href="/">
          <Button type={'primary'}>返回首页</Button>
        </Link>
      </Flexbox>
    </Flexbox>
  );
});

ErrorCapture.displayName = 'ErrorCapture';

export default ErrorCapture;
