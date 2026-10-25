import { FormPanel } from '../form/FormPanel'
import { FormMessageInline } from '../form/FormMessage'
import { PageBreadcrumb } from './PageBreadcrumb'

/**
 * Full-height transaction page layout:
 * breadcrumb + flat form body + bottom action bar (aligned with sidebar pin).
 * Footer left hosts inline form messages; pass action buttons as `footer`.
 * `headingActions` renders on the right of the breadcrumb row.
 * `hideFooter` drops the bar for read-only pages (messages fall back to toasts).
 */
export function PrimaryContentLayout({
  breadcrumb = [],
  title,
  children,
  footer,
  headingActions,
  onSubmit,
  onKeyDown,
  hideFooter = false,
  className = '',
}) {
  return (
    <div
      className={`primary-content flex min-h-0 max-w-full flex-1 flex-col ${className}`.trim()}
    >
      {breadcrumb.length ? (
        <div className="primary-content__heading">
          <PageBreadcrumb items={breadcrumb} />
          {headingActions ? (
            <div className="primary-content__heading-actions">{headingActions}</div>
          ) : null}
        </div>
      ) : null}
      <FormPanel
        title={title}
        wide
        fill
        flat
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
        footer={
          hideFooter ? null : (
            <div className="win-form__footer-bar">
              <FormMessageInline className="win-form__footer-left" />
              {footer ? <div className="win-form__footer-right">{footer}</div> : null}
            </div>
          )
        }
      >
        {children}
      </FormPanel>
    </div>
  )
}
