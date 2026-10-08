import { createStaticStyles } from 'antd-style'
import { Copy, Minus, Square, X } from 'lucide-react'

const styles = createStaticStyles(({ css }) => ({
  root: css`
    display: flex;
    height: 100%;
    -webkit-app-region: no-drag;
  `,
  button: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 100%;
    padding: 0;
    color: var(--ant-color-text-secondary, #666);
    background: transparent;
    border: 0;
    cursor: pointer;

    &:hover {
      color: var(--ant-color-text, #1f1f1f);
      background: var(--ant-color-fill-secondary, #f0f0f0);
    }
  `,
  closeButton: css`
    &:hover {
      color: #fff;
      background: #e81123;
    }
  `,
}))

type DesktopWindowControlsProps = {
  isMaximized: boolean
  onClose: () => void
  onMinimize: () => void
  onToggleMaximize: () => void
}

const DesktopWindowControls = ({
  isMaximized,
  onClose,
  onMinimize,
  onToggleMaximize,
}: DesktopWindowControlsProps) => (
  <div className={styles.root}>
    <button
      aria-label='最小化窗口'
      className={styles.button}
      onClick={(_event) => onMinimize()}
      type='button'
    >
      <Minus size={14} />
    </button>
    <button
      aria-label={isMaximized ? '还原窗口' : '最大化窗口'}
      className={styles.button}
      onClick={(_event) => onToggleMaximize()}
      type='button'
    >
      {isMaximized ? <Copy size={13} /> : <Square size={13} />}
    </button>
    <button
      aria-label='关闭窗口'
      className={`${styles.button} ${styles.closeButton}`}
      onClick={(_event) => onClose()}
      type='button'
    >
      <X size={15} />
    </button>
  </div>
)

export default DesktopWindowControls