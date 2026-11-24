import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { useStore } from '../lib/store'
import type { Channel, DiscordAccount, DiscordChannel, DiscordGuild, DiscordLink } from '../lib/types'

/** Couleurs des cartes de salons Discord, à tour de rôle. */
const TINTS = ['indigo', 'green', 'orange', 'pink', 'blue', 'teal']

/** Bulle Discord (marque simple, sans logo). */
export function DiscordMark({ size = 20 }: { size?: number }) {
  return (
    <span className="discord-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /></svg>
    </span>
  )
}

/**
 * Relier un salon du chat à un salon Discord (piste A). Si le projet n'a pas encore de serveur Discord,
 * on le relie d'abord, une seule fois, dans une petite fenêtre Discord.
 */
export function DiscordLinkDialog({ channel, guild, links, account, isAdmin = true, onClose, onChange }: {
  channel: Channel
  guild: DiscordGuild | null
  links: DiscordLink[]
  /** Compte Discord de la personne connectée. */
  account?: DiscordAccount | null
  isAdmin?: boolean
  onClose: () => void
  /** État Discord à relire (serveur ou salons changés). */
  onChange: () => Promise<void>
}) {
  const { backend, reload } = useStore()
  const toast = useToast()
  const current = links.find((l) => l.channelId === channel.id) ?? null
  const [list, setList] = useState<DiscordChannel[] | null>(null)
  const [pick, setPick] = useState<string | null>(current?.discordChannelId ?? null)
  const [busy, setBusy] = useState<'connect' | 'link' | 'unlink' | 'import' | 'me' | null>(null)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!guild) return
    let alive = true
    backend.listDiscordChannels().then((c) => alive && setList(c), (e: Error) => { toast(e.message); setList([]) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, guild])

  // Sans salon choisi, on propose celui qui porte le même nom.
  useEffect(() => {
    if (pick || !list) return
    const same = list.find((c) => c.name.toLowerCase() === channel.name.toLowerCase() && !links.some((l) => l.discordChannelId === c.id))
    if (same) setPick(same.id)
  }, [list, pick, channel.name, links])

  async function connect() {
    setBusy('connect')
    setStep(1)
    try {
      await backend.connectDiscord()
      setStep(3)
      await importAll()
      onClose()
    } catch (e) {
      setStep(0)
      toast(e instanceof Error ? e.message : 'Connexion Discord impossible')
    } finally {
      setBusy(null)
    }
  }

  /** Tous les salons Discord arrivent dans Kollab ; même nom = même salon. */
  async function importAll() {
    const r = await backend.importDiscordChannels()
    await Promise.all([reload(), onChange()])
    const parts = [r.created && `${r.created} salon${r.created > 1 ? 's' : ''} importé${r.created > 1 ? 's' : ''}`, r.merged && `${r.merged} fusionné${r.merged > 1 ? 's' : ''}`].filter(Boolean)
    toast(parts.length ? `Discord relié : ${parts.join(', ')}` : 'Discord relié, tous les salons le sont déjà')
    if (r.failed) toast(`${r.failed} salon${r.failed > 1 ? 's' : ''} n’ont pas pu être reliés`)
  }

  async function importNow() {
    setBusy('import')
    try {
      await importAll()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import impossible')
    } finally {
      setBusy(null)
    }
  }

  async function link() {
    if (!pick) return
    setBusy('link')
    try {
      const l = await backend.linkDiscordChannel(channel.id, pick === 'new' ? null : pick)
      await onChange()
      toast(`# ${channel.name} est relié à # ${l.discordChannelName}`)
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Liaison impossible')
    } finally {
      setBusy(null)
    }
  }

  async function unlink() {
    setBusy('unlink')
    try {
      await backend.unlinkDiscordChannel(channel.id)
      await onChange()
      toast('Salon délié de Discord')
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Impossible de délier')
    } finally {
      setBusy(null)
    }
  }

  async function linkMe() {
    setBusy('me')
    try {
      await backend.connectDiscordAccount()
      await onChange()
      toast('Compte Discord relié : tes messages Discord sont à ton nom')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Connexion Discord impossible')
    } finally {
      setBusy(null)
    }
  }

  async function unlinkMe() {
    setBusy('me')
    try {
      await backend.unlinkDiscordAccount()
      await onChange()
      toast('Compte Discord délié')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Impossible de délier')
    } finally {
      setBusy(null)
    }
  }

  /** Mon compte Discord : relié une fois, il range mes messages Discord de mon côté. */
  const me = (
    <div className={`discord-me${account ? ' on' : ''}`}>
      {account?.avatar ? <img src={account.avatar} alt="" width={40} height={40} /> : <DiscordMark size={40} />}
      <span className="discord-me-text">
        <strong>{account ? account.name : 'Ton compte Discord'}</strong>
        <span className="muted">{account ? 'Tes messages Discord s’affichent de ton côté, sous ton nom.' : 'Relie-le : tes messages Discord passeront de ton côté.'}</span>
      </span>
      {account
        ? <button className="btn soft small" onClick={() => void unlinkMe()} disabled={!!busy}>Délier</button>
        : <button className="btn discord small" onClick={() => void linkMe()} disabled={!!busy}>{busy === 'me' ? 'En attente…' : 'Relier mon compte'}</button>}
    </div>
  )

  if (guild && !isAdmin) {
    const link = links.find((l) => l.channelId === channel.id)
    return (
      <Modal title="Discord" onClose={onClose} footer={<button className="btn soft" onClick={onClose}>Fermer</button>}>
        <p className="muted" style={{ marginTop: 0 }}>{link ? `# ${channel.name} est relié à # ${link.discordChannelName} sur ${guild.name}.` : `Serveur : ${guild.name}.`}</p>
        {me}
      </Modal>
    )
  }

  if (!guild) {
    const steps = ['Choisis ton serveur dans la petite fenêtre', 'Clique sur Autoriser', 'C’est fini : la fenêtre se ferme toute seule']
    return (
      <Modal title="Relier Discord" onClose={onClose} wide footer={
        <>
          <button className="btn soft" onClick={onClose}>Plus tard</button>
          <button className="btn discord" onClick={() => void connect()} disabled={!!busy}>{busy ? 'En attente de Discord…' : 'Ouvrir Discord'}</button>
        </>
      }>
        <div className="discord-connect">
          <div className="discord-steps">
            <p className="muted">Une seule fois pour tout le projet. Tous les salons Discord arrivent dans le chat, ceux du même nom sont fusionnés.</p>
            {steps.map((s, i) => (
              <div key={s} className={`discord-step${step > i ? ' done' : step === i + 1 || (i === 0 && step === 0) ? ' on' : ''}`}>
                <b>{step > i + 1 ? '✓' : i + 1}</b><span>{s}</span>
              </div>
            ))}
            <p className="muted small">Kollab reste ouvert derrière. Personne d’autre n’aura à le refaire.</p>
          </div>
          <div className="discord-preview" aria-hidden="true">
            <div className="discord-preview-dots"><i /><i /><i /></div>
            <div className="discord-preview-app"><span className="discord-preview-logo" /><strong>Kollab veut rejoindre un serveur</strong></div>
            <span className="discord-preview-label">SERVEUR</span>
            <span className="discord-preview-select">Ton serveur <span>▾</span></span>
            <span className="discord-preview-label">Lire et écrire dans les salons</span>
            <span className="discord-preview-btn">Autoriser</span>
          </div>
        </div>
      </Modal>
    )
  }

  const taken = (id: string) => links.find((l) => l.discordChannelId === id && l.channelId !== channel.id)
  const exists = list?.some((c) => c.name.toLowerCase() === channel.name.toLowerCase().replace(/\s+/g, '-'))

  return (
    <Modal title={`Relier # ${channel.name}`} onClose={onClose} wide footer={
      <>
        <span className="discord-guild muted">Serveur : <strong>{guild.name}</strong> · <button className="link-btn" onClick={() => void connect()} disabled={!!busy}>changer</button></span>
        <button className="btn soft" onClick={() => void importNow()} disabled={!!busy}>{busy === 'import' ? 'Import…' : 'Tout importer'}</button>
        {current && <button className="btn soft" onClick={() => void unlink()} disabled={!!busy}>Délier</button>}
        <button className="btn discord" onClick={() => void link()} disabled={!pick || !!busy || pick === current?.discordChannelId}>{busy === 'link' ? 'Liaison…' : 'Relier'}</button>
      </>
    }>
      {me}
      <p className="muted">Choisis le salon Discord. Les messages passeront dans les deux sens.</p>
      {list === null ? (
        <div className="discord-grid">{[0, 1, 2].map((i) => <span key={i} className="discord-card skeleton" />)}</div>
      ) : (
        <div className="discord-grid" role="radiogroup" aria-label="Salons Discord">
          {list.map((c, i) => {
            const other = taken(c.id)
            const on = pick === c.id
            return (
              <button key={c.id} role="radio" aria-checked={on} className={`discord-card tint-${TINTS[i % TINTS.length]}${on ? ' on' : ''}`} onClick={() => setPick(c.id)} disabled={!!other}>
                <span className="discord-card-hash">#</span>
                <strong>{c.name}</strong>
                <span className="discord-card-sub">{on ? 'Choisi' : other ? 'Déjà relié ailleurs' : c.category ?? 'Salon texte'}</span>
              </button>
            )
          })}
          {!exists && (
            <button role="radio" aria-checked={pick === 'new'} className={`discord-card new${pick === 'new' ? ' on' : ''}`} onClick={() => setPick('new')}>
              <span className="discord-card-hash">+</span>
              <strong>Créer « {channel.name} »</strong>
              <span className="discord-card-sub">sur Discord</span>
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}
