import { useEffect, useState } from 'react'
import { SectionsPage } from '../components/SectionsPage'
import { useToast } from '../components/Toast'
import { useStore } from '../lib/store'
import type { Provider } from '../lib/types'
import { PROVIDERS, ProviderIcon } from './Login'
import { AboutCard } from './AboutCard'
import { AppearanceCard } from './AppearanceCard'
import { DangerCard } from './DangerCard'
import { ProfileCard } from './ProfileCard'
import { PromptDialog } from '../components/PromptDialog'
import { PushCard } from './PushCard'

export function Settings() {
  const { backend } = useStore()
  const toast = useToast()
  const [linked, setLinked] = useState<Provider[]>([])
  const [editingPassword, setEditingPassword] = useState(false)


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

  return (
    <SectionsPage
      title="Réglages du compte"
      sections={[
        { id: 'profil', label: 'Profil', icon: 'user', render: () => <ProfileCard /> },
        {
          id: 'comptes',
          label: 'Comptes liés',
          icon: 'link',
          render: () => (
            <>
        <section className="card appear appear-2" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h2>Comptes liés</h2>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 14 }}>Connecte-toi avec n'importe lequel.</p>
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
        </section>
            </>
          ),
        },
        { id: 'notifications', label: 'Notifications', icon: 'bell', render: () => <PushCard /> },
        {
          id: 'apparence',
          label: 'Apparence',
          icon: 'palette',
          render: () => (
            <>
              <AppearanceCard />
            </>
          ),
        },
        {
          id: 'securite',
          label: 'Sécurité',
          icon: 'shield',
          render: () => (
            <>
        <section className="card">
          <h2>Mot de passe</h2>
          <div className="account">
            <span className="logo-box" style={{ background: 'var(--accent)' }}>@</span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <strong style={{ fontWeight: 600 }}>Email</strong>
              <span className="muted" style={{ fontSize: 13 }}>Mot de passe ou lien magique</span>
            </span>
            <button className="btn small soft" onClick={() => setEditingPassword(true)}>Mot de passe</button>
          </div>
          {editingPassword && (
            <PromptDialog title="Nouveau mot de passe" confirm="Enregistrer" onClose={() => setEditingPassword(false)}
              fields={[{ name: 'pw', label: 'Mot de passe', type: 'password', autoComplete: 'new-password', placeholder: '8 caractères minimum', minLength: 8, required: true }]}
              onSubmit={async (v) => { if (v.pw.length < 8) return '8 caractères minimum'; await backend.setPassword(v.pw); toast('Mot de passe enregistré') }} />
          )}
        </section>
              <DangerCard />
            </>
          ),
        },
        { id: 'a-propos', label: 'À propos', icon: 'info', render: () => <AboutCard /> },
      ]}
    />
  )
}
