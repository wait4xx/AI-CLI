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
    keydown: (e: KeyboardEvent) => void
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
      keydown: this.handleKeydown.bind(this),
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

    // Keydown for special keys (Delete, Arrow, Home, End, Tab, etc.)
    this.hiddenInput.addEventListener('keydown', this.boundHandlers.keydown)

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
    this.hiddenInput.removeEventListener('keydown', this.boundHandlers.keydown)

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

  /**
   * Forward keydown events for special keys that don't produce input events.
   * Without this, keys like Delete, Arrow keys, Home, End, Tab, Page Up/Down,
   * and Ctrl/Alt combinations are silently swallowed by the hidden <input>.
   */
  private handleKeydown(e: KeyboardEvent): void {
    if (this.isComposing) return

    // Let the browser handle Ctrl/Meta shortcuts (copy/paste/select-all, etc.)
    if (e.ctrlKey || e.metaKey) return

    // Printable characters are handled by the input event — skip them here.
    if (e.key.length === 1 && !e.altKey) return

    // Map special keys to xterm escape sequences or control characters.
    const sequences: Record<string, string> = {
      'Enter':      '\r',
      'Backspace':  '\x7f',
      'Tab':        '\t',
      'Escape':     '\x1b',
      'Delete':     '\x1b[3~',
      'Home':       '\x1b[H',
      'End':        '\x1b[F',
      'PageUp':     '\x1b[5~',
      'PageDown':   '\x1b[6~',
      'Insert':     '\x1b[2~',
      'ArrowUp':    '\x1b[A',
      'ArrowDown':  '\x1b[B',
      'ArrowRight': '\x1b[C',
      'ArrowLeft':  '\x1b[D',
    }

    const seq = sequences[e.key]
    if (seq) {
      e.preventDefault()
      this.onData(seq)
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
