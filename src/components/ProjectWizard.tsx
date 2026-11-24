import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useGhLinked } from '../lib/useGhLinked'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { Modal, touchScreen } from './Modal'
import { PROJECT_COLORS, ProjectMark } from './ProjectMark'
import { inviteUrl } from './InviteDialog'
import { useToast } from './Toast'
import { shrinkSquare } from '../lib/image'
import { myRepos, type RepoInfo } from '../lib/github'
import { enablePush, pushSupport } from '../lib/push'
import { normalizeRepo, PRESETS } from '../lib/presets'
import { addDays, isoDay } from '../lib/sprints'
import { useStore } from '../lib/store'
import { TEAM_TITLES } from '../lib/types'
import { useAsync } from '../lib/useAsync'

const STEPS = 6
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DRAFT_KEY = 'kollab-wizard'
const INVITE_COLORS = ['#2E7D4F', '#2F6FD0', '#D9822B', '#9B3FB8', '#C2413A', '#0F7A63']
const MY_TITLES = ['Chef de projet', 'Product Owner', 'Scrum Master', 'Développeur']
const WEEKS = [1, 2, 3, 4]
const TIMES = ['09:00', '09:30', '10:00', '14:00']
/** Abréviations affichées sur le bouton de rôle d'un invité. */
const SHORT: Record<string, string> = { 'Développeur front': 'Dév front', 'Développeur back': 'Dév back', 'Développeur full stack': 'Dév full stack', 'Développeur mobile': 'Dév mobile' }

interface Draft {
  step: number
  name: string
  color: string | null
  preset: string
  repo: string
  invites: { email: string; title: string }[]
  myTitle: string
  shareLink: boolean
  weeks: number | null
  daily: string | null
  discord: string
  push: boolean
}

const fresh = (): Draft => ({ step: 1, name: '', color: null, preset: 'scrum', repo: '', invites: [], myTitle: 'Chef de projet', shareLink: false, weeks: 2, daily: '09:30', discord: '', push: false })

/** Brouillon gardé le temps d'aller se connecter à GitHub. */
export function hasWizardDraft() {
  try {
    return sessionStorage.getItem(DRAFT_KEY) != null
  } catch {
    return false
  }
}
function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (raw) {
      sessionStorage.removeItem(DRAFT_KEY)
      return { ...fresh(), ...(JSON.parse(raw) as Partial<Draft>) }
    }
  } catch {
    /* ignoré */
  }
  return fresh()
}

const timeLabel = (t: string) => t.replace(/^0/, '').replace(':00', ' h').replace(':', ' h ')
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return d <= 0 ? "modifié aujourd'hui" : d === 1 ? 'modifié hier' : `il y a ${d} j`
}

/**
 * Création d'un projet en six étapes : nom et visuel, modèle, dépôt GitHub, équipe, rythme, Discord.
 * Tout se passe sauf le nom. Plein écran sur téléphone, fenêtre au centre sur ordinateur.
 */
