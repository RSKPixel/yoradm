import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  TableCellsIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

export function ExcelPreviewModal({
  open,
  title = 'Excel Preview',
  fileName,
  html,
  loading = false,
  onClose,
  onDownload,
}) {
  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !loading) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, loading, onClose])

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="app-modal-overlay pdf-preview-overlay" onClick={() => !loading && onClose()}>
      <div
        className="app-modal pdf-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="excel-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header pdf-preview-header">
          <h1 id="excel-preview-title" className="app-modal-title">
            <TableCellsIcon className="app-modal-title-icon" aria-hidden="true" />
            <span className="truncate">{title}</span>
          </h1>
          <button
            type="button"
            className="app-modal-close"
            onClick={() => !loading && onClose()}
            aria-label="Close Excel preview"
            disabled={loading}
          >
            <XMarkIcon className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="pdf-preview-body">
          {loading || !html ? (
            <div className="pdf-preview-loading">
              <ArrowPathIcon className="size-5 animate-spin" aria-hidden="true" />
              <span>Generating Excel preview…</span>
            </div>
          ) : (
            <iframe
              srcDoc={html}
              title={title}
              className="pdf-preview-frame excel-preview-frame"
            />
          )}
        </div>

        <div className="pdf-preview-footer">
          {fileName ? (
            <p className="pdf-preview-filename" title={fileName}>
              {fileName}
            </p>
          ) : (
            <span />
          )}
          <div className="pdf-preview-actions">
            <button
              type="button"
              className="win-form__button"
              onClick={onClose}
              disabled={loading}
            >
              Close
            </button>
            <button
              type="button"
              className="win-form__button win-form__button--primary"
              onClick={onDownload}
              disabled={loading || !html}
            >
              <ArrowDownTrayIcon className="size-3.5" aria-hidden="true" />
              Download
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
