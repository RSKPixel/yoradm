import { useEffect, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  createDevice,
  deleteDevice,
  fetchDevices,
  fetchMobileAudit,
  fetchRepOptions,
  reissueCode,
  revokeDevice,
  updateDevice,
} from '../../api/mobileAdmin'
import { FormAutocomplete } from '../form/FormAutocomplete'
import { FormButton, FormField, FormInput, FormPanel } from '../form/FormPanel'
import { useFormMessage } from '../form/FormMessage'
import { formatLastLogin, parseApiDate } from '../../utils/formatLastLogin'
import { getApiErrorMessage } from '../../utils/formValidation'

function formatWhen(value) {
  return value ? formatLastLogin(value) : '—'
}

function deviceStatus(device) {
  if (device.status === 'pending') {
    const expires = parseApiDate(device.activation_expires_at)
    return expires && expires.getTime() > Date.now() ? 'Awaiting activation' : 'Code expired'
  }
  return device.status === 'active' ? 'Active' : 'Revoked'
}

function RepPicker({ options, selected, onToggle, disabled = false }) {
  const available = options.filter((name) => !selected.has(name))
  const chosen = [...selected].sort((a, b) => a.localeCompare(b))
  return (
    <div>
      <FormAutocomplete
        options={available}
        value=""
        onChange={(name) => name && onToggle(name)}
        getOptionValue={(name) => name}
        getOptionLabel={(name) => name}
        disabled={disabled}
        emptyMessage={options.length ? 'No more representatives' : 'No representatives in Tally'}
      />
      {chosen.length ? (
        <div className="rep-chips">
          {chosen.map((name) => (
            <span key={name} className="rep-chip">
              {name}
              <button
                type="button"
                className="rep-chip__remove"
                aria-label={`Remove ${name}`}
                disabled={disabled}
                onClick={() => onToggle(name)}
              >
                <XMarkIcon aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="win-form__hint mt-1">Search and pick one or more representatives.</p>
      )}
    </div>
  )
}

function toggled(set, name) {
  const next = new Set(set)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  return next
}

export function MobileAccessTab() {
  const { showError, showErrors, showSuccess } = useFormMessage()
  const [devices, setDevices] = useState([])
  const [repOptions, setRepOptions] = useState([])
  const [audit, setAudit] = useState([])
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [reps, setReps] = useState(new Set())
  const [editing, setEditing] = useState(null) // { id, reps: Set }
  const [newCode, setNewCode] = useState(null) // { name, code, expires }
  const [busy, setBusy] = useState(false)

  async function load() {
    // Load independently so one failing list doesn't hide the others.
    const [list, options, log] = await Promise.allSettled([
      fetchDevices(),
      fetchRepOptions(),
      fetchMobileAudit({ limit: 100 }),
    ])
    if (list.status === 'fulfilled') setDevices(list.value)
    if (options.status === 'fulfilled') setRepOptions(options.value)
    if (log.status === 'fulfilled') setAudit(log.value)
    const failed = [list, options, log].find((r) => r.status === 'rejected')
    if (failed) showError(getApiErrorMessage(failed.reason, 'Failed to load mobile access'))
  }

  useEffect(() => {
    void load()
  }, [])

  async function run(action, success) {
    setBusy(true)
    try {
      await action()
      if (success) showSuccess(success)
      await load()
    } catch (error) {
      showError(getApiErrorMessage(error, 'Action failed'))
    } finally {
      setBusy(false)
    }
  }

  function showCode(result) {
    setNewCode({
      name: result.device.name,
      code: result.activation_code,
      expires: result.device.activation_expires_at,
    })
  }

  function onCreate(e) {
    e.preventDefault()
    const errors = []
    if (!name.trim()) errors.push('Salesman name is required.')
    if (!reps.size) errors.push('Select at least one representative.')
    if (errors.length) {
      showErrors(errors)
      return
    }
    void run(async () => {
      showCode(await createDevice({ name: name.trim(), label: label.trim() || null, reps: [...reps] }))
      setName('')
      setLabel('')
      setReps(new Set())
    })
  }

  function saveReps() {
    const { id, reps: selected } = editing
    void run(async () => {
      await updateDevice(id, { reps: [...selected] })
      setEditing(null)
    }, 'Representatives updated')
  }

  function revoke(device) {
    if (!window.confirm(`Revoke ${device.name}'s phone? It stops working immediately and wipes itself.`)) return
    void run(() => revokeDevice(device.id), 'Phone revoked')
  }

  function remove(device) {
    if (!window.confirm(`Delete ${device.name}'s phone from the list?`)) return
    void run(() => deleteDevice(device.id), 'Phone deleted')
  }

  return (
    <div>
      <p className="win-form__hint mb-4">
        Authorise each salesman&apos;s phone in person. The phone can then see receivables for the selected Tally
        representatives only, with no login. It must have a screen lock (PIN or fingerprint). Revoke a lost phone
        here and it stops working immediately.
      </p>

      {newCode ? (
        <FormPanel
          title="Activation code"
          footer={
            <FormButton variant="primary" onClick={() => setNewCode(null)}>
              Done
            </FormButton>
          }
        >
          <p className="text-sm">
            Open YORA DM on <strong>{newCode.name}</strong>&apos;s phone and enter this code. It works once and
            expires at {formatWhen(newCode.expires)}.
          </p>
          <p className="my-3 text-center font-mono text-3xl font-bold tracking-widest">{newCode.code}</p>
        </FormPanel>
      ) : (
        <FormPanel
          title="Authorise a phone"
          onSubmit={onCreate}
          footer={
            <button type="submit" className="win-form__button win-form__button--primary" disabled={busy}>
              {busy ? 'Saving…' : 'Get activation code'}
            </button>
          }
        >
          <div className="grid gap-x-3 sm:grid-cols-2">
            <FormField label="Salesman name">
              <FormInput required value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label="Phone (optional)">
              <FormInput
                placeholder="e.g. Redmi Note 12"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </FormField>
          </div>
          {/* Not a <label>: clicking a chip shouldn't focus the search box. */}
          <div className="win-form__field">
            <span className="win-form__label">Representatives</span>
            <RepPicker
              options={repOptions}
              selected={reps}
              disabled={busy}
              onToggle={(n) => setReps((s) => toggled(s, n))}
            />
          </div>
        </FormPanel>
      )}

      <FormPanel className="mt-8" title="Phones" wide>
        {devices.length === 0 ? (
          <p className="text-sm">No phones authorised yet.</p>
        ) : (
          <div className="win-form__table-wrap">
            <table className="win-form__table w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Salesman</th>
                  <th>Representatives</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => {
                  const status = deviceStatus(d)
                  return (
                    <tr key={d.id} className="align-top">
                      <td>
                        <div className="font-semibold">{d.name}</div>
                        <div className="text-xs">{[d.label, d.model].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td>
                        {editing?.id === d.id ? (
                          <div>
                            <RepPicker
                              options={repOptions}
                              selected={editing.reps}
                              disabled={busy}
                              onToggle={(n) => setEditing((e) => ({ ...e, reps: toggled(e.reps, n) }))}
                            />
                            <div className="mt-2 flex gap-2">
                              <FormButton variant="primary" disabled={busy} onClick={saveReps}>
                                Save
                              </FormButton>
                              <FormButton onClick={() => setEditing(null)}>Cancel</FormButton>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {d.reps.length ? d.reps.join(', ') : <em>None — sees no data</em>}
                            {d.status !== 'revoked' ? (
                              <div>
                                <button
                                  type="button"
                                  className="win-form__link"
                                  onClick={() => setEditing({ id: d.id, reps: new Set(d.reps) })}
                                >
                                  Edit
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td>
                        <div>{status}</div>
                        {d.status === 'active' ? (
                          <div className="text-xs">
                            Last seen {formatWhen(d.last_seen_at)}
                            {d.last_ip ? ` from ${d.last_ip}` : ''}
                            {d.app_version ? ` · v${d.app_version}` : ''}
                          </div>
                        ) : null}
                      </td>
                      <td className="win-form__table-action">
                        <div className="flex flex-col items-start gap-1">
                          {d.status === 'pending' ? (
                            <button
                              type="button"
                              className="win-form__link"
                              disabled={busy}
                              onClick={() => void run(async () => showCode(await reissueCode(d.id)))}
                            >
                              New code
                            </button>
                          ) : null}
                          {d.status === 'active' ? (
                            <button type="button" className="win-form__link" disabled={busy} onClick={() => revoke(d)}>
                              Revoke
                            </button>
                          ) : (
                            <button type="button" className="win-form__link" disabled={busy} onClick={() => remove(d)}>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </FormPanel>

      <FormPanel className="mt-8" title="Recent mobile activity" wide>
        <div className="win-form__table-wrap max-h-96 overflow-y-auto">
          <table className="win-form__table w-full text-left text-sm">
            <thead>
              <tr>
                <th>When</th>
                <th>Phone</th>
                <th>Event</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{formatWhen(e.created_at)}</td>
                  <td>{e.device_name || '—'}</td>
                  <td>{e.event}</td>
                  <td className="break-all">{e.path || e.detail || ''}</td>
                  <td>{e.ip || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormPanel>
    </div>
  )
}
