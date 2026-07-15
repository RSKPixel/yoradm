import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArchiveBoxIcon,
  ArrowsRightLeftIcon,
  ChartBarSquareIcon,
  ChevronDownIcon,
  BanknotesIcon,
  DocumentChartBarIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  CubeTransparentIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../auth/AuthContext'
import { fetchCompany } from '../api/company'
import {
  readSidebarPinned,
  SIDEBAR_HOVER_COLLAPSE_DELAY_MS,
  SIDEBAR_HOVER_EXPAND_DELAY_MS,
  writeSidebarPinned,
} from '../config/sidebarPin'
import { PushPinIcon } from './icons/PushPinIcon'
import { useSettings } from './settings/SettingsContext'
import { AppBrandName } from './layout/AppBrandName'
import { SpotlightBackground } from './layout/SpotlightBackground'
import { formatLastLogin } from '../utils/formatLastLogin'

const HEADER_HEIGHT = 'var(--shell-header-height)'

const linkClass = ({ isActive }) =>
  `shell-nav-link${isActive ? ' shell-nav-link-active' : ''}`

const navSections = [
  {
    id: 'transactions',
    label: 'Transactions',
    icon: ArrowsRightLeftIcon,
    items: [
      { to: '/transactions/delivery-challan', label: 'Delivery Challan', icon: ClipboardDocumentListIcon },
      { to: '/transactions/orid-dhall-production', label: 'Orid Dhall Production', icon: CubeTransparentIcon },
      { to: '/transactions/brokerage', label: 'Brokerage', icon: BanknotesIcon },
      { to: '/transactions/fixed-asset-register', label: 'Fixed Asset Register', icon: ArchiveBoxIcon },
    ],
  },
  {
    id: 'payroll',
    label: 'Payroll',
    icon: UserGroupIcon,
    items: [],
  },
  {
    id: 'reports',
    label: 'Report',
    icon: DocumentChartBarIcon,
    items: [
      { to: '/reports/receivables-analysis', label: 'Receivables Analysis', icon: ScaleIcon },
    ],
  },
]

