const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,64}$/

export function validateLoginForm({ username, password }) {
  const errors = []
  const trimmedUsername = username?.trim() ?? ''

  if (!trimmedUsername) {
    errors.push('Username is required.')
  } else if (trimmedUsername.length < 3) {
    errors.push('Username must be at least 3 characters.')
  }

  if (!password) {
    errors.push('Password is required.')
  } else if (password.length < 8) {
    errors.push('Password must be at least 8 characters.')
  }

  return errors
}

export function validateCreateUserForm({ fullName, username, email, password, role }) {
  const errors = []

  if (!fullName?.trim()) {
    errors.push('Full name is required.')
  }

  const trimmedUsername = username?.trim() ?? ''
  if (!trimmedUsername) {
    errors.push('Username is required.')
  } else if (!USERNAME_PATTERN.test(trimmedUsername)) {
    errors.push('Username must be 3–64 characters (letters, numbers, . _ -).')
  }

  const trimmedEmail = email?.trim() ?? ''
  if (!trimmedEmail) {
    errors.push('Email is required.')
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.push('Enter a valid email address.')
  }

  if (!password) {
    errors.push('Password is required.')
  } else if (password.length < 8) {
    errors.push('Password must be at least 8 characters.')
  }

  if (!role) {
    errors.push('Role is required.')
  }

  return errors
}

export function validateProfileForm({ fullName, email }) {
  const errors = []

  if (!fullName?.trim()) {
    errors.push('Full name is required.')
  }

  const trimmedEmail = email?.trim() ?? ''
  if (!trimmedEmail) {
    errors.push('Email is required.')
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.push('Enter a valid email address.')
  }

  return errors
}

export function validateCompanyProfileForm({
  company_name,
  address,
  city,
  state,
  email,
}) {
  const errors = []

  if (!company_name?.trim()) {
    errors.push('Company name is required.')
  }
  if (!address?.trim()) {
    errors.push('Address is required.')
  }
  if (!city?.trim()) {
    errors.push('City is required.')
  }
  if (!state?.trim()) {
    errors.push('State is required.')
  }

  const trimmedEmail = email?.trim() ?? ''
  if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
    errors.push('Enter a valid email address.')
  }

  return errors
}

export function validateChangePasswordForm({ currentPassword, newPassword, confirmPassword }) {
  const errors = []

  if (!currentPassword) {
    errors.push('Current password is required.')
  }

  if (!newPassword) {
    errors.push('New password is required.')
  } else if (newPassword.length < 8) {
    errors.push('New password must be at least 8 characters.')
  }

  if (!confirmPassword) {
    errors.push('Confirm password is required.')
  } else if (newPassword !== confirmPassword) {
    errors.push('New password and confirmation do not match.')
  }

  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.push('New password must be different from the current password.')
  }

  return errors
}

const PROFILE_PHOTO_MAX_BYTES = 1 * 1024 * 1024
const PROFILE_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function validateProfilePhotoFile(file) {
  if (!file) return 'Please select an image.'
  if (!PROFILE_PHOTO_TYPES.has(file.type)) {
    return 'Please select a JPG, PNG, WEBP, or GIF image.'
  }
  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    return 'Image must be 1 MB or smaller.'
  }
  return null
}

export function getApiErrorMessage(error, fallback = 'Something went wrong.') {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  if (error?.message) return error.message
  return fallback
}

export function validateDeliveryChallanForm({
  date,
  vehicleNo,
  driverName,
  lines,
}) {
  const errors = []

  if (!date) {
    errors.push('Delivery date is required.')
  }
  if (!vehicleNo?.trim()) {
    errors.push('Vehicle no. is required.')
  }
  if (!driverName?.trim()) {
    errors.push('Driver name is required.')
  }
  if (!lines?.length) {
    errors.push('Add at least one delivery item.')
  }

  return errors
}
