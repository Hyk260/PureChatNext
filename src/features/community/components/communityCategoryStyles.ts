import { createStaticStyles, cssVar } from 'antd-style'

export const communityCategoryStyles = createStaticStyles(({ css }) => ({
  count: css`
    margin-inline-start: auto;
  `,
  item: css`
    cursor: pointer;
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: ${cssVar.colorTextSecondary};
    font-size: 14px;
    text-align: left;
    transition:
      background 0.15s ease,
      color 0.15s ease;

    &:hover {
      background: ${cssVar.colorFillSecondary};
      color: ${cssVar.colorText};
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: -2px;
    }
  `,
  active: css`
    && {
      background: ${cssVar.colorPrimaryBg};
      color: ${cssVar.colorPrimaryText};
    }

    &&:hover {
      background: ${cssVar.colorPrimaryBgHover};
    }
  `,
  root: css`
    flex: none;
    width: 220px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  `,
}))
