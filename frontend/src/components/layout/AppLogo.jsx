import { AppBrandName } from './AppBrandName'

export function AppLogo({ className = '' }) {
  return (
    <div className={`absolute top-5 left-5 z-20 ${className}`}>
      <AppBrandName />
    </div>
  )
}
