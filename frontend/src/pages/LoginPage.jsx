import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { fetchCompanyPublic } from '../api/company'
import { useAuth } from '../auth/AuthContext'
import { FormField, FormInput, FormPanel } from '../components/form/FormPanel'
import { useFormMessage } from '../components/form/FormMessage'
import { AppBrandName } from '../components/layout/AppBrandName'
import { SpotlightBackground } from '../components/layout/SpotlightBackground'
import { getApiErrorMessage, validateLoginForm } from '../utils/formValidation'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const { showError, showErrors } = useFormMessage()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const company = await fetchCompanyPublic()
        if (!cancelled) setCompanyName(String(company?.company_name || '').trim())
      } catch {
        if (!cancelled) setCompanyName('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && user) return <Navigate to="/" replace />

  async function onSubmit(e) {
    e.preventDefault()

    const validationErrors = validateLoginForm({ username, password })
    if (validationErrors.length) {
      showErrors(validationErrors)
      return
    }

    setSubmitting(true)
    try {
      await login(username, password)
    } catch (error) {
      showError(getApiErrorMessage(error, 'Invalid username or password'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-(--bg)">
      <SpotlightBackground />
      <div className="absolute top-5 right-5 left-5 z-20 flex items-center justify-between gap-4">
        <AppBrandName />
        {companyName ? (
          <div className="min-w-0 truncate text-right text-sm font-medium tracking-tight text-(--muted)">
            {companyName}
          </div>
        ) : null}
      </div>
      <div className="relative z-10 w-full max-w-md px-6">
        <FormPanel
          title="Sign In"
          onSubmit={onSubmit}
          footer={
            <button type="submit" className="win-form__button win-form__button--primary" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          }
        >
          <FormField label="Username">
            <FormInput
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </FormField>
          <FormField label="Password">
            <FormInput
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
        </FormPanel>
      </div>
    </div>
  )
}
