/**
 * MobileKeyboardAdapter — 移动端输入适配层
 *
 * 通过聚焦 xterm 内置的 textarea（.xterm-helper-textarea）触发虚拟键盘，
 * 利用 xterm 原生 IME 支持实现中文候选字在光标位置正确显示。
 * 监听 visualViewport 动态调整终端容器高度防止键盘遮挡。
 *
 * **Event priority coordination with GestureHandler:**
 * Both classes register listeners on the same terminal container.
 * Conflict resolution:
 * - `suppressNextFocus` flag (set by GestureHandler via `setSuppressFocus`)
 *   prevents this adapter from stealing focus during pinch gestures.
 * - `handleContainerTouch` checks `e.touches.length >= 2` to skip focus
 *   when multi-touch (pinch) is in progress.
 */

export class MobileKeyboardAdapter {
  private xtermTextarea: HTMLTextAreaElement | null = null
  private onResize: (height: number) => void
  private container: HTMLElement | null = null
  private suppressNextFocus = false
  private boundHandlers: {
    visualViewportResize: () => void
    containerClick: (e: MouseEvent) => void
    containerTouch: (e: TouchEvent) => void
  }

  constructor(_onData: (data: string) => void, onResize: (height: number) => void) {
    // onData is no longer needed — xterm's textarea sends input through
    // term.onData() which is already wired to sendInput() in TerminalContainer.
    this.onResize = onResize

    this.boundHandlers = {
      visualViewportResize: this.handleViewportResize.bind(this),
      containerClick: this.handleContainerClick.bind(this),
      containerTouch: this.handleContainerTouch.bind(this),
    }
  }

  /**
   * Set the xterm textarea reference. Called after terminal.open().
   * We use term.textarea (xterm's internal helper textarea) which has
   * native IME composition support — composing text (pinyin) appears
   * inline at the cursor position in the terminal.
   */
  setXtermTextarea(textarea: HTMLTextAreaElement): void {
    this.xtermTextarea = textarea
  }

  attach(container: HTMLElement): void {
    this.container = container

    // visualViewport resize — keyboard open/close
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.boundHandlers.visualViewportResize)
    }

    // Click/touch on terminal area → focus xterm textarea → trigger virtual keyboard
    container.addEventListener('click', this.boundHandlers.containerClick)
    container.addEventListener('touchend', this.boundHandlers.containerTouch)
  }

  detach(): void {
    if (this.container) {
      this.container.removeEventListener('click', this.boundHandlers.containerClick)
      this.container.removeEventListener('touchend', this.boundHandlers.containerTouch)
      this.container = null
    }

    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.boundHandlers.visualViewportResize)
    }
  }

  setSuppressFocus(suppress: boolean): void {
    this.suppressNextFocus = suppress
  }

  focus(): void {
    if (!this.xtermTextarea) return
    // iOS Safari: use setTimeout to avoid blur/focus conflict
    setTimeout(() => {
      this.xtermTextarea?.focus()
    }, 10)
  }

  blur(): void {
    this.xtermTextarea?.blur()
  }

  destroy(): void {
    this.detach()
    this.xtermTextarea = null
  }

  // --- Private handlers ---

  private handleViewportResize(): void {
    if (!window.visualViewport) return
    const keyboardHeight = window.innerHeight - window.visualViewport.height
    this.onResize(keyboardHeight)
  }

  private handleContainerClick(_e: MouseEvent): void {
    if (this.suppressNextFocus) {
      this.suppressNextFocus = false
      return
    }
    this.focus()
  }

  private handleContainerTouch(e: TouchEvent): void {
    if (e.touches.length >= 2 || this.suppressNextFocus) {
      this.suppressNextFocus = false
      return
    }
    this.focus()
  }
}
