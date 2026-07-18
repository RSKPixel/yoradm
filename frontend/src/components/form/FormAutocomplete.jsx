import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'

/**
 * Searchable single-select combobox styled like win-form controls.
 * Browser autocomplete is always off; this is in-app filtering only.
 * Dropdown opens on focus (shows all options) and filters as you type.
 * Enter confirms (never submits a parent form).
 */
export const FormAutocomplete = forwardRef(function FormAutocomplete(
  {
    options = [],
    value = '',
    onChange,
    onConfirm,
    getOptionValue,
    getOptionLabel,
    getInputLabel,
    renderOption,
    filterOption,
    allowCustom = false,
    disabled = false,
    emptyMessage = 'No matches',
    className = '',
  },
  ref,
) {
  const listId = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  useImperativeHandle(ref, () => ({
    focus() {
      const input = inputRef.current
      if (!input || input.disabled) return false
      input.focus()
      setEditing(true)
      setQuery('')
      setOpen(true)
      return true
    },
  }))

  const selected = useMemo(
    () => options.find((opt) => getOptionValue(opt) === value) ?? null,
    [options, value, getOptionValue],
  )

  const inputLabelFor = getInputLabel || getOptionLabel
  const displayValue =
    editing || open
      ? query
      : selected
        ? inputLabelFor(selected)
        : allowCustom && value
          ? value
          : ''

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) =>
      filterOption
        ? filterOption(opt, q)
        : getOptionLabel(opt).toLowerCase().includes(q),
    )
  }, [options, query, filterOption, getOptionLabel])

  useEffect(() => {
    if (!open) return undefined
    function onDocPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        setEditing(false)
        setQuery('')
      }
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [open])

  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const list = listRef.current
    const item = list.querySelector('li:has([data-active="true"])')
    if (!item) return

    const activeTop = item.offsetTop
    const activeBottom = activeTop + item.offsetHeight
    const viewTop = list.scrollTop
    const viewBottom = viewTop + list.clientHeight

    if (activeTop < viewTop) {
      list.scrollTop = activeTop
    } else if (activeBottom > viewBottom) {
      list.scrollTop = activeBottom - list.clientHeight
    }
  }, [highlight, open, filtered])

  function confirmCustom(raw) {
    const nextValue = String(raw ?? '').trim()
    onChange?.(nextValue)
    setOpen(false)
    setEditing(false)
    setQuery('')
    if (nextValue) onConfirm?.(nextValue, null)
  }

  function confirmOption(opt) {
    const nextValue = getOptionValue(opt)
    onChange?.(nextValue)
    setOpen(false)
    setEditing(false)
    setQuery('')
    onConfirm?.(nextValue, opt)
  }

  function onFocus() {
    if (disabled) return
    setEditing(true)
    setQuery(allowCustom && value ? value : '')
    setOpen(true)
  }

  function onBlur(event) {
    if (rootRef.current?.contains(event.relatedTarget)) return
    if (allowCustom && editing) {
      const typed = query.trim()
      if (typed) {
        confirmCustom(typed)
        return
      }
    }
    setOpen(false)
    setEditing(false)
    setQuery('')
  }

  function onKeyDown(event) {
    if (disabled) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setEditing(true)
        setOpen(true)
        return
      }
      if (!filtered.length) return
      setHighlight((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open || !filtered.length) return
      setHighlight((i) => Math.max(i - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      if (open && filtered[highlight]) {
        confirmOption(filtered[highlight])
      } else if (allowCustom && query.trim()) {
        confirmCustom(query)
      } else if (value) {
        onConfirm?.(value, selected)
      }
      return
    }
    if (event.key === 'Escape') {
      setOpen(false)
      setEditing(false)
      setQuery('')
      inputRef.current?.blur()
    }
  }

  return (
    <div className={`win-form__autocomplete ${className}`} ref={rootRef}>
      <input
        ref={inputRef}
        type="text"
        className="win-form__control"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="new-password"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        disabled={disabled}
        value={displayValue}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => {
          const next = e.target.value
          setQuery(next)
          setEditing(true)
          setOpen(true)
          if (value) onChange?.('')
        }}
        onKeyDown={onKeyDown}
      />
      {open ? (
        <ul id={listId} ref={listRef} className="win-form__autocomplete-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="win-form__autocomplete-empty">{emptyMessage}</li>
          ) : (
            filtered.map((opt, index) => {
              const optValue = getOptionValue(opt)
              const active = index === highlight
              const selectedOpt = optValue === value
              return (
                <li key={optValue} role="option" aria-selected={selectedOpt}>
                  <button
                    type="button"
                    data-active={active ? 'true' : undefined}
                    className={`win-form__autocomplete-option${active ? ' is-active' : ''}${selectedOpt ? ' is-selected' : ''}`}
                    onMouseEnter={() => setHighlight(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => confirmOption(opt)}
                  >
                    {renderOption ? renderOption(opt) : getOptionLabel(opt)}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
})
