export function AppBrandName({ className = '' }) {
  return (
    <div className={`flex min-w-0 items-baseline gap-1 ${className}`}>
      <span className="truncate text-[calc(1.35rem+2px)] font-bold tracking-tight text-slate-50">
        yora
      </span>
      <span className="truncate text-[calc(1.35rem+2px)] font-normal tracking-tight text-slate-400">
        dm
      </span>
    </div>
  )
}
