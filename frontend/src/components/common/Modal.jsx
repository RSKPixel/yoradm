import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'

export function Modal({ title, titleIcon: TitleIcon, onClose, children, className = '', ariaLabelledBy }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return createPortal(
    <div className="app-modal-overlay" onClick={onClose}>
      <div
        className={`app-modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        onClick={(event) => event.stopPropagation()}
      >
        {title ? (
          <div className="app-modal-header">
            <h1 id={ariaLabelledBy} className="app-modal-title">
              {TitleIcon ? <TitleIcon className="app-modal-title-icon" aria-hidden="true" /> : null}
              {title}
            </h1>
            <button type="button" className="app-modal-close" onClick={onClose} aria-label="Close">
              <XMarkIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  )
}
