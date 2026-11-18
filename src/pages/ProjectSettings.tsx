import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { SectionsPage } from '../components/SectionsPage'
import { useToast } from '../components/Toast'
import { normalizeRepo } from '../lib/presets'
import { rememberGroup, useStore, useWorkspace } from '../lib/store'

const isRepo = (url: string) => /^https:\/\/github\.com\/[^/]+\/[^/]+/.test(url)

export function ProjectSettings() {
  const ws = useWorkspace()
  const { backend, user, reload } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const me = ws.members.find((m) => m.id === user?.id) ?? (backend.mode === 'demo' ? ws.members[0] : undefined)
  const isAdmin = me?.role === 'admin'
  const repo = ws.links.find((l) => isRepo(l.url))

  const [name, setName] = useState(ws.group.name)
  const [repoInput, setRepoInput] = useState(repo?.url.replace('https://github.com/', '') ?? '')
  const [hook, setHook] = useState('')
  const [confirm, setConfirm] = useState('')

  async function attempt(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn()
      await reload()
      toast(ok)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action impossible')
    }
  }

  const saveName = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) void attempt(() => backend.renameGroup(name), 'Nom enregistré')
  }

  const saveRepo = (e: FormEvent) => {
    e.preventDefault()
    const url = normalizeRepo(repoInput)
    if (repoInput.trim() && !url) return toast('Écris « compte/projet » ou colle l’adresse du dépôt')
    void attempt(async () => {
      if (repo) await backend.removeLink(repo.id)
      if (url) await backend.addLink('Dépôt GitHub', url)
    }, url ? 'Dépôt relié' : 'Dépôt retiré')
  }

  const saveHook = (e: FormEvent) => {
    e.preventDefault()
    void attempt(() => backend.setDiscordWebhook(hook.trim() || null), 'Discord relié').then(() => setHook(''))
  }

  async function leave(kind: 'leave' | 'delete') {
    try {
      if (kind === 'delete') await backend.deleteGroup()
      else await backend.leaveGroup()
      rememberGroup(null)
      navigate('/')
      await reload()
      toast(kind === 'delete' ? 'Projet supprimé' : 'Tu as quitté le projet')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action impossible')
    }
  }

  const admins = ws.members.filter((m) => m.role === 'admin').length
  const lastAdmin = isAdmin && admins === 1 && ws.members.length > 1
  const adminOnly = <p className="hint">Seuls les admins peuvent modifier ce réglage.</p>

  return (
    <SectionsPage
      title="Réglages du projet"
      subtitle={ws.group.name}
      sections={[
        {
          id: 'general',
          label: 'Général',
          icon: 'folder',
          render: () => (
            <>
              <form className="card" onSubmit={saveName}>
                <h2>Nom</h2>
                <div className="row-between" style={{ flexWrap: 'nowrap' }}>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} disabled={!isAdmin} aria-label="Nom du projet" />
                  {isAdmin && <button className="btn" disabled={!name.trim() || name.trim() === ws.group.name}>Enregistrer</button>}
                </div>
                {!isAdmin && adminOnly}
              </form>
              <form className="card" onSubmit={saveRepo}>
                <h2>Dépôt GitHub</h2>
                <p className="hint">Affiché dans les liens du projet.</p>
                <div className="row-between" style={{ flexWrap: 'nowrap' }}>
                  <input className="input" value={repoInput} onChange={(e) => setRepoInput(e.target.value)} placeholder="compte/projet" disabled={!isAdmin} aria-label="Dépôt GitHub" />
                  {isAdmin && <button className="btn">Enregistrer</button>}
                </div>
                {repo && <a href={repo.url} target="_blank" rel="noreferrer" className="hint">{repo.url}</a>}
              </form>
            </>
          ),
        },
        {
          id: 'equipe',
          label: 'Membres',
          icon: 'group',
          render: () => (
            <div className="card">
              <div className="row-between">
                <div>
                  <h2>{ws.members.length} membre{ws.members.length > 1 ? 's' : ''}</h2>
                  <p className="hint">{admins} admin{admins > 1 ? 's' : ''}</p>
                </div>
                <button className="btn soft" onClick={() => navigate('/equipe')}>Droits et invitations</button>
              </div>
            </div>
          ),
        },
        {
          id: 'integrations',
          label: 'Intégrations',
          icon: 'link',
          render: () => (
            <form className="card" onSubmit={saveHook}>
              <div className="row-between">
                <h2>Discord</h2>
                <span className="tag" style={{ background: ws.group.discordWebhookSet ? 'color-mix(in srgb, var(--ok) 15%, transparent)' : 'var(--subtle)', color: ws.group.discordWebhookSet ? 'var(--ok)' : 'var(--muted)' }}>
                  {ws.group.discordWebhookSet ? 'Relié' : 'Non relié'}
                </span>
              </div>
              <p className="hint">Tâches attribuées, terminées et PR liées, postées dans un salon. Webhook : Paramètres du salon › Intégrations.</p>
              {isAdmin ? (
                <>
                  <input className="input" type="url" placeholder="https://discord.com/api/webhooks/…" value={hook} onChange={(e) => setHook(e.target.value)} aria-label="URL du webhook Discord" />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" disabled={!hook.trim()}>Relier</button>
                    {ws.group.discordWebhookSet && (
                      <button type="button" className="btn soft" onClick={() => void attempt(() => backend.setDiscordWebhook(null), 'Discord délié')}>Délier</button>
                    )}
                  </div>
                </>
              ) : adminOnly}
            </form>
          ),
        },
        {
          id: 'sensible',
          label: 'Zone sensible',
          icon: 'shield',
          render: () => (
            <>
              <div className="card">
                <h2>Quitter le projet</h2>
                {lastAdmin ? (
                  <p className="hint">Tu es le seul admin : nomme un autre admin avant de partir.</p>
                ) : (
                  <p className="hint">Tu n'y auras plus accès, sauf nouvelle invitation.</p>
                )}
                <button className="btn soft" style={{ alignSelf: 'flex-start' }} disabled={lastAdmin} onClick={() => void leave('leave')}>Quitter</button>
              </div>
              {isAdmin && (
                <div className="card">
                  <h2>Supprimer le projet</h2>
                  <p className="hint">Tâches, salons et messages sont effacés pour tout le monde. Tape <b>{ws.group.name}</b> pour confirmer.</p>
                  <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Nom du projet pour confirmer" />
                  <button className="btn danger" style={{ alignSelf: 'flex-start' }} disabled={confirm.trim() !== ws.group.name} onClick={() => void leave('delete')}>Supprimer</button>
                </div>
              )}
            </>
          ),
        },
      ]}
    />
  )
}