function NavSection({ section, open, onToggle, expanded, onExpandRequest }) {
  const hasItems = section.items.length > 0
  const SectionIcon = section.icon

  function handleToggle() {
    if (!expanded) onExpandRequest?.()
    if (hasItems) onToggle(section.id)
  }

  return (
    <div className={`shell-nav-group${open && expanded ? ' shell-nav-group-open' : ''}`}>
      <button
        type="button"
        onClick={handleToggle}
        title={!expanded ? section.label : undefined}
        className={`shell-nav-section${hasItems ? '' : ' shell-nav-section-empty'}${open && expanded ? ' shell-nav-section-open' : ''}`}
      >
        <span className="shell-nav-section-main">
          <span className="shell-nav-icon-slot">
            <SectionIcon className="shell-nav-icon" aria-hidden="true" />
          </span>
          <span className="shell-nav-label">{section.label}</span>
        </span>
        {hasItems && (
          <ChevronDownIcon
            className={`shell-nav-chevron${open && expanded ? '' : ' shell-nav-chevron-closed'}`}
            aria-hidden="true"
          />
        )}
      </button>
      {hasItems && open && expanded && (
        <div className="shell-nav-children">
          {section.items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkClass} title={label}>
              <span className="shell-nav-icon-slot">
                <Icon className="shell-nav-icon" aria-hidden="true" />
              </span>
              <span className="shell-nav-label">{label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export function AppLayout() {
  const { user, logout, isAdmin } = useAuth()
  const { openSettings, isOpen: settingsOpen } = useSettings()
  const location = useLocation()
  const navigate = useNavigate()
  const [openSection, setOpenSection] = useState(null)
  const [sidebarPinned, setSidebarPinned] = useState(readSidebarPinned)
  const [sidebarHovered, setSidebarHovered] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const expandTimeoutRef = useRef(null)
  const collapseTimeoutRef = useRef(null)
  const displayName = user?.full_name || user?.username || ''
  const visibleSections = useMemo(
    () => navSections.filter((section) => !section.adminOnly || isAdmin),
    [isAdmin],
  )

  const isExpanded = sidebarPinned || sidebarHovered

  const loadCompanyName = useCallback(async () => {
    try {
      const company = await fetchCompany()
      setCompanyName(String(company?.company_name || '').trim())
    } catch {
      setCompanyName('')
    }
  }, [])

  useEffect(() => {
    void loadCompanyName()
  }, [loadCompanyName])

  useEffect(() => {
    if (!settingsOpen) void loadCompanyName()
  }, [settingsOpen, loadCompanyName])

  function clearExpandTimeout() {
    if (expandTimeoutRef.current != null) {
      clearTimeout(expandTimeoutRef.current)
      expandTimeoutRef.current = null
    }
  }

  function clearCollapseTimeout() {
    if (collapseTimeoutRef.current != null) {
      clearTimeout(collapseTimeoutRef.current)
      collapseTimeoutRef.current = null
    }
  }

  useEffect(
    () => () => {
      clearExpandTimeout()
      clearCollapseTimeout()
    },
    [],
  )

  useEffect(() => {
    if (location.pathname === '/') {
      setOpenSection(null)
      return
    }

    const match = visibleSections.find((section) =>
      section.items.some((item) => location.pathname.startsWith(item.to)),
    )
    if (match) setOpenSection(match.id)
  }, [location.pathname, visibleSections])

  function toggleSection(id) {
    setOpenSection((prev) => (prev === id ? null : id))
  }

  function toggleSidebarPin() {
    setSidebarPinned((pinned) => {
      const next = !pinned
      writeSidebarPinned(next)
      if (next) setSidebarHovered(false)
      return next
    })
  }

  function handleExpandRequest() {
    clearExpandTimeout()
    clearCollapseTimeout()
    setSidebarHovered(true)
  }

  function handleZoneMouseEnter() {
    if (sidebarPinned) return
    clearCollapseTimeout()
    clearExpandTimeout()
    expandTimeoutRef.current = setTimeout(() => {
      setSidebarHovered(true)
    }, SIDEBAR_HOVER_EXPAND_DELAY_MS)
  }

  function handleZoneMouseLeave() {
    clearExpandTimeout()
    if (sidebarPinned) return
    clearCollapseTimeout()
    collapseTimeoutRef.current = setTimeout(() => {
      setSidebarHovered(false)
    }, SIDEBAR_HOVER_COLLAPSE_DELAY_MS)
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const isPrimaryContentPage =
    location.pathname.startsWith('/transactions/orid-dhall-production') ||
    location.pathname.startsWith('/transactions/delivery-challan') ||
    location.pathname.startsWith('/reports/receivables-analysis')

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-(--bg) text-(--ink)">
      {/* Blur stars with filter (not backdrop-filter) so it works in production too. */}
      <div className="spotlight-bg-host spotlight-bg-host--soft" aria-hidden="true">
        <SpotlightBackground />
      </div>
      <header
        className="shell-header relative z-40 flex shrink-0 items-center justify-between gap-4 border-b border-(--line) bg-(--panel)/90 px-6 backdrop-blur-md"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="shell-header-start flex min-w-0 items-center">
          <Link to="/" className="shell-brand">
            <AppBrandName />
          </Link>
        </div>

        <div className="shell-header-end">
          {companyName ? (
            <button
              type="button"
              className="shell-header-company"
              title={companyName}
              onClick={() => openSettings('company')}
            >
              <span className="shell-header-company-name">{companyName}</span>
            </button>
          ) : null}
          <div className="shell-header-actions">
            <button
              type="button"
              className="shell-header-action"
              onClick={() => openSettings()}
            >
              Settings
            </button>
            <span className="shell-header-action-sep" aria-hidden="true">
              ·
            </span>
            <button
              type="button"
              className="shell-header-action shell-header-action-danger"
              onClick={() => void handleLogout()}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        <div
          className={`shell-sidebar-zone${
            sidebarPinned ? ' shell-sidebar-zone-pinned' : ' shell-sidebar-zone-unpinned'
          }${isExpanded ? ' shell-sidebar-zone-expanded' : ' shell-sidebar-zone-collapsed'}`}
          onMouseEnter={handleZoneMouseEnter}
          onMouseLeave={handleZoneMouseLeave}
        >
          <div
            className={`shell-sidebar-wrap${
              sidebarPinned ? ' shell-sidebar-wrap-pinned' : ' shell-sidebar-wrap-rail'
            }`}
          >
            <aside
              className={`shell-sidebar${isExpanded ? ' shell-sidebar-expanded' : ' shell-sidebar-collapsed'}`}
            >
              <nav className="shell-nav">
                <NavLink
                  to="/"
                  end
                  className={linkClass}
                  title={!isExpanded ? 'Dashboard' : undefined}
                  onClick={() => setOpenSection(null)}
                >
                  <span className="shell-nav-icon-slot">
                    <ChartBarSquareIcon className="shell-nav-icon" aria-hidden="true" />
                  </span>
                  <span className="shell-nav-label">Dashboard</span>
                </NavLink>

                <div className="shell-nav-divider" />

                {visibleSections.map((section) => (
                  <NavSection
                    key={section.id}
                    section={section}
                    open={openSection === section.id}
                    onToggle={toggleSection}
                    expanded={isExpanded}
                    onExpandRequest={handleExpandRequest}
                  />
                ))}
              </nav>

              <div className="shell-sidebar-footer">
                <button
                  type="button"
                  className={`shell-sidebar-pin${sidebarPinned ? ' shell-sidebar-pin-active' : ''}`}
                  onClick={toggleSidebarPin}
                  aria-label={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar open'}
                  aria-pressed={sidebarPinned}
                  title={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar open'}
                >
                  <PushPinIcon className="size-4" solid={sidebarPinned} />
                </button>
                <div className="shell-sidebar-user-meta">
                  <button
                    type="button"
                    className="shell-sidebar-username"
                    title={displayName}
                    onClick={() => openSettings('profile')}
                  >
                    {displayName}
                  </button>
                  <span className="shell-sidebar-last-login" title={formatLastLogin(user?.last_login_at)}>
                    Last login: {formatLastLogin(user?.last_login_at)}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <main
          className={`shell-main relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden${
            isPrimaryContentPage ? ' overflow-hidden p-0' : ' overflow-y-auto p-8'
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
