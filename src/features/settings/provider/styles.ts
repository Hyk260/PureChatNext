import { createStaticStyles, cssVar } from 'antd-style'

export const providerDetailStyles = createStaticStyles(({ css }) => ({
  hint: css`
    font-size: 12px;
    color: ${cssVar.colorTextDescription};
    text-align: center;
    opacity: 0.66;
  `,
  page: css`
    width: 100%;
    max-width: 1024px;
    margin-inline: auto;
    padding-block: 24px 64px;
    padding-inline: 24px;
  `,
  row: css`
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
    width: 100%;
    padding-block: 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  rowBody: css`
    flex: none;
    width: min(360px, 48%);
  `,
  rowLabel: css`
    flex: 1;
    min-width: 0;
  `,
}))
