import { createStaticStyles } from '@lobehub/ui'
import { Minus, Plus, X } from 'lucide-react'

const styles = createStaticStyles(({ css }) => ({
  root: css`
    position: relative;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-inline-end: 8px;
    padding-inline: 4px;
    -webkit-app-region: no-drag;

    &:hover button svg,
    &:focus-within button svg {
      opacity: 1;
    }
  `,
  button: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    cursor: pointer;
    -webkit-app-region: no-drag;

    & svg {
      width: 10px;
      height: 10px;
      color: rgb(0 0 0 / 55%);
      opacity: 0;
      pointer-events: none;
      stroke-width: 4;
    }
  `,
}))

type MacTrafficLightsProps = {
  isMaximized: boolean
  onClose: () => void
  onMaximize: () => void
  onMinimize: () => void
}

const MacTrafficLights = ({ isMaximized, onClose, onMaximize, onMinimize }: MacTrafficLightsProps) => (
  <div className={styles.root}>
    <button
      aria-label='关闭窗口'
      className={`${styles.button} bg-[#ff5f57]`}
      onClick={(_event) => onClose()}
      type='button'
    >
      <X />
    </button>
    <button
      aria-label='最小化窗口'
      className={`${styles.button} bg-[#febc2e]`}
      onClick={(_event) => onMinimize()}
      type='button'
    >
      <Minus />
    </button>
    <button
      aria-label={isMaximized ? '还原窗口' : '最大化窗口'}
      className={`${styles.button} bg-[#28c840]`}
      onClick={(_event) => onMaximize()}
      type='button'
    >
      <Plus />
    </button>
  </div>
)

export default MacTrafficLights
