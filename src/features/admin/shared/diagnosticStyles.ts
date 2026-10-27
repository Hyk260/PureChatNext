import { createStaticStyles } from '@lobehub/ui'

// Shared drop targets retain their hover / drag states without exceeding className limits.
export const diagnosticStyles = createStaticStyles(({ css }) => ({
  dropzone: css`
    cursor: pointer;
    background-color: var(--secondary);
    border: 1px dashed var(--border);

    @media (hover: hover) {
      &:not([data-dragging='true']):hover {
        background-color: var(--hover);
        border-color: var(--primary);
      }
    }

    &[data-dragging='true'] {
      border-color: var(--primary);
    }
  `,
}))
