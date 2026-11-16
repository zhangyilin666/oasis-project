/** H5's shared feedback nodes live outside the page tree. Keep the SDK's callbacks,
 * while giving its div-based modal controls normal dialog keyboard behaviour. */
let installed = false

export function installFeedbackAccessibility(): void {
  if (installed || typeof document === 'undefined') return
  installed = true

  let activeDialog: HTMLElement | null = null
  let previousFocus: HTMLElement | null = null
  let pressedButton: HTMLElement | null = null
  let pressedKey = ''
  let frame = 0

  function visibleDialog(): HTMLElement | null {
    const host = document.querySelector<HTMLElement>('#u-a-m uni-modal')
    if (!host || host.classList.contains('uni-fade-leave-active') || getComputedStyle(host).display === 'none') return null
    const dialog = host.querySelector<HTMLElement>('.uni-modal')
    return dialog?.getClientRects().length ? dialog : null
  }

  function controls(dialog: HTMLElement): HTMLElement[] {
    return Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]'))
      .filter(element => element.tabIndex >= 0 && !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true' && element.getClientRects().length > 0)
  }

  function focusDefault(dialog: HTMLElement): void {
    const target = dialog.querySelector<HTMLElement>('.uni-modal__textarea, .uni-modal__btn_default')
      || dialog.querySelector<HTMLElement>('.uni-modal__btn_primary') || dialog
    target.focus({ preventScroll: true })
  }

  function update(): void {
    frame = 0
    const dialog = visibleDialog()
    if (!dialog) {
      if (activeDialog) {
        activeDialog = null
        pressedButton = null; pressedKey = ''
        const target = previousFocus
        previousFocus = null
        if (target?.isConnected) target.focus({ preventScroll: true })
      }
      return
    }

    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.tabIndex = -1
    const title = dialog.querySelector<HTMLElement>('.uni-modal__title')
    const description = dialog.querySelector<HTMLElement>('.uni-modal__bd')
    if (title) {
      title.id = 'oasis-dialog-title'
      dialog.setAttribute('aria-labelledby', title.id)
      dialog.removeAttribute('aria-label')
    } else {
      dialog.removeAttribute('aria-labelledby')
      dialog.setAttribute('aria-label', '提示')
    }
    if (description) {
      description.id = 'oasis-dialog-description'
      dialog.setAttribute('aria-describedby', description.id)
    } else dialog.removeAttribute('aria-describedby')
    const input = dialog.querySelector<HTMLElement>('.uni-modal__textarea')
    if (input) {
      if (title) { input.setAttribute('aria-labelledby', title.id); input.removeAttribute('aria-label') }
      else { input.removeAttribute('aria-labelledby'); input.setAttribute('aria-label', '输入内容') }
    }
    for (const button of dialog.querySelectorAll<HTMLElement>('.uni-modal__btn')) {
      button.setAttribute('role', 'button')
      button.tabIndex = 0
    }
    if (activeDialog !== dialog) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      activeDialog = dialog
      pressedButton = null; pressedKey = ''
      focusDefault(dialog)
    } else if (!dialog.contains(document.activeElement)) focusDefault(dialog)
  }

  function schedule(): void { if (!frame) frame = requestAnimationFrame(update) }
  function stop(event: KeyboardEvent): void { event.preventDefault(); event.stopImmediatePropagation() }

  document.addEventListener('keydown', event => {
    const dialog = visibleDialog()
    if (!dialog) return
    if (event.key === 'Tab') {
      stop(event)
      const items = controls(dialog)
      const index = items.indexOf(document.activeElement as HTMLElement)
      const next = event.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index + 1) % items.length
      ;(items[next] || dialog).focus({ preventScroll: true })
      return
    }
    if (event.key !== 'Enter' && event.key !== ' ') return
    const focused = document.activeElement as HTMLElement | null
    const button = focused?.closest<HTMLElement>('.uni-modal__btn')
    if (button && dialog.contains(button) && !event.isComposing) {
      stop(event)
      if (!event.repeat) { pressedButton = button; pressedKey = event.key }
    } else if (event.key === 'Enter' && !focused?.matches('textarea, input, [contenteditable="true"]')) stop(event)
  }, true)

  // uni-h5 handles Enter on document keyup, regardless of focus. Capture it so
  // the key that opened a dialog cannot also confirm it or a following dialog.
  document.addEventListener('keyup', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const dialog = visibleDialog()
    if (!dialog && !pressedButton) return
    const button = pressedButton
    const key = pressedKey
    pressedButton = null; pressedKey = ''
    if (event.key === 'Enter' || button) {
      event.stopImmediatePropagation()
      if (!event.isComposing && button && key === event.key && button.isConnected && dialog?.contains(button) && document.activeElement === button) {
        event.preventDefault()
        button.click()
      }
    }
  }, true)

  document.addEventListener('focusin', event => {
    const dialog = visibleDialog()
    if (activeDialog === dialog && dialog && event.target instanceof Node && !dialog.contains(event.target)) focusDefault(dialog)
  }, true)

  function observe(): void {
    new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] })
    update()
  }
  if (document.body) observe()
  else document.addEventListener('DOMContentLoaded', observe, { once: true })
}
