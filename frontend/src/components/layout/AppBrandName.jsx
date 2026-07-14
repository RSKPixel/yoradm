export function AppBrandName({ className = '' }) {
  return (
    <div className={`flex min-w-0 items-baseline gap-1 font-sans ${className}`}>
      <span className="truncate font-sans text-[calc(1.25rem+10pt)] font-bold tracking-tight text-slate-50">
        yora
      </span>
      <span className="truncate font-sans text-[calc(1.25rem+10pt)] font-normal tracking-tight text-slate-400">
        dm
      </span>
    </div>
  )
}
