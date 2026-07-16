import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

/**
 * Click-to-open select. Menu portals to document.body so it isn't clipped by
 * overflow:hidden page shells (PrimaryContentLayout / fill forms).
 */
export function FormDropdown({
  options = [],
  value = '',
  onChange,
  disabled = false,
  placeholder = 'Select…',
  emptyMessage = 'No options',
  className = '',
  listClassName = '',
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [menuStyle, setMenuStyle] = useState(null)

  const selected = options.find((opt) => String(opt.value) === String(value)) ?? null
  const label = selected?.label ?? placeholder

  function updateMenuPosition() {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const maxHeight = 220
    const gap = 4
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    const openUp = spaceBelow < Math.min(maxHeight, 140) && spaceAbove > spaceBelow
    const height = Math.min(maxHeight, openUp ? spaceAbove : spaceBelow)

    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 10),
      top: openUp ? undefined : rect.bottom + gap,
      bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
      maxHeight: Math.max(height, 80),
    })
  }

  useLayoutEffect(() => {
    if (!open) return undefined
    updateMenuPosition()
    function onReposition() {
      updateMenuPosition()
    }
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function onDocPointerDown(event) {
      const inTrigger = rootRef.current?.contains(event.target)
      const inMenu = listRef.current?.contains(event.target)
      if (!inTrigger && !inMenu) setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const index = Math.max(
      0,
      options.findIndex((opt) => String(opt.value) === String(value)),
    )
    setHighlight(index === -1 ? 0 : index)
  }, [open, options, value])

  useEffect(() => {
    if (!open || !listRef.current) return
    const item = listRef.current.querySelector('li:has([data-active="true"])')
    if (!item) return
    const activeTop = item.offsetTop
    const activeBottom = activeTop + item.offsetHeight
    const viewTop = listRef.current.scrollTop
    const viewBottom = viewTop + listRef.current.clientHeight
    if (activeTop < viewTop) listRef.current.scrollTop = activeTop
    else if (activeBottom > viewBottom) {
      listRef.current.scrollTop = activeBottom - listRef.current.clientHeight
    }
  }, [highlight, open])

  function selectOption(opt) {
    onChange?.(opt.value)
    setOpen(false)
    buttonRef.current?.focus()
  }

  function onKeyDown(event) {
    if (disabled) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (!options.length) return
      setHighlight((i) => Math.min(i + 1, options.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (!options.length) return
      setHighlight((i) => Math.max(i - 1, 0))
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      if (!open) {
        setOpen(true)
        return
      }
      if (options[highlight]) selectOption(options[highlight])
      return
    }
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        setOpen(false)
      }
    }
  }

  const menu =
    open && menuStyle
      ? createPortal(
          <ul
            id={listId}
            ref={listRef}
            className={`win-form__dropdown-list ${listClassName}`.trim()}
            role="listbox"
            style={menuStyle}
          >
            {options.length === 0 ? (
              <li className="win-form__autocomplete-empty">{emptyMessage}</li>
            ) : (
              options.map((opt, index) => {
                const active = index === highlight
                const selectedOpt = String(opt.value) === String(value)
                return (
                  <li key={String(opt.value)} role="option" aria-selected={selectedOpt}>
                    <button
                      type="button"
                      data-active={active ? 'true' : undefined}
                      className={`win-form__autocomplete-option${active ? ' is-active' : ''}${
                        selectedOpt ? ' is-selected' : ''
                      }`}
                      onMouseEnter={() => setHighlight(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectOption(opt)}
                    >
                      {opt.label}
                    </button>
                  </li>
                )
              })
            )}
          </ul>,
          document.body,
        )
      : null

  return (
    <div className={`win-form__dropdown ${className}`.trim()} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="win-form__control win-form__dropdown-trigger"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((prev) => !prev)
        }}
        onKeyDown={onKeyDown}
      >
        <span className="win-form__dropdown-label">{label}</span>
        <ChevronDownIcon
          className={`win-form__dropdown-chevron${open ? ' is-open' : ''}`}
          aria-hidden="true"
        />
      </button>
      {menu}
    </div>
  )
}
