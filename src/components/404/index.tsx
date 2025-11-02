'use client';

import { Button, FluentEmoji } from '@lobehub/ui';
import Link from 'next/link';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

const NotFound = memo(() => {
  return (
    <Flexbox align={'center'} justify={'center'} style={{ minHeight: '100%', width: '100%' }}>
      <h1
        style={{
          filter: 'blur(8px)',
          fontSize: `min(${1440 / 3}px, 50vw)`,
          fontWeight: 'bolder',
          margin: 0,
          opacity: 0.12,
          position: 'absolute',
          zIndex: 0,
        }}
      >
        404
      </h1>
      <FluentEmoji emoji={'👀'} size={64} />
      <h2 style={{ fontWeight: 'bold', marginTop: '1em', textAlign: 'center' }}>
        404
      </h2>
      <p style={{ lineHeight: '1.8', marginBottom: '2em' }}>
        页面不存在
        <br />
        <span style={{ textAlign: 'center', display: 'block' }}>请检查您的输入</span>
      </p>
      <Link href="/">
        <Button type={'primary'}>返回首页</Button>
      </Link>
    </Flexbox>
  );
});

NotFound.displayName = 'NotFound';

export default NotFound;
