import { useState } from 'react'
import { updateCollectionPerformance } from '../../api/tally'
import { useAuth } from '../../auth/AuthContext'
import { getApiErrorMessage } from '../../utils/formValidation'
import { useFormMessage } from '../form/FormMessage'

export function GeneralTab() {
  const { isAdmin } = useAuth()
  const { showError, showSuccess } = useFormMessage()
  const [busy, setBusy] = useState(false)

  async function onUpdate() {
    if (!isAdmin || busy) return
    setBusy(true)
    try {
      await updateCollectionPerformance()
      showSuccess('Collection performance updated')
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not update collection performance'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-(--ink)">Party Collection performance</span>
      {isAdmin ? (
        <button
          type="button"
          className="shrink-0 rounded-lg bg-(--accent) px-3 py-1.5 text-sm font-medium text-(--on-accent) transition-colors hover:bg-(--accent-dark) disabled:cursor-not-allowed disabled:opacity-55"
          disabled={busy}
          onClick={() => void onUpdate()}
        >
          {busy ? 'Updating…' : 'Update'}
        </button>
      ) : null}
    </div>
  )
}
