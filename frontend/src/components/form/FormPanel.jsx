export function FormPanel({
  title,
  children,
  footer,
  className = '',
  onSubmit,
  onKeyDown,
  wide = false,
  fill = false,
}) {
  const Tag = onSubmit ? 'form' : 'div'
  const formProps = onSubmit
    ? { onSubmit, onKeyDown, autoComplete: 'off', noValidate: true }
    : {}

  const formClass = [
    'win-form',
    wide ? 'win-form--wide' : '',
    fill ? 'win-form--fill' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`win-form-host${fill ? ' win-form-host--fill' : ''} ${className}`.trim()}>
      <Tag className={formClass} {...formProps}>
        <div className="win-form__header">{title}</div>
        <div className="win-form__body">{children}</div>
        {footer ? <div className="win-form__footer">{footer}</div> : null}
      </Tag>
    </div>
  )
}

export function FormField({ label, children, className = '' }) {
  return (
    <label className={`win-form__field ${className}`}>
      <span className="win-form__label">{label}</span>
      {children}
    </label>
  )
}

/** Chrome ignores autocomplete="off" for address/email/password heuristics; "new-password" blocks it. */
const AUTOCOMPLETE_OFF = 'new-password'

const autofillBlockProps = {
  autoComplete: AUTOCOMPLETE_OFF,
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-form-type': 'other',
}

export function FormInput(props) {
  const { className = '', autoComplete, required, ...rest } = props
  return (
    <input
      className={`win-form__control ${className}`}
      {...autofillBlockProps}
      autoComplete={autoComplete ?? AUTOCOMPLETE_OFF}
      aria-required={required ? 'true' : undefined}
      {...rest}
    />
  )
}

export function FormSelect(props) {
  const { className = '', children, autoComplete, required, ...rest } = props
  return (
    <select
      className={`win-form__control ${className}`}
      {...autofillBlockProps}
      autoComplete={autoComplete ?? AUTOCOMPLETE_OFF}
      aria-required={required ? 'true' : undefined}
      {...rest}
    >
      {children}
    </select>
  )
}

export function FormTextarea(props) {
  const { className = '', autoComplete, required, ...rest } = props
  return (
    <textarea
      className={`win-form__control ${className}`}
      {...autofillBlockProps}
      autoComplete={autoComplete ?? AUTOCOMPLETE_OFF}
      aria-required={required ? 'true' : undefined}
      {...rest}
    />
  )
}

export function FormButton({ variant = 'default', className = '', children, ...rest }) {
  const variantClass = variant === 'primary' ? 'win-form__button--primary' : ''
  return (
    <button type="button" className={`win-form__button ${variantClass} ${className}`} {...rest}>
      {children}
    </button>
  )
}
