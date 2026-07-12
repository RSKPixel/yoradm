import { getUserInitials } from '../../utils/userInitials'

export function UserAvatar({ name, profilePic, className = '' }) {
  const initials = getUserInitials(name)

  return (
    <span className={`shell-user-avatar ${className}`.trim()}>
      {profilePic ? (
        <img src={profilePic} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  )
}
