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
  signup: { title: 'Crée ton compte', sub: 'Une minute, et ton équipe a son espace de travail.' },
  forgot: { title: 'Mot de passe oublié', sub: 'Indique ton email : on t’envoie un lien pour en choisir un nouveau.' },
  magic: { title: 'Lien de connexion', sub: 'Pas de mot de passe : on t’envoie un lien qui te connecte en un clic.' },
}

const PERKS = [
  { title: 'Tableau et sprints', text: 'Kanban glisser-déposer, tâches attribuées, points.' },
  { title: 'Chat du groupe', text: 'Salons, @mentions et liens de PR GitHub.' },
  { title: 'Partout', text: 'Web, téléphone, et appli Windows, Mac et Linux.' },
]

const STEPS = ['Tu crées ton compte', 'Tu confirmes ton email', 'Tu crées ton groupe ou tu rejoins celui d’un collègue']

/** Force du mot de passe, de 0 à 4, avec un conseil pour la suite. */
function strength(pw: string): { score: number; label: string; hint: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  else if (/\d|[^A-Za-z0-9]/.test(pw)) score += 0.5
  score = Math.min(4, Math.floor(score))
  if (pw.length < 8) return { score: 0, label: 'Trop court', hint: `Encore ${8 - pw.length} caractère${8 - pw.length > 1 ? 's' : ''}` }
  const labels = ['Faible', 'Faible', 'Correct', 'Bon', 'Excellent']
  const hint = score >= 4 ? 'Parfait.' : pw.length < 12 ? 'Plus long, c’est plus sûr.' : 'Ajoute des majuscules, chiffres ou symboles.'
  return { score, label: labels[score], hint }
}

function LegalLink({ path, children }: { path: string; children: string }) {
  if (!SITE_URL) return <>{children}</>
  return <button type="button" className="link-btn" style={{ fontWeight: 500 }} onClick={() => void openExternal(SITE_URL + path)}>{children}</button>
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 20 20 4" />}
    </svg>
  )
}

