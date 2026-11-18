import { useEffect, useState, type FormEvent } from 'react'
import { useToast } from '../components/Toast'
import { useStore } from '../lib/store'
import { applyTheme, loadThemeChoice, saveThemeChoice, THEMES, type ThemeChoice } from '../lib/themes'
import type { Provider } from '../lib/types'
import { PROVIDERS, ProviderIcon } from './Login'
import { ProfileCard } from './ProfileCard'

export function Settings() {
  const { backend } = useStore()
  const toast = useToast()
  const [choice, setChoice] = useState<ThemeChoice>(loadThemeChoice)
  const [linked, setLinked] = useState<Provider[]>([])
  const [password, setPassword] = useState('')
  const [editingPassword, setEditingPassword] = useState(false)

  useEffect(() => {
    applyTheme(choice)
    saveThemeChoice(choice)
  }, [choice])

  useEffect(() => {
    void backend.linkedProviders().then(setLinked)
  }, [backend])

  async function toggle(provider: Provider) {
    try {
      if (linked.includes(provider)) {
        if (linked.length <= 1) return toast('Garde au moins un compte pour pouvoir te connecter')
        await backend.unlink(provider)
      } else {
        await backend.link(provider)
      }
      setLinked(await backend.linkedProviders())
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action impossible')
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    try {
      await backend.setPassword(password)
      setPassword('')
      setEditingPassword(false)
      toast('Mot de passe enregistré')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Changement impossible')
    }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1>Réglages</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18, alignItems: 'start' }}>
        <ProfileCard />
        <section className="card appear appear-2" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h2>Thème</h2>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 14 }}>Chaque membre choisit le sien.</p>
          </div>
          <div className="themes">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`theme-btn${choice.id === t.id && !choice.followSystem ? ' selected' : ''}`}
                aria-pressed={choice.id === t.id && !choice.followSystem}
                onClick={() => setChoice({ ...choice, id: t.id, accent: null, followSystem: false })}
              >
                <span className="swatch" style={{ background: t.bg }}>
                  <i style={{ background: t.accent }} />
                  <i style={{ background: t.surface, boxShadow: `inset 0 0 0 1px ${t.line}` }} />
                  <i style={{ background: t.ok }} />
                </span>
                {t.name}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" checked={choice.followSystem} onChange={(e) => setChoice({ ...choice, followSystem: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
            Passer en thème Nuit quand l'appareil est en mode sombre
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" value={choice.accent ?? THEMES.find((t) => t.id === choice.id)?.accent ?? '#5546E0'} onChange={(e) => setChoice({ ...choice, accent: e.target.value })} style={{ width: 40, height: 40, border: 0, background: 'transparent', padding: 0 }} />
            Couleur principale personnalisée
            {choice.accent && <button className="btn soft small" onClick={() => setChoice({ ...choice, accent: null })}>Réinitialiser</button>}
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn">Principal</button>
            <button className="btn ok">Approuver</button>
            <button className="btn danger">Refuser</button>
            <button className="btn soft">Secondaire</button>
          </div>
        </section>

        <section className="card appear appear-2" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h2>Comptes liés</h2>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 14 }}>Relie plusieurs comptes au même profil pour te connecter avec n'importe lequel.</p>
          </div>
          {PROVIDERS.map((p) => {
            const on = linked.includes(p.id)
            return (
              <div className="account" key={p.id}>
                <span className="logo-box" style={{ background: p.bg }}><ProviderIcon path={p.icon} /></span>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ fontWeight: 600 }}>{p.label}</strong>
                  <span className="muted" style={{ fontSize: 13 }}>{on ? 'Relié' : 'Non relié'}</span>
                </span>
                <button className={`btn small${on ? ' soft' : ''}`} onClick={() => void toggle(p.id)}>{on ? 'Délier' : 'Relier'}</button>
              </div>
            )
          })}
          <div className="account">
            <span className="logo-box" style={{ background: 'var(--accent)' }}>@</span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <strong style={{ fontWeight: 600 }}>Email</strong>
              <span className="muted" style={{ fontSize: 13 }}>Mot de passe ou lien magique</span>
            </span>
            {!editingPassword && <button className="btn small soft" onClick={() => setEditingPassword(true)}>Mot de passe</button>}
          </div>
          {editingPassword && (
            <form onSubmit={savePassword} className="appear" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label className="field" style={{ flex: '1 1 200px' }}>
                Nouveau mot de passe
                <input className="input" type="password" required minLength={8} autoComplete="new-password" placeholder="8 caractères minimum" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              <button className="btn">Enregistrer</button>
              <button type="button" className="btn soft" onClick={() => { setEditingPassword(false); setPassword('') }}>Annuler</button>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
