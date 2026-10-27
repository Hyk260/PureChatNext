import { createStaticStyles, cssVar } from '@lobehub/ui'

// These exact theme colors and logical border have no equivalent application Tailwind token.
export const communityCardStyles = createStaticStyles(({ css }) => ({
  desc: css`
    color: ${cssVar.colorTextSecondary};
  `,
  footer: css`
    border-block-start: 1px dashed ${cssVar.colorBorder};
  `,
  secondaryDesc: css`
    color: ${cssVar.colorTextDescription};
  `,
}))
