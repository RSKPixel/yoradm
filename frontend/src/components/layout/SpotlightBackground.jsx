export function SpotlightBackground({ className = '' }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 ${className}`.trim()}
      style={{
        background:
          'radial-gradient(ellipse at 20% 20%, var(--glow-a), transparent 50%), radial-gradient(ellipse at 80% 80%, var(--glow-b), transparent 45%)',
      }}
      aria-hidden="true"
    />
  )
}