export function ProjectWizard({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void | Promise<void> }) {
  const { backend, user } = useStore()
  const toast = useToast()
  const [d, setD] = useState<Draft>(loadDraft)
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))
  const [logo, setLogo] = useState<Blob | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preset = PRESETS.find((p) => p.id === d.preset) ?? PRESETS[0]
  const step = d.step
  const go = (n: number) => { setError(null); set({ step: Math.min(STEPS, Math.max(1, n)) }) }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function create() {
    const repoUrl = d.repo ? normalizeRepo(d.repo) : null
    setBusy(true)
    setError(null)
    try {
      const id = await backend.createGroup(d.name.trim() || 'Mon projet', { ...preset.setup, repoUrl })
      // Le reste vise le nouveau projet : on l'ouvre côté serveur avant de continuer.
      await backend.loadWorkspace(id)
      const misses: string[] = []
      const tryIt = async (label: string, fn: () => Promise<unknown>) => { try { await fn() } catch { misses.push(label) } }
      if (logo) await tryIt('logo', () => backend.setGroupLogo(logo, id))
      await tryIt('rythme', () => backend.setGroupPrefs({ color: d.color, sprintDays: d.weeks ? d.weeks * 7 : null, dailyTime: d.daily }, id))
      if (d.weeks) {
        const start = isoDay(new Date())
        await tryIt('sprint', () => backend.createSprint({ name: 'Sprint 1', goal: '', startsOn: start, endsOn: addDays(start, d.weeks! * 7 - 1), status: 'active' }))
      }
      if (user && d.myTitle) await tryIt('ton rôle', () => backend.setMemberTitle(user.id, d.myTitle))
      for (const inv of d.invites) {
        await tryIt(inv.email, async () => {
          await backend.inviteByEmail(inv.email, 'member')
          if (inv.title) await backend.setInviteTitle(inv.email, inv.title)
        })
      }
      if (d.discord.trim()) await tryIt('Discord', () => backend.setDiscordWebhook(d.discord.trim()))
      if (d.push && backend.push) await tryIt('notifications', () => enablePush(backend.push!))
      if (d.shareLink) {
        await tryIt("lien d'invitation", async () => {
          const inv = await backend.createInvite('member', { days: 7, maxUses: null })
          await navigator.clipboard?.writeText(inviteUrl(inv.code))
        })
      }
      await onDone(id)
      toast(misses.length ? `Projet créé. À refaire dans les réglages : ${misses.join(', ')}` : d.shareLink ? "Projet créé, lien d'invitation copié" : 'Projet créé')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible')
      setBusy(false)
    }
  }

  function next() {
    if (step === 1 && !d.name.trim()) return setError('Donne un nom au projet')
    if (step === 3 && d.repo.trim() && !normalizeRepo(d.repo)) return setError('Écris « compte/projet » ou colle son adresse')
    if (step === 6 && d.discord.trim() && !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(d.discord.trim())) return setError('Ce lien ne ressemble pas à un webhook Discord')
    if (step === STEPS) return void create()
    go(step + 1)
  }

  /** Passer : l'étape est vidée puis on avance. */
  function skip() {
    if (step === 3) set({ repo: '' })
    if (step === 4) set({ invites: [], shareLink: false })
    if (step === 5) set({ weeks: null, daily: null })
    if (step === 6) set({ discord: '', push: false })
    if (step === STEPS) return void create()
    go(step + 1)
  }

  const footLabel =
    step === STEPS ? (busy ? 'Création…' : 'Créer le projet')
    : step === 4 && d.invites.length ? `Inviter ${d.invites.length} personne${d.invites.length > 1 ? 's' : ''} et continuer`
    : 'Continuer'

  return createPortal(
    <div className="wizard-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wizard" role="dialog" aria-modal="true" aria-label="Nouveau projet">
        <header className="wz-head">
          <div className="wz-bar">
            {step > 1 ? (
              <button className="wz-back" aria-label="Retour" onClick={() => go(step - 1)}><Icon name="chevron" size={20} /></button>
            ) : (
              <button className="wz-text-btn accent" onClick={onClose}>Annuler</button>
            )}
            <span className="wz-count">{step} sur {STEPS}</span>
            {step > 1 ? <button className="wz-text-btn" onClick={skip} disabled={busy}>Passer</button> : <span className="wz-spacer" />}
          </div>
          <div className="wz-progress" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, i) => <i key={i} className={i + 1 < step ? 'done' : i + 1 === step ? 'now' : ''} />)}
          </div>
        </header>

        <div className="wz-body" key={step}>
          {step > 1 && (
            <div className="wz-project">
              <ProjectMark id={d.name || 'nouveau'} logoUrl={logoPreview} color={d.color} size={44} radius={13} />
              <span><b>{d.name.trim() || 'Mon projet'}</b> · {preset.name}</span>
            </div>
          )}
          {step === 1 && <StepName d={d} set={set} logoPreview={logoPreview} onLogo={async (f) => {
            try {
              const small = await shrinkSquare(f, 320)
              setLogo(small)
              setLogoPreview(URL.createObjectURL(small))
            } catch {
              setError('Image illisible')
            }
          }} />}
          {step === 2 && <StepPreset d={d} set={set} />}
          {step === 3 && <StepRepo d={d} set={set} onConnect={() => {
            try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* ignoré */ }
            backend.connectGitHub().then(() => { try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* ignoré */ } }).catch((e: Error) => { try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* ignoré */ } toast(e.message) })
          }} />}
          {step === 4 && <StepTeam d={d} set={set} />}
          {step === 5 && <StepRhythm d={d} set={set} />}
          {step === 6 && <StepDiscord d={d} set={set} canPush={!!backend.push && pushSupport() === 'ok'} />}
          {error && <p role="alert" className="form-error">{error}</p>}
        </div>

        <footer className="wz-foot">
          <button className="wz-main" onClick={next} disabled={busy}>{footLabel}</button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

