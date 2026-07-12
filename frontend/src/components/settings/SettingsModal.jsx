import { useMemo, useState } from 'react'
import { Cog6ToothIcon, KeyIcon, UserCircleIcon, UsersIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../auth/AuthContext'
import { Modal } from '../common/Modal'
import { PasswordTab } from './PasswordTab'
import { ProfileTab } from './ProfileTab'
import { UsersTab } from './UsersTab'

export function SettingsModal({ onClose, initialTab = 'general' }) {
  const { isAdmin } = useAuth()
  const tabs = useMemo(
    () => [
      { id: 'general', label: 'General', icon: Cog6ToothIcon },
      { id: 'profile', label: 'Profile', icon: UserCircleIcon },
      { id: 'password', label: 'Password', icon: KeyIcon },
      ...(isAdmin ? [{ id: 'users', label: 'Users', icon: UsersIcon }] : []),
    ],
    [isAdmin],
  )

  const [activeTab, setActiveTab] = useState(() =>
    tabs.some((tab) => tab.id === initialTab) ? initialTab : 'general',
  )

  return (
    <Modal
      title="Settings"
      titleIcon={Cog6ToothIcon}
      onClose={onClose}
      ariaLabelledBy="settings-modal-title"
      className="settings-shell-card"
    >
      <div className="settings-layout">
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`settings-tab-${tab.id}`}
                aria-selected={active}
                aria-controls={`settings-panel-${tab.id}`}
                className={`settings-tab${active ? ' settings-tab-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="settings-tab-icon" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div
          className="settings-panel"
          role="tabpanel"
          id={`settings-panel-${activeTab}`}
          aria-labelledby={`settings-tab-${activeTab}`}
        >
          <div className="settings-panel-body">
            {activeTab === 'general' && (
              <p className="text-sm text-(--muted)">General settings will be added here.</p>
            )}
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'password' && <PasswordTab />}
            {activeTab === 'users' && isAdmin && <UsersTab />}
          </div>
        </div>
      </div>
    </Modal>
  )
}
