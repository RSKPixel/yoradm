import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Modal } from '../common/Modal'

export function ConfirmDeleteModal({
  title = 'Delete delivery challan',
  message = 'Delete this delivery challan permanently? This cannot be undone.',
  confirming = false,
  onCancel,
  onConfirm,
}) {
  return (
    <Modal
      title={title}
      titleIcon={ExclamationTriangleIcon}
      onClose={onCancel}
      ariaLabelledBy="dc-delete-confirm-title"
      className="dc-confirm-modal"
    >
      <div className="dc-confirm-body">
        <p className="dc-confirm-message">{message}</p>
        <div className="dc-confirm-actions">
          <button type="button" className="win-form__button" onClick={onCancel} disabled={confirming}>
            Cancel
          </button>
          <button
            type="button"
            className="win-form__button win-form__button--danger"
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
