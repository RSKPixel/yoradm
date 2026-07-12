import { useState } from 'react'
import api from '../../api/client'
import { getApiErrorMessage, validateChangePasswordForm } from '../../utils/formValidation'
import { FormField, FormInput, FormPanel } from '../form/FormPanel'
import { useFormMessage } from '../form/FormMessage'

export function PasswordTab() {
  const { showError, showErrors, showSuccess } = useFormMessage()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  async function onChangePassword(e) {
    e.preventDefault()

    const validationErrors = validateChangePasswordForm({
      currentPassword,
      newPassword,
      confirmPassword,
    })
    if (validationErrors.length) {
      showErrors(validationErrors)
      return
    }

    setSavingPassword(true)
    try {
      await api.post('/auth/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showSuccess('Password updated successfully')
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not update password'))
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <FormPanel
      title="Change password"
      onSubmit={onChangePassword}
      footer={
        <button
          type="submit"
          className="win-form__button win-form__button--primary"
          disabled={savingPassword}
        >
          {savingPassword ? 'Updating…' : 'Update password'}
        </button>
      }
    >
      <FormField label="Current password">
        <FormInput
          required
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </FormField>
      <FormField label="New password">
        <FormInput
          required
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </FormField>
      <FormField label="Confirm new password">
        <FormInput
          required
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </FormField>
    </FormPanel>
  )
}