export function Login() {
  const { backend } = useStore()
  const [mode, setMode] = useState<Mode>('signin')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [sent, setSent] = useState<{ title: string; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const signup = mode === 'signup'
  const pw = strength(password)

  async function run(action: () => Promise<{ title: string; text: string } | void>) {
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
        const name = `${first.trim()} ${last.trim()}`.trim()
        const r = await backend.signUp(email, password, name)
        if (r.confirmEmail) return { title: 'Active ton compte', text: `On t’a envoyé un email d’activation à ${email}. Clique sur le bouton qu’il contient pour terminer ton inscription.` }
        return
      }
      if (mode === 'forgot') {
        await backend.sendPasswordReset(email)
        return { title: 'Regarde ta boîte mail', text: `Si un compte existe pour ${email}, un lien pour changer le mot de passe vient de partir.` }
      }
      const r = await backend.signIn('email', email)
      if (r.emailSent) return { title: 'Regarde ta boîte mail', text: `On t’a envoyé un lien de connexion à ${email}.` }
    })
  }

  const submitLabel = { signin: 'Se connecter', signup: 'Créer mon compte', forgot: 'Envoyer le lien', magic: 'Recevoir un lien de connexion' }[mode]
  const canSubmit = !busy && (!signup || (accepted && password.length >= 8 && first.trim() !== ''))

  return (
    <div className="login page">
      <section className="login-art" aria-hidden="true">
        <div className="login-art-brand"><LogoMark size={32} /> Kollab</div>
        {signup ? (
          <div className="login-art-copy">
            <h2>Ton équipe, ton code et tes sprints au même endroit.</h2>
            <ul className="login-perks">
              {PERKS.map((p) => (
                <li key={p.title}>
                  <span className="login-perk-dot" />
                  <span><strong>{p.title}</strong> {p.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="login-art-copy">
            <h2>Content de te revoir.</h2>
            <p>Tes tâches, ton chat et les PR à relire t’attendent.</p>
          </div>
        )}
        <div className="login-shot">
          <img src={signup ? "/vitrine/tableau-attribution.png" : "/vitrine/chat.png"} alt="" width={1360} height={860} />
        </div>
      </section>

      <section className="login-form">
        <div className="appear" key={mode}>
          <div className="login-brand" aria-hidden="true"><LogoMark size={36} /> Kollab</div>

          {(mode === 'signin' || mode === 'signup' || mode === 'magic') && (
            <div className="seg login-tabs" role="group" aria-label="Connexion ou inscription">
              <button type="button" aria-pressed={!signup} onClick={() => switchTo('signin')}>Se connecter</button>
              <button type="button" aria-pressed={signup} onClick={() => switchTo('signup')}>Créer un compte</button>
            </div>
          )}

          <div>
            <h1>{HEADINGS[mode].title}</h1>
            <p className="muted" style={{ margin: '4px 0 0' }}>{HEADINGS[mode].sub}</p>
          </div>

          {sent ? (
            <div className="card appear login-sent">
              <span className="login-sent-icon">✉</span>
              <strong style={{ fontSize: 18 }}>{sent.title}</strong>
              <p className="muted" style={{ margin: 0 }}>{sent.text}</p>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>Rien reçu ? Regarde dans les spams, ou réessaie dans une minute.</p>
              <button type="button" className="btn soft" onClick={() => setSent(null)}>Changer d’adresse</button>
            </div>
          ) : (
            <>
              <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {signup && (
                  <div className="grid-2">
                    <label className="field">
                      Prénom
                      <input className="input" required maxLength={30} autoComplete="given-name" placeholder="Léa" value={first} onChange={(e) => setFirst(e.target.value)} />
                    </label>
                    <label className="field">
                      Nom
                      <input className="input" maxLength={30} autoComplete="family-name" placeholder="Martin" value={last} onChange={(e) => setLast(e.target.value)} />
                    </label>
                  </div>
                )}
                <label className="field">
                  {signup ? 'Email' : 'Adresse email'}
                  <input className="input" type="email" required autoComplete="email" placeholder="toi@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
                  {signup && <span className="field-help">On t’enverra un email pour activer ton compte.</span>}
                </label>
                {(mode === 'signin' || signup) && (
                  <div className="field">
                    <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label htmlFor="password">Mot de passe</label>
                      {mode === 'signin' && <button type="button" className="link-btn" onClick={() => switchTo('forgot')}>Oublié ?</button>}
                    </span>
                    <div className="input-wrap">
                      <input
                        id="password"
                        className="input"
                        type={showPw ? 'text' : 'password'}
                        required
                        minLength={signup ? 8 : undefined}
                        autoComplete={signup ? 'new-password' : 'current-password'}
                        placeholder={signup ? '8 caractères minimum' : ''}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button type="button" className="input-eye" aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setShowPw(!showPw)}>
                        <EyeIcon open={showPw} />
                      </button>
                    </div>
                    {signup && password && (
                      <div className="pw-meter" aria-live="polite">
                        <div className="pw-bars">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= pw.score ? `on s${pw.score}` : ''} />)}</div>
                        <span className="field-help"><strong>{pw.label}</strong> · {pw.hint}</span>
                      </div>
                    )}
                  </div>
                )}
                {signup && (
                  <label className="login-terms">
                    <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                    <span>J'accepte les <LegalLink path={LEGAL_PATHS.cgu}>conditions d’utilisation</LegalLink> et la <LegalLink path={LEGAL_PATHS.confidentialite}>politique de confidentialité</LegalLink>.</span>
                  </label>
                )}
                <button className="btn provider" disabled={!canSubmit}>{busy ? 'Un instant…' : submitLabel}</button>
              </form>

              {mode === 'signin' && (
                <button type="button" className="link-btn login-alt" onClick={() => switchTo('magic')}>Recevoir plutôt un lien de connexion par email</button>
              )}
              {mode === 'magic' && (
                <button type="button" className="link-btn login-alt" onClick={() => switchTo('signin')}>Utiliser mon mot de passe</button>
              )}

              {mode !== 'forgot' && (
                <>
                  <div className="or">{signup ? 'ou s’inscrire avec' : 'ou continuer avec'}</div>
                  <div className="login-providers">
                    {PROVIDERS.map((p) => (
                      <button key={p.id} type="button" className="btn provider" style={{ background: p.bg }} disabled={busy} aria-label={`${signup ? 'S’inscrire' : 'Continuer'} avec ${p.label}`} onClick={() => void run(async () => void (await backend.signIn(p.id)))}>
                        <ProviderIcon path={p.icon} />
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                  {!signup && (
                    <p className="muted" style={{ margin: 0, fontSize: 12.5, textAlign: 'center' }}>
                      En continuant, tu acceptes les <LegalLink path={LEGAL_PATHS.cgu}>CGU</LegalLink> et la <LegalLink path={LEGAL_PATHS.confidentialite}>politique de confidentialité</LegalLink>.
                    </p>
                  )}
                </>
              )}

              {signup && (
                <ol className="login-steps" aria-label="Les étapes">
                  {STEPS.map((s, i) => <li key={s}><span>{i + 1}</span>{s}</li>)}
                </ol>
              )}
            </>
          )}

          {error && <p role="alert" style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}

          {mode === 'forgot' && (
            <p className="muted" style={{ margin: 0, textAlign: 'center', fontSize: 14 }}>
              <button type="button" className="link-btn" onClick={() => switchTo('signin')}>Retour à la connexion</button>
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
