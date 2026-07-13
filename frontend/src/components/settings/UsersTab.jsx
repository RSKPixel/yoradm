import { useEffect, useState } from 'react'
import api from '../../api/client'
import { FormField, FormInput, FormPanel, FormSelect } from '../form/FormPanel'
import { useFormMessage } from '../form/FormMessage'
import { getApiErrorMessage, validateCreateUserForm } from '../../utils/formValidation'

export function UsersTab() {
  const { showError, showErrors, showSuccess } = useFormMessage()
  const [users, setUsers] = useState([])
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('User')
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    try {
      const { data } = await api.get('/users', {
        params: { page: 1, page_size: 100 },
      })
      setUsers(data.items)
    } catch (error) {
      showError(getApiErrorMessage(error, 'Failed to load users'))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate(e) {
    e.preventDefault()

    const validationErrors = validateCreateUserForm({
      fullName,
      username,
      email,
      password,
      role,
    })
    if (validationErrors.length) {
      showErrors(validationErrors)
      return
    }

    setSubmitting(true)
    try {
      await api.post('/users', {
        username,
        email,
        full_name: fullName,
        password,
        role,
        is_active: true,
      })
      setUsername('')
      setEmail('')
      setFullName('')
      setPassword('')
      setRole('User')
      showSuccess('User created successfully')
      await load()
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not create user'))
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(user) {
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active })
      showSuccess(user.is_active ? 'User deactivated' : 'User activated')
      await load()
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not update user'))
    }
  }

  async function changeRole(user, nextRole) {
    if (nextRole === user.role) return
    try {
      await api.patch(`/users/${user.id}`, { role: nextRole })
      showSuccess(`Role updated to ${nextRole}`)
      await load()
    } catch (error) {
      showError(getApiErrorMessage(error, 'Could not update role'))
    }
  }

  return (
    <div>
      <FormPanel
        title="Create User"
        onSubmit={onCreate}
        footer={
          <button type="submit" className="win-form__button win-form__button--primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Create user'}
          </button>
        }
      >
        <div className="grid gap-x-3 sm:grid-cols-2">
          <FormField label="Full name">
            <FormInput required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </FormField>
          <FormField label="Username">
            <FormInput required value={username} onChange={(e) => setUsername(e.target.value)} />
          </FormField>
          <FormField label="Email">
            <FormInput
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <FormField label="Password">
            <FormInput
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <FormField label="Role" className="sm:col-span-2">
            <FormSelect required value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="User">User</option>
              <option value="Admin">Admin</option>
            </FormSelect>
          </FormField>
        </div>
      </FormPanel>

      <FormPanel className="mt-8" title="Users" wide>
        <div className="win-form__table-wrap">
          <table className="win-form__table w-full text-left text-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.full_name}</td>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    <FormSelect
                      className="win-form__table-select"
                      aria-label={`Role for ${user.username}`}
                      value={user.role}
                      onChange={(e) => void changeRole(user, e.target.value)}
                    >
                      <option value="User">User</option>
                      <option value="Admin">Admin</option>
                    </FormSelect>
                  </td>
                  <td>{user.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="win-form__table-action">
                    <button
                      type="button"
                      onClick={() => void toggleActive(user)}
                      className="win-form__link"
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormPanel>
    </div>
  )
}