type StepProps = { d: Draft; set: (p: Partial<Draft>) => void }

function Title({ children, help }: { children: ReactNode; help: ReactNode }) {
  return (
    <>
      <h1 className="wz-title">{children}</h1>
      <p className="wz-help">{help}</p>
    </>
  )
}

function StepName({ d, set, logoPreview, onLogo }: StepProps & { logoPreview: string | null; onLogo: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <Title help="Un nom, une image et une couleur. Tout se change ensuite.">Ton nouveau projet</Title>
      <div className="wz-identity">
        <button type="button" className="wz-logo" aria-label="Choisir un logo" onClick={() => input.current?.click()}>
          <ProjectMark id={d.name || 'nouveau'} logoUrl={logoPreview} color={d.color} size={96} radius={27} />
          <span className="wz-logo-badge" aria-hidden="true"><Icon name="photo" size={16} /></span>
        </button>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogo(f); e.target.value = '' }} />
      </div>
      <label className="wz-field">
        <span>Nom du projet</span>
        <input className="wz-input" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="ex. Projet L3" maxLength={80} autoFocus={!touchScreen()} />
      </label>
      <div className="wz-field">
        <span>Couleur</span>
        <div className="wz-swatches" role="radiogroup" aria-label="Couleur">
          {PROJECT_COLORS.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={d.color === c.id} aria-label={c.label} style={{ ['--c' as string]: c.id }} onClick={() => set({ color: d.color === c.id ? null : c.id })} />
          ))}
        </div>
      </div>
    </>
  )
}

function StepPreset({ d, set }: StepProps) {
  return (
    <>
      <Title help="Il crée les premiers salons et les premières tâches.">Quel modèle ?</Title>
      <div className="wz-list">
        {PRESETS.map((p) => {
          const on = d.preset === p.id
          const tasks = p.setup.tasks?.length ?? 0
          const chans = p.setup.channels?.length ?? 0
          return (
            <button key={p.id} type="button" className={`wz-row${on ? ' on' : ''}`} aria-pressed={on} onClick={() => set({ preset: p.id })}>
              <span className="wz-row-mark" style={{ background: p.color }}>{p.name[0]}</span>
              <span className="wz-row-text"><b>{p.name}</b><span>{chans} salons, {tasks} tâche{tasks > 1 ? 's' : ''}</span></span>
              {on && <Icon name="check" size={20} />}
            </button>
          )
        })}
      </div>
    </>
  )
}

