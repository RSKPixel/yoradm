import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const TOAST_EXIT_MS = 350
export const TOAST_DEFAULT_DURATION_MS = 3000
export const TOAST_MAX_VISIBLE = 3

const FormMessageContext = createContext(undefined)

export function FormMessageProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [inlineHostCount, setInlineHostCount] = useState(0)
  const toastsRef = useRef(toasts)
  const timersRef = useRef(new Map())
  const inlineHostCountRef = useRef(0)

  toastsRef.current = toasts
  inlineHostCountRef.current = inlineHostCount

  const registerInlineHost = useCallback(() => {
    setInlineHostCount((count) => count + 1)
    return () => setInlineHostCount((count) => Math.max(0, count - 1))
  }, [])

  const clearTimers = useCallback((id) => {
    const timers = timersRef.current.get(id)
    if (!timers) return
    if (timers.auto) window.clearTimeout(timers.auto)
    if (timers.remove) window.clearTimeout(timers.remove)
    timersRef.current.delete(id)
  }, [])

  const removeToast = useCallback((id) => {
    clearTimers(id)
    setToasts((current) => current.filter((entry) => entry.id !== id))
  }, [clearTimers])

  const dismissToast = useCallback(
    (id) => {
      const toast = toastsRef.current.find((entry) => entry.id === id)
      if (!toast || toast.exiting) return

      clearTimers(id)

      // Inline footer messages remove immediately — no sliding card exit.
      if (inlineHostCountRef.current > 0) {
        removeToast(id)
        return
      }

      setToasts((current) =>
        current.map((entry) => (entry.id === id ? { ...entry, exiting: true } : entry)),
      )

      timersRef.current.set(id, {
        remove: window.setTimeout(() => {
          removeToast(id)
        }, TOAST_EXIT_MS),
      })
    },
    [clearTimers, removeToast],
  )

  const enqueueToast = useCallback(
    (message, options = {}) => {
      const id = crypto.randomUUID()
      const type = options.type ?? 'error'
      const duration = options.duration ?? TOAST_DEFAULT_DURATION_MS
      const skipCap = Boolean(options.skipCap)

      if (!skipCap) {
        const current = toastsRef.current
        if (current.length >= TOAST_MAX_VISIBLE) {
          const oldest = current.find((entry) => !entry.exiting) ?? current[0]
          if (oldest) dismissToast(oldest.id)
        }
      }

      setToasts((prev) => [...prev, { id, message, type, exiting: false }])

      if (duration > 0) {
        const auto = window.setTimeout(() => {
          dismissToast(id)
        }, duration)
        timersRef.current.set(id, { auto })
      }

      return id
    },
    [dismissToast],
  )

  const showToast = useCallback(
    (message, options = {}) => enqueueToast(message, options),
    [enqueueToast],
  )

  const showErrors = useCallback(
    (messages, duration = TOAST_DEFAULT_DURATION_MS) => {
      const list = [
        ...new Set(
          (Array.isArray(messages) ? messages : [messages])
            .map((msg) => (typeof msg === 'string' ? msg.trim() : ''))
            .filter(Boolean),
        ),
      ]
      if (!list.length) return []

      return list.map((message) =>
        enqueueToast(message, { type: 'error', duration, skipCap: true }),
      )
    },
    [enqueueToast],
  )

  const showMessage = useCallback(
    (text, type = 'info', duration) => showToast(text, { type, duration }),
    [showToast],
  )

  const value = useMemo(
    () => ({
      toasts,
      inlineHostActive: inlineHostCount > 0,
      registerInlineHost,
      showToast,
      showErrors,
      dismissToast,
      showMessage,
      showSuccess: (text, duration) => showToast(text, { type: 'success', duration }),
      showError: (text, duration) => showToast(text, { type: 'error', duration }),
      showInfo: (text, duration) => showToast(text, { type: 'info', duration }),
    }),
    [
      toasts,
      inlineHostCount,
      registerInlineHost,
      showToast,
      showErrors,
      dismissToast,
      showMessage,
    ],
  )

  const showFloatingToasts = inlineHostCount === 0 && toasts.length > 0

  return (
    <FormMessageContext.Provider value={value}>
      {children}
      {showFloatingToasts ? (
        <div className="toast-container" aria-live="polite" aria-relevant="additions">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast toast-${toast.type}${toast.exiting ? ' toast-exiting' : ''}`}
              role="alert"
            >
              <p className="toast-message">{toast.message}</p>
              <button
                type="button"
                className="toast-close"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </FormMessageContext.Provider>
  )
}

/** Compact footer status line — used by PrimaryContentLayout bottom-left. */
export function FormMessageInline({ className = '' }) {
  const { toasts, dismissToast, registerInlineHost } = useFormMessage()

  useEffect(() => registerInlineHost(), [registerInlineHost])

  const active = toasts.filter((toast) => !toast.exiting)
  const latest = active.length ? active[active.length - 1] : null

  if (!latest) {
    return <div className={`win-form__footer-message ${className}`.trim()} aria-live="polite" />
  }

  return (
    <div
      className={`win-form__footer-message win-form__footer-message--${latest.type} ${className}`.trim()}
      role="alert"
      aria-live="polite"
    >
      <p className="win-form__footer-message-text" title={latest.message}>
        {latest.message}
      </p>
      <button
        type="button"
        className="win-form__footer-message-dismiss"
        onClick={() => dismissToast(latest.id)}
        aria-label="Dismiss message"
      >
        ×
      </button>
    </div>
  )
}

export function useFormMessage() {
  const ctx = useContext(FormMessageContext)
  if (!ctx) throw new Error('useFormMessage must be used within FormMessageProvider')
  return ctx
}

export function useToast() {
  return useFormMessage()
}
