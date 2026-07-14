import { Fragment } from 'react'
import { Link } from 'react-router-dom'

export function PageBreadcrumb({ items = [], className = '' }) {
  if (!items.length) return null

  return (
    <nav className={`page-breadcrumb ${className}`.trim()} aria-label="Breadcrumb">
      <ol className="page-breadcrumb__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 ? (
                <li className="page-breadcrumb__sep" aria-hidden="true">
                  /
                </li>
              ) : null}
              <li className="page-breadcrumb__item">
                {isLast ? (
                  <span className="page-breadcrumb__current" aria-current="page">
                    {item.label}
                  </span>
                ) : item.to ? (
                  <Link to={item.to} className="page-breadcrumb__link">
                    {item.label}
                  </Link>
                ) : (
                  <span className="page-breadcrumb__link page-breadcrumb__link--static">
                    {item.label}
                  </span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