function StepRepo({ d, set, onConnect }: StepProps & { onConnect: () => void }) {
  const token = useGhLinked()
  const repos = useAsync<RepoInfo[]>(token ? myRepos : null, [token])
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (repos.data ?? []).filter((r) => !s || r.fullName.toLowerCase().includes(s)).slice(0, 8)
  }, [repos.data, q])
  const picked = normalizeRepo(d.repo)
  /** Le compte le plus présent : sans doute le tien. */
  const mine = useMemo(() => {
    const n = new Map<string, number>()
    for (const r of repos.data ?? []) { const o = r.fullName.split('/')[0]; n.set(o, (n.get(o) ?? 0) + 1) }
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  }, [repos.data])
  return (
    <>
      <Title help="Les tâches créeront leurs branches et leurs PR ici.">Quel dépôt GitHub ?</Title>
      {token ? (
        <>
          <label className="wz-search">
            <Icon name="search" size={18} />
            <input aria-label="Chercher un dépôt" placeholder="Chercher dans tes dépôts" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="wz-list">
            {repos.loading && <p className="wz-help">Chargement…</p>}
            {repos.error && <p className="wz-help">{repos.error}</p>}
            {shown.map((r) => {
              const on = picked === r.url
              const owner = r.fullName.split('/')[0]
              return (
                <button key={r.fullName} type="button" className={`wz-row${on ? ' on' : ''}`} aria-pressed={on} onClick={() => set({ repo: on ? '' : r.url })}>
                  <span className="wz-row-mark" style={{ background: owner === mine ? '#14142B' : '#2F6FD0' }}>{owner[0].toUpperCase()}</span>
                  <span className="wz-row-text"><b>{r.fullName}</b><span>{r.private ? 'Privé' : 'Public'} · {ago(r.pushedAt)}</span></span>
                  {on && <Icon name="check" size={20} />}
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <button type="button" className="wz-row" onClick={onConnect}>
            <span className="wz-row-mark" style={{ background: '#14142B' }}><Icon name="branch" size={18} /></span>
            <span className="wz-row-text"><b>Connecter GitHub</b><span>Pour choisir parmi tes dépôts</span></span>
            <span className="wz-go" aria-hidden="true"><Icon name="chevron" size={16} /></span>
          </button>
          <label className="wz-field">
            <span>Ou écris son nom</span>
            <input className="wz-input" value={d.repo} onChange={(e) => set({ repo: e.target.value })} placeholder="compte/projet" autoComplete="off" autoCapitalize="off" />
          </label>
        </>
      )}
      <div className="wz-branches">
        <b>Noms des branches</b>
        <div>
          <code style={{ color: 'var(--accent)' }}>feature/…</code>
          <code style={{ color: '#C2413A' }}>fix/…</code>
          <code style={{ color: '#0F7A63' }}>research/…</code>
        </div>
      </div>
    </>
  )
}

function StepTeam({ d, set }: StepProps) {
  const [email, setEmail] = useState('')
  const [bad, setBad] = useState(false)
  const [roleFor, setRoleFor] = useState<string | null>(null)
  function add() {
    const e = email.trim().toLowerCase()
    if (!EMAIL.test(e)) return setBad(true)
    if (!d.invites.some((i) => i.email === e)) set({ invites: [...d.invites, { email: e, title: 'Développeur' }] })
    setEmail('')
    setBad(false)
  }
  return (
    <>
      <Title help="Ils recevront un email et une notification pour rejoindre.">Qui travaille avec toi ?</Title>
      <div className="wz-add">
        <label className={`wz-email${bad ? ' bad' : ''}`}>
          <input aria-label="Adresse email" type="email" inputMode="email" autoCapitalize="off" placeholder="prenom@email.fr" value={email} onChange={(e) => { setEmail(e.target.value); setBad(false) }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        </label>
        <button type="button" className="wz-dark" onClick={add}>Ajouter</button>
      </div>
      {d.invites.length > 0 && (
        <div className="wz-people">
          {d.invites.map((i, n) => (
            <div key={i.email} className="wz-person">
              <span className="wz-initial" style={{ background: INVITE_COLORS[n % INVITE_COLORS.length] }}>{i.email[0].toUpperCase()}</span>
              <span className="wz-row-text"><b>{i.email}</b><span>Recevra un email</span></span>
              <button type="button" className="wz-role" onClick={() => setRoleFor(i.email)}>{SHORT[i.title] ?? i.title} ▾</button>
              <button type="button" className="icon-btn" aria-label={`Retirer ${i.email}`} onClick={() => set({ invites: d.invites.filter((x) => x.email !== i.email) })}><Icon name="close" size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="wz-field">
        <b className="wz-label">Ton rôle dans ce projet</b>
        <div className="wz-chips" role="radiogroup" aria-label="Ton rôle">
          {MY_TITLES.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={d.myTitle === t} onClick={() => set({ myTitle: t })}>{t}</button>
          ))}
        </div>
      </div>
      <button type="button" className={`wz-share${d.shareLink ? ' on' : ''}`} aria-pressed={d.shareLink} onClick={() => set({ shareLink: !d.shareLink })}>
        <Icon name="link" size={20} />
        <span>{d.shareLink ? "Lien d'invitation copié à la création" : "Ou partager un lien d'invitation"}</span>
        {d.shareLink && <Icon name="check" size={18} />}
      </button>
      {roleFor && (
        <Modal title={`Rôle de ${roleFor}`} onClose={() => setRoleFor(null)}>
          <div className="wz-list">
            {TEAM_TITLES.map((t) => {
              const on = d.invites.find((i) => i.email === roleFor)?.title === t
              return (
                <button key={t} type="button" className={`wz-row slim${on ? ' on' : ''}`} onClick={() => { set({ invites: d.invites.map((i) => (i.email === roleFor ? { ...i, title: t } : i)) }); setRoleFor(null) }}>
                  <span className="wz-row-text"><b>{t}</b></span>
                  {on && <Icon name="check" size={18} />}
                </button>
              )
            })}
          </div>
        </Modal>
      )}
    </>
  )
}

function StepRhythm({ d, set }: StepProps) {
  const start = isoDay(new Date())
  return (
    <>
      <Title help={d.weeks ? `Le sprint 1 commence aujourd'hui et finit le ${dayLabel(addDays(start, d.weeks * 7 - 1))}.` : 'Pas de sprint pour l’instant : tu en créeras un quand tu veux.'}>À quel rythme ?</Title>
      <div className="wz-field">
        <b className="wz-label">Durée d'un sprint</b>
        <div className="wz-weeks" role="radiogroup" aria-label="Durée d'un sprint">
          {WEEKS.map((w) => (
            <button key={w} type="button" role="radio" aria-checked={d.weeks === w} onClick={() => set({ weeks: d.weeks === w ? null : w })}>
              <b>{w}</b><span>semaine{w > 1 ? 's' : ''}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="wz-field">
        <b className="wz-label">Point d'équipe, chaque jour</b>
        <div className="wz-chips" role="radiogroup" aria-label="Heure du point d'équipe">
          {TIMES.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={d.daily === t} onClick={() => set({ daily: t })}>{timeLabel(t)}</button>
          ))}
          <button type="button" role="radio" aria-checked={d.daily === null} onClick={() => set({ daily: null })}>Pas de point</button>
        </div>
      </div>
    </>
  )
}

function StepDiscord({ d, set, canPush }: StepProps & { canPush: boolean }) {
  return (
    <>
      <Title help="Les tâches attribuées, terminées et les PR arrivent dans ton serveur.">Discord et notifications</Title>
      <ol className="wz-howto">
        <li><b>1</b><span>Dans Discord, ouvre les paramètres du salon voulu.</span></li>
        <li><b>2</b><span>Intégrations, puis Webhooks, puis Nouveau webhook.</span></li>
        <li><b>3</b><span>Copie son URL et colle-la ici.</span></li>
      </ol>
      <label className="wz-field">
        <span>Webhook Discord</span>
        <input className="wz-input" type="url" placeholder="https://discord.com/api/webhooks/…" value={d.discord} onChange={(e) => set({ discord: e.target.value })} autoCapitalize="off" />
      </label>
      {canPush && (
        <button type="button" className={`wz-row${d.push ? ' on' : ''}`} aria-pressed={d.push} onClick={() => set({ push: !d.push })}>
          <span className="wz-row-mark" style={{ background: '#C2413A' }}><Icon name="bell" size={18} /></span>
          <span className="wz-row-text"><b>Notifications sur cet appareil</b><span>Mentions, tâches pour toi, invitations</span></span>
          <span className={`wz-switch${d.push ? ' on' : ''}`} aria-hidden="true"><i /></span>
        </button>
      )}
    </>
  )
}
