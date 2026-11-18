import { useState, type FormEvent } from 'react'
import { LogoMark } from '../components/Logo'
import { LEGAL_PATHS } from '../lib/legal'
import { openExternal, SITE_URL } from '../lib/links'
import { useStore } from '../lib/store'
import type { Provider } from '../lib/types'

export const PROVIDERS: { id: Exclude<Provider, 'email'>; label: string; bg: string; icon: string }[] = [
  {
    id: 'github',
    label: 'GitHub',
    bg: '#14142B',
    icon: 'M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z',
  },
  {
    id: 'google',
    label: 'Google',
    bg: '#1F5FC4',
    icon: 'M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9zM12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.7 9.4 5.9 12 5.9z',
  },
  {
    id: 'discord',
    label: 'Discord',
    bg: '#5865F2',
    icon: 'M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.5 0L8.7 3a19.6 19.6 0 0 0-4.9 1.5C.7 9.1-.2 13.6.3 18.1a19.8 19.8 0 0 0 6 3l1.3-2a12.8 12.8 0 0 1-2-1l.5-.4a14 14 0 0 0 12 0l.5.4a12.8 12.8 0 0 1-2 1l1.3 2a19.7 19.7 0 0 0 6-3c.5-5.2-.9-9.7-3.6-13.7zM8.3 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4zm7.4 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4z',
  },
]

