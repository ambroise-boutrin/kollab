import { useEffect, useState } from 'react'
import { LogoMark } from '../components/Logo'
import { ProjectForm } from '../components/ProjectForm'
import { useToast } from '../components/Toast'
import { APP_BASE } from '../lib/base'
import { finishIntro, introDone, readIntro, saveIntro, type IntroState, type IntroStep } from '../lib/intro'
import { rememberGroup, useStore } from '../lib/store'
import type { Provider } from '../lib/types'
import { PROVIDERS, ProviderIcon } from './Login'

const ORDER: IntroStep[] = ['bienvenue', 'projet', 'comptes', 'equipe', 'fin']

/** Premier lancement : bienvenue, projet, comptes à relier, invitation, puis la visite. */
export function Intro() {
  const { backend, user, reload } = useStore()
  const toast = useToast()
  const uid = user!.id
  const invitation = new URLSearchParams(location.search).get('invitation') ?? ''
  const [state, setState] = useState<IntroState>(
    () => readIntro(uid) ?? { step: introDone(uid) || invitation ? 'projet' : 'bienvenue' },
  )
  const [linked, setLinked] = useState<Provider[]>([])
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const firstName = user?.name.split(/\s+/)[0] ?? ''

  const go = (next: IntroState) => {
    saveIntro(uid, next)
    setState(next)
  }

  useEffect(() => {
    if (state.step === 'comptes') void backend.linkedProviders().then(setLinked).catch(() => setLinked([]))
    if (state.step === 'equipe' && !inviteUrl) {
      backend
        .createInvite('member', { days: 7, maxUses: null })
        .then((inv) => setInviteUrl(`${location.origin}${APP_BASE}/?invitation=${inv.code}`))
        .catch(() => setInviteUrl(null))
    }
  }, [state.step, backend, inviteUrl])

  async function done() {
    finishIntro(uid)
    history.replaceState(null, '', `${APP_BASE}/`)
    await reload()
  }

  async function link(p: Provider) {
    try {
      await backend.link(p) // redirige vers le fournisseur ; l'introduction reprend ici au retour
      setLinked(await backend.linkedProviders())
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Liaison impossible')
    }
  }

  async function copy() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast('Lien copié')
    } catch {
      toast(inviteUrl)
    }
  }

  const steps = ORDER.filter((s) => s !== 'equipe' || state.how !== 'joined')
  const index = steps.indexOf(state.step)

  return (
    <div className="intro">
      <div className="intro-card" key={state.step}>
        <div className="intro-top">
          <LogoMark size={28} />
          <div className="intro-steps" aria-label={`Étape ${index + 1} sur ${steps.length}`}>
            {steps.map((s, n) => <span key={s} className={n === index ? 'on' : n < index ? 'past' : undefined} />)}
          </div>
        </div>

        {state.step === 'bienvenue' && (
          <>
            <h1>Bienvenue{firstName ? `, ${firstName}` : ''}</h1>
            <p className="intro-lead">Kollab réunit les tâches, le sprint et le chat de ton équipe.</p>
            <ul className="intro-list">
              <li><b style={{ background: '#E7E3FF' }}>1</b>Crée ou rejoins un projet</li>
              <li><b style={{ background: '#FFF3C4' }}>2</b>Relie tes comptes</li>
              <li><b style={{ background: '#D9F5E8' }}>3</b>Invite ton équipe</li>
            </ul>
            <div className="intro-actions">
              <button className="btn" onClick={() => go({ step: 'projet' })} autoFocus>Commencer</button>
            </div>
          </>
        )}

        {state.step === 'projet' && (
          <>
            <h1>Ton projet</h1>
            <p className="intro-lead">Choisis un modèle, tu pourras tout changer ensuite.</p>
            <ProjectForm
              initialCode={invitation}
              onDone={({ id, how }) => {
                rememberGroup(id)
                go({ step: 'comptes', how })
              }}
            />
          </>
        )}

        {state.step === 'comptes' && (
          <>
            <h1>Relie tes comptes</h1>
            <p className="intro-lead">Pour te connecter avec, et lier tes PR GitHub aux tâches.</p>
            <div className="stack" style={{ gap: 8 }}>
              {PROVIDERS.map((p) => {
                const on = linked.includes(p.id)
                return (
                  <div className="account" key={p.id}>
                    <span className="logo-box" style={{ background: p.bg }}><ProviderIcon path={p.icon} /></span>
                    <strong style={{ flex: 1, fontWeight: 600 }}>{p.label}</strong>
                    {on ? <span className="tag" style={{ background: 'color-mix(in srgb, var(--ok) 15%, transparent)', color: 'var(--ok)' }}>Relié</span>
                      : <button className="btn small soft" onClick={() => void link(p.id)}>Relier</button>}
                  </div>
                )
              })}
            </div>
            <div className="intro-actions">
              <button className="btn" onClick={() => go({ ...state, step: state.how === 'joined' ? 'fin' : 'equipe' })}>Continuer</button>
              <button className="link-btn" onClick={() => go({ ...state, step: state.how === 'joined' ? 'fin' : 'equipe' })}>Plus tard</button>
            </div>
          </>
        )}

        {state.step === 'equipe' && (
          <>
            <h1>Invite ton équipe</h1>
            <p className="intro-lead">Envoie ce lien. Valable 7 jours, droits de membre.</p>
            <div className="invite-box">
              <code>{inviteUrl ?? 'Création du lien…'}</code>
              <button className="btn small" onClick={() => void copy()} disabled={!inviteUrl}>Copier</button>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>Autres droits et liens : menu Équipe.</p>
            <div className="intro-actions">
              <button className="btn" onClick={() => go({ ...state, step: 'fin' })}>Continuer</button>
            </div>
          </>
        )}

        {state.step === 'fin' && (
          <>
            <h1>C'est prêt</h1>
            <p className="intro-lead">Une visite rapide pour te repérer, puis à toi de jouer.</p>
            <div className="intro-actions">
              <button className="btn" onClick={() => void done()} autoFocus>Ouvrir mon projet</button>
            </div>
          </>
        )}

        {state.step !== 'bienvenue' && state.step !== 'fin' && (
          <button className="intro-out link-btn" onClick={() => void backend.signOut()}>Se déconnecter</button>
        )}
      </div>
    </div>
  )
}
