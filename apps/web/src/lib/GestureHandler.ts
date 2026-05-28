/**
 * GestureHandler — 独立手势处理层（纯 TypeScript 类）
 *
 * 双指缩放字体 + 长按粘贴。
 *
 * **Event priority coordination with MobileKeyboardAdapter:**
 * GestureHandler registers touch listeners on the same container element
 * as MobileKeyboardAdapter. To prevent conflicts:
 * - During a pinch gesture, GestureHandler calls
 *   `MobileKeyboardAdapter.setSuppressFocus(true)` via `onPinchStart`
 *   so that the next touchend/click does NOT trigger the hidden input focus.
 * - When the pinch ends, `onPinchEnd` calls `setSuppressFocus(false)`
 *   to restore normal keyboard-trigger behavior.
 * - Long-press (single-finger) is cancelled once the second finger lands
 *   (pinch start), preventing false long-press triggers mid-pinch.
 * - MobileKeyboardAdapter's `handleContainerTouch` checks `e.touches.length >= 2`
 *   and skips focus when multi-touch is detected.
 */

const MIN_FONT_SIZE = 10
const MAX_FONT_SIZE = 32
const PINCH_STEP_PX = 20   // 每 20px 指距变化 = 1px 字体
const LONG_PRESS_MS = 500  // 长按阈值
const MOVE_THRESHOLD = 10  // 长按判定：移动超过此距离取消

export class GestureHandler {
  private element: HTMLElement
  private onFontSizeChange: (delta: number) => void
  private onPaste: (text: string) => void
  onPinchStart?: () => void
  onPinchEnd?: () => void

  // Pinch state
  private initialPinchDistance = 0
  private lastPinchDistance = 0

  // Long press state
  private longPressTimer: ReturnType<typeof setTimeout> | null = null
  private longPressStartX = 0
  private longPressStartY = 0
  private longPressCancelled = false

  private boundHandlers: {
    touchstart: (e: TouchEvent) => void
    touchmove: (e: TouchEvent) => void
    touchend: (e: TouchEvent) => void
  }

  constructor(
    element: HTMLElement,
    onFontSizeChange: (delta: number) => void,
    onPaste: (text: string) => void,
  ) {
    this.element = element
    this.onFontSizeChange = onFontSizeChange
    this.onPaste = onPaste

    this.boundHandlers = {
      touchstart: this.handleTouchStart.bind(this),
      touchmove: this.handleTouchMove.bind(this),
      touchend: this.handleTouchEnd.bind(this),
    }
  }

  attach(): void {
    this.element.addEventListener('touchstart', this.boundHandlers.touchstart, { passive: false })
    this.element.addEventListener('touchmove', this.boundHandlers.touchmove, { passive: false })
    this.element.addEventListener('touchend', this.boundHandlers.touchend, { passive: false })
  }

  destroy(): void {
    this.element.removeEventListener('touchstart', this.boundHandlers.touchstart)
    this.element.removeEventListener('touchmove', this.boundHandlers.touchmove)
    this.element.removeEventListener('touchend', this.boundHandlers.touchend)
    this.clearLongPressTimer()
  }

  // --- Private handlers ---

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length === 2) {
      // Pinch start
      this.clearLongPressTimer()
      this.initialPinchDistance = this.getDistance(e.touches[0], e.touches[1])
      this.lastPinchDistance = this.initialPinchDistance
      this.onPinchStart?.()
    } else if (e.touches.length === 1) {
      // Possible long press start
      this.longPressCancelled = false
      this.longPressStartX = e.touches[0].clientX
      this.longPressStartY = e.touches[0].clientY

      this.longPressTimer = setTimeout(() => {
        if (!this.longPressCancelled) {
          this.handleLongPress()
        }
      }, LONG_PRESS_MS)
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (e.touches.length === 2) {
      // Pinch move
      this.clearLongPressTimer()
      const currentDistance = this.getDistance(e.touches[0], e.touches[1])
      const distanceDelta = currentDistance - this.lastPinchDistance

      if (Math.abs(distanceDelta) >= PINCH_STEP_PX) {
        const fontDelta = Math.round(distanceDelta / PINCH_STEP_PX)
        this.onFontSizeChange(fontDelta)
        this.lastPinchDistance = currentDistance
      }

      e.preventDefault()
    } else if (e.touches.length === 1 && this.longPressTimer) {
      // Check if moved too far — cancel long press
      const dx = e.touches[0].clientX - this.longPressStartX
      const dy = e.touches[0].clientY - this.longPressStartY
      if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
        this.longPressCancelled = true
        this.clearLongPressTimer()
      }
    }
  }

  private handleTouchEnd(_e: TouchEvent): void {
    const wasPinching = this.initialPinchDistance > 0
    this.clearLongPressTimer()
    this.initialPinchDistance = 0
    this.lastPinchDistance = 0
    if (wasPinching) this.onPinchEnd?.()
  }

  private handleLongPress(): void {
    // Try clipboard API — skip if unavailable (e.g. HTTP context)
    if (!navigator.clipboard?.readText) return

    navigator.clipboard.readText().then((text) => {
      if (text) {
        this.onPaste(text)
      }
    }).catch(() => {
      // Permission denied or not available — silently ignore
    })
  }

  private getDistance(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }
}

export { MIN_FONT_SIZE, MAX_FONT_SIZE }