export function ProviderIcon({ path }: { path: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

type Mode = 'signin' | 'signup' | 'forgot' | 'magic'

const HEADINGS: Record<Mode, { title: string; sub: string }> = {
  signin: { title: 'Bon retour', sub: 'Connecte-toi pour retrouver ton groupe.' },
  signup: { title: 'Créer un compte', sub: 'Un compte Kollab, sans GitHub, Google ni Discord.' },
  forgot: { title: 'Mot de passe oublié', sub: 'On t’envoie un lien pour en choisir un nouveau.' },
  magic: { title: 'Bon retour', sub: 'Connecte-toi pour retrouver ton groupe.' },
}

function LegalLink({ path, children }: { path: string; children: string }) {
  if (!SITE_URL) return <>{children}</>
  return <button type="button" className="link-btn" style={{ fontWeight: 500 }} onClick={() => void openExternal(SITE_URL + path)}>{children}</button>
}

export function Login() {
  const { backend } = useStore()
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)

  async function run(action: () => Promise<string | void>) {
    setError(null)
    setBusy(true)
    try {
      const msg = await action()
      if (msg) setSent(msg)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible')
    } finally {
      setBusy(false)
    }
  }

  function switchTo(next: Mode) {
    setMode(next)
    setError(null)
    setSent(null)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void run(async () => {
      if (mode === 'signin') return backend.signInWithPassword(email, password)
      if (mode === 'signup') {
        const r = await backend.signUp(email, password, name.trim())
        if (r.confirmEmail) return `On t’a envoyé un lien à ${email} pour confirmer ton compte.`
        return
      }
      if (mode === 'forgot') {
        await backend.sendPasswordReset(email)
        return `Si un compte existe pour ${email}, un lien pour changer le mot de passe vient de partir.`
      }
      const r = await backend.signIn('email', email)
      if (r.emailSent) return `On t’a envoyé un lien de connexion à ${email}.`
    })
  }

  const usesPassword = mode === 'signin' || mode === 'signup'
  const submitLabel = { signin: 'Se connecter', signup: 'Créer mon compte', forgot: 'Envoyer le lien', magic: 'Recevoir un lien de connexion' }[mode]

  return (
    <div className="login page">
      <section className="login-art" aria-hidden="true">
        <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 22 }}>Kollab</div>
        <div className="float"><LogoMark size={200} /></div>
        <div style={{ maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 style={{ fontSize: 28, lineHeight: 1.2, fontWeight: 700 }}>Ton équipe, ton code et tes sprints au même endroit.</h2>
          <p className="muted" style={{ margin: 0 }}>Relis les PR, organise les sprints et discute avec ton groupe, sur ordinateur comme sur téléphone.</p>
        </div>
      </section>

      <section className="login-form">
        <div className="appear" key={mode}>
          <div className="login-brand" aria-hidden="true"><LogoMark size={36} /> Kollab</div>
          <div>
            <h1>{HEADINGS[mode].title}</h1>
            <p className="muted" style={{ margin: '4px 0 0' }}>{HEADINGS[mode].sub}</p>
          </div>

          {(mode === 'signin' || mode === 'magic') && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PROVIDERS.map((p) => (
                  <button key={p.id} className="btn provider" style={{ background: p.bg }} disabled={busy} onClick={() => void run(async () => void (await backend.signIn(p.id)))}>
                    <ProviderIcon path={p.icon} />
                    Continuer avec {p.label}
                  </button>
                ))}
              </div>
              <p className="muted" style={{ margin: '-4px 0 0', fontSize: 13, textAlign: 'center' }}>
                En continuant, tu acceptes les <LegalLink path={LEGAL_PATHS.cgu}>CGU</LegalLink> et la <LegalLink path={LEGAL_PATHS.confidentialite}>politique de confidentialité</LegalLink>.
              </p>
              <div className="or">ou par email</div>
              <div className="seg" role="group" aria-label="Façon de se connecter" style={{ alignSelf: 'center' }}>
                <button type="button" aria-pressed={mode === 'signin'} onClick={() => switchTo('signin')}>Mot de passe</button>
                <button type="button" aria-pressed={mode === 'magic'} onClick={() => switchTo('magic')}>Lien magique</button>
              </div>
            </>
          )}

          {sent ? (
            <div className="card appear" style={{ textAlign: 'center' }}>
              <strong>Regarde ta boîte mail</strong>
              <p className="muted" style={{ margin: '4px 0 0' }}>{sent}</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mode === 'signup' && (
                <label className="field">
                  Ton nom
                  <input className="input" required maxLength={40} autoComplete="name" placeholder="ex. Léa" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
              )}
              <label className="field">
                Adresse email
                <input className="input" type="email" required autoComplete="email" placeholder="toi@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              {usesPassword && (
                <div className="field">
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label htmlFor="password">Mot de passe</label>
                    {mode === 'signin' && <button type="button" className="link-btn" onClick={() => switchTo('forgot')}>Oublié ?</button>}
                  </span>
                  <input
                    id="password"
                    className="input"
                    type="password"
                    required
                    minLength={mode === 'signup' ? 8 : undefined}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    placeholder={mode === 'signup' ? '8 caractères minimum' : ''}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}
              {mode === 'signup' && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14 }}>
                  <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ width: 18, height: 18, marginTop: 3, flex: 'none', accentColor: 'var(--accent)' }} />
                  <span>J'accepte les <LegalLink path={LEGAL_PATHS.cgu}>CGU</LegalLink> et la <LegalLink path={LEGAL_PATHS.confidentialite}>politique de confidentialité</LegalLink>.</span>
                </label>
              )}
              <button className="btn provider" disabled={busy || (mode === 'signup' && !accepted)}>{submitLabel}</button>
              {mode === 'magic' && <span className="muted" style={{ fontSize: 13, textAlign: 'center' }}>Pas de mot de passe : un lien magique arrive par email.</span>}
            </form>
          )}

          {error && <p role="alert" style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}

          <p className="muted" style={{ margin: 0, textAlign: 'center', fontSize: 14 }}>
            {mode === 'signup' || mode === 'forgot' ? (
              <button type="button" className="link-btn" onClick={() => switchTo('signin')}>Retour à la connexion</button>
            ) : (
              <>Pas encore de compte ? <button type="button" className="link-btn" onClick={() => switchTo('signup')}>Créer un compte</button></>
            )}
          </p>
        </div>
      </section>
    </div>
  )
}
