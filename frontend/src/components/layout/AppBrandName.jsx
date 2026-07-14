export function AppBrandName({ className = '' }) {
  return (
    <div className={`app-brand-name ${className}`.trim()}>
      <span className="app-brand-name__primary">yora</span>
      <span className="app-brand-name__secondary">dm</span>
    </div>
  )
}
