/**
 * MobileKeyboardAdapter — 移动端输入适配层
 *
 * 使用隐藏 <input> + Composition Event 捕获 IME 输入（中日韩），
 * 监听 visualViewport 动态调整终端容器高度防止键盘遮挡。
 *
 * **Event priority coordination with GestureHandler:**
 * Both classes register listeners on the same terminal container.
 * Conflict resolution:
 * - `suppressNextFocus` flag (set by GestureHandler via `setSuppressFocus`)
 *   prevents this adapter from stealing focus during pinch gestures.
 * - `handleContainerTouch` checks `e.touches.length >= 2` to skip focus
 *   when multi-touch (pinch) is in progress.
 * - The `compositionend` handler always fires after `isComposing` is cleared,
 *   so gesture interrupts do not corrupt IME state.
 */

export class MobileKeyboardAdapter {
  private hiddenInput: HTMLInputElement
  private onData: (data: string) => void
  private onResize: (height: number) => void
  private container: HTMLElement | null = null
  private isComposing = false
  private suppressNextFocus = false
  private boundHandlers: {
    compositionstart: () => void
    compositionupdate: (e: Event) => void
    compositionend: (e: CompositionEvent) => void
    input: (e: Event) => void
    visualViewportResize: () => void
    containerClick: (e: MouseEvent) => void
    containerTouch: (e: TouchEvent) => void
  }

  constructor(onData: (data: string) => void, onResize: (height: number) => void) {
    this.onData = onData
    this.onResize = onResize

    this.hiddenInput = document.createElement('input')
    this.hiddenInput.type = 'text'
    this.hiddenInput.setAttribute('autocomplete', 'off')
    this.hiddenInput.setAttribute('autocorrect', 'off')
    this.hiddenInput.setAttribute('autocapitalize', 'off')
    this.hiddenInput.setAttribute('spellcheck', 'false')
    this.hiddenInput.setAttribute('role', 'textbox')
    this.hiddenInput.setAttribute('aria-label', 'Terminal input')
    Object.assign(this.hiddenInput.style, {
      position: 'fixed',
      opacity: '0',
      left: '-9999px',
      top: '0',
      width: '1px',
      height: '1px',
      fontSize: '16px', // prevent iOS zoom
    })

    this.boundHandlers = {
      compositionstart: this.handleCompositionStart.bind(this),
      compositionupdate: this.handleCompositionUpdate.bind(this),
      compositionend: this.handleCompositionEnd.bind(this),
      input: this.handleInput.bind(this),
      visualViewportResize: this.handleViewportResize.bind(this),
      containerClick: this.handleContainerClick.bind(this),
      containerTouch: this.handleContainerTouch.bind(this),
    }
  }

  attach(container: HTMLElement): void {
    this.container = container
    document.body.appendChild(this.hiddenInput)

    // Composition events for IME (CJK input)
    this.hiddenInput.addEventListener('compositionstart', this.boundHandlers.compositionstart)
    this.hiddenInput.addEventListener('compositionupdate', this.boundHandlers.compositionupdate)
    this.hiddenInput.addEventListener('compositionend', this.boundHandlers.compositionend)
    this.hiddenInput.addEventListener('input', this.boundHandlers.input)

    // visualViewport resize — keyboard open/close
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.boundHandlers.visualViewportResize)
    }

    // Click/touch on terminal area → focus hidden input → trigger virtual keyboard
    container.addEventListener('click', this.boundHandlers.containerClick)
    container.addEventListener('touchend', this.boundHandlers.containerTouch)
  }

  detach(): void {
    if (this.container) {
      this.container.removeEventListener('click', this.boundHandlers.containerClick)
      this.container.removeEventListener('touchend', this.boundHandlers.containerTouch)
      this.container = null
    }

    this.hiddenInput.removeEventListener('compositionstart', this.boundHandlers.compositionstart)
    this.hiddenInput.removeEventListener('compositionupdate', this.boundHandlers.compositionupdate)
    this.hiddenInput.removeEventListener('compositionend', this.boundHandlers.compositionend)
    this.hiddenInput.removeEventListener('input', this.boundHandlers.input)

    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.boundHandlers.visualViewportResize)
    }

    if (this.hiddenInput.parentNode) {
      this.hiddenInput.parentNode.removeChild(this.hiddenInput)
    }
  }

  setSuppressFocus(suppress: boolean): void {
    this.suppressNextFocus = suppress
  }

  focus(): void {
    // iOS Safari: use setTimeout to avoid blur/focus conflict
    setTimeout(() => {
      this.hiddenInput.focus()
    }, 10)
  }

  blur(): void {
    this.hiddenInput.blur()
  }

  destroy(): void {
    this.detach()
  }

  // --- Private handlers ---

  private handleCompositionStart(): void {
    this.isComposing = true
  }

  private handleCompositionUpdate(_e: Event): void {
    // Update is tracked via compositionend — nothing to do mid-composition
  }

  private handleCompositionEnd(e: CompositionEvent): void {
    this.isComposing = false
    const text = e.data
    if (text) {
      this.onData(text)
    }
    // Clear the input after composition
    this.hiddenInput.value = ''
  }

  private handleInput(e: Event): void {
    if (this.isComposing) return

    const inputEvent = e as InputEvent
    // Only handle insertText type (plain ASCII input)
    if (inputEvent.inputType === 'insertText' && inputEvent.data) {
      this.onData(inputEvent.data)
      this.hiddenInput.value = ''
    } else if (inputEvent.inputType === 'deleteContentBackward') {
      this.onData('\x7f') // DEL character for backspace
    } else if (inputEvent.inputType === 'insertLineBreak' || inputEvent.inputType === 'insertParagraph') {
      this.onData('\r')
      this.hiddenInput.value = ''
    }
  }

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
