import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useSettings } from '../components/settings/SettingsContext'

/** Opens the settings modal (optionally on a tab) then leaves the route. */
export function OpenSettingsRoute({ tab = 'general' }) {
  const { openSettings } = useSettings()
  const navigate = useNavigate()

  useEffect(() => {
    openSettings(tab)
    navigate('/', { replace: true })
  }, [openSettings, navigate, tab])

  return <Navigate to="/" replace />
}
