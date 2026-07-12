import { useEffect, useRef, useState } from 'react'
import api from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import {
  getApiErrorMessage,
  validateProfileForm,
  validateProfilePhotoFile,
} from '../../utils/formValidation'
import { FormField, FormInput, FormPanel } from '../form/FormPanel'
import { useFormMessage } from '../form/FormMessage'
import { UserAvatar } from '../layout/UserAvatar'

export function ProfileTab() {
  const { user, refreshUser } = useAuth()
  const { showError, showErrors, showSuccess } = useFormMessage()
  const photoInputRef = useRef(null)

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    if (!user) return
    setFullName(user.full_name ?? '')
    setUsername(user.username ?? '')
    setEmail(user.email ?? '')
  }, [user])

  async function onSaveProfile(e) {
    e.preventDefault()

    const validationErrors = validateProfileForm({ fullName, email })
    if (validationErrors.length) {
      showErrors(validationErrors)
      return
    }

    setSavingProfile(true)
    try {
      await api.patch('/auth/me', {
        full_name: fullName.trim(),
        email: email.trim(),
      })
      await refreshUser()
      showSuccess('Profile updated successfully')
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not update profile'))
    } finally {
      setSavingProfile(false)
    }
  }

  async function onPhotoSelect(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const validationMessage = validateProfilePhotoFile(file)
    if (validationMessage) {
      showError(validationMessage)
      return
    }

    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await api.post('/auth/me/photo', formData)
      await refreshUser()
      showSuccess('Profile photo updated')
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not upload photo'))
    } finally {
      setUploadingPhoto(false)
    }
  }

  const displayName = fullName || user?.full_name || user?.username || ''

  return (
    <FormPanel
      title="Profile details"
      onSubmit={onSaveProfile}
      footer={
        <button
          type="submit"
          className="win-form__button win-form__button--primary"
          disabled={savingProfile}
        >
          {savingProfile ? 'Saving…' : 'Save profile'}
        </button>
      }
    >
      <div className="mb-4 flex items-center gap-4">
        <UserAvatar
          name={displayName}
          profilePic={user?.profile_pic}
          className="profile-avatar-lg"
        />
        <div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void onPhotoSelect(e)}
          />
          <button
            type="button"
            className="win-form__button"
            disabled={uploadingPhoto}
            onClick={() => photoInputRef.current?.click()}
          >
            {uploadingPhoto ? 'Uploading…' : 'Change photo'}
          </button>
          <p className="mt-1.5 text-xs text-(--muted)">JPG, PNG, WEBP, or GIF. Max 1 MB.</p>
        </div>
      </div>

      <FormField label="Full name">
        <FormInput required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </FormField>
      <FormField label="Username">
        <FormInput required value={username} readOnly />
      </FormField>
      <FormField label="Email">
        <FormInput
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </FormField>
    </FormPanel>
  )
}
