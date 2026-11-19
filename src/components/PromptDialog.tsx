import { useState, type FormEvent, type HTMLAttributes, type ReactNode } from 'react'
import { Modal, touchScreen } from './Modal'

export interface PromptField {
  name: string
  label: string
  initial?: string
  placeholder?: string
  type?: 'text' | 'password' | 'url' | 'email'
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
  maxLength?: number
  minLength?: number
  required?: boolean
  prefix?: string
}

/**
 * Petite fenêtre au centre pour saisir un ou deux champs (nom, adresse, mot de passe…).
 * `onSubmit` renvoie un message d'erreur à afficher, ou rien si c'est bon.
 */
export function PromptDialog({ title, fields, confirm, onSubmit, onClose, children }: {
  title: string
  fields: PromptField[]
  confirm: string
  onSubmit: (values: Record<string, string>) => Promise<string | void> | string | void
  onClose: () => void
  children?: ReactNode
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, f.initial ?? ''])))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const err = await onSubmit(values)
      if (err) setError(err)
      else onClose()
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Action impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="prompt-form" onSubmit={submit}>
        {children}
        {fields.map((f, i) => (
          <label key={f.name} className="field">
            {f.label}
            <span className={`prompt-input${f.prefix ? ' has-prefix' : ''}`}>
              {f.prefix && <span className="prompt-prefix">{f.prefix}</span>}
              <input
                className={`input${error && i === 0 ? ' invalid' : ''}`}
                autoFocus={i === 0 && !touchScreen()}
                type={f.type ?? 'text'}
                inputMode={f.inputMode}
                autoComplete={f.autoComplete ?? 'off'}
                maxLength={f.maxLength}
                minLength={f.minLength}
                required={f.required}
                placeholder={f.placeholder}
                value={values[f.name]}
                onChange={(e) => { setValues((v) => ({ ...v, [f.name]: e.target.value })); setError(null) }}
              />
            </span>
          </label>
        ))}
        {error && <p className="prompt-error" role="alert">{error}</p>}
        <div className="prompt-foot">
          <button type="button" className="btn soft" onClick={onClose}>Annuler</button>
          <button className="btn" disabled={busy}>{confirm}</button>
        </div>
      </form>
    </Modal>
  )
}
