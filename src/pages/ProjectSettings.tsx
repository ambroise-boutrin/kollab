import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AvatarGroup } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { PromptDialog } from '../components/PromptDialog'
import { ProjectMark } from '../components/ProjectMark'
import { shrinkSquare } from '../lib/image'
import { SectionsPage } from '../components/SectionsPage'
import { useToast } from '../components/Toast'
import type { TrashItem } from '../lib/backend'
import { branchName, getRepo, ghToken, myRepos, parseRepo, projectRepoLink, type RepoInfo } from '../lib/github'
import { normalizeRepo } from '../lib/presets'
import { autoPrEnabled, rememberGroup, setAutoPr, useStore, useWorkspace } from '../lib/store'
import { ROLES } from '../lib/types'
import { useAsync } from '../lib/useAsync'
import { openInvite } from './Group'


function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 60) return `il y a ${Math.max(1, min)} min`
  const h = Math.round(min / 60)
  if (h < 48) return `il y a ${h} h`
  return `il y a ${Math.round(h / 24)} j`
}

/** Interrupteur on/off. */
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}

/** Choisir un dépôt : ceux de la connexion GitHub, ou une adresse collée. */
function RepoPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const { backend } = useStore()
  const toast = useToast()
  const [q, setQ] = useState('')
  const repos = useAsync(ghToken() ? myRepos : null, [])
  const typed = normalizeRepo(q)
  const shown = useMemo(() => (repos.data ?? []).filter((r) => !q || r.fullName.toLowerCase().includes(q.toLowerCase())).slice(0, 40), [repos.data, q])
  return (
    <Modal title="Choisir le dépôt GitHub" onClose={onClose}>
      <label className="branch-search big">
        <Icon name="search" size={18} />
        <input autoFocus placeholder="Chercher, ou coller compte/projet" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Dépôt" />
      </label>
      {typed && !shown.some((r) => `https://github.com/${r.fullName}` === typed) && (
        <button className="repo-row typed" onClick={() => onPick(typed)}>
          <span className="repo-ico"><Icon name="plus" size={16} /></span>
          <span className="pop-grow"><strong>{typed.replace('https://github.com/', '')}</strong><span className="muted">Relier ce dépôt</span></span>
        </button>
      )}
      {!ghToken() ? (
        <div className="cta-card">
          <strong>Voir tes dépôts</strong>
          <span>Connecte GitHub pour choisir dans ta liste, y compris les dépôts privés.</span>
          <button className="btn" onClick={() => void backend.connectGitHub().catch((e: Error) => toast(e.message))}>Connecter GitHub</button>
        </div>
      ) : (
        <div className="repo-list">
          {repos.loading && <p className="hint">Chargement…</p>}
          {repos.error && <p className="hint">{repos.error}</p>}
          {shown.map((r) => (
            <button key={r.fullName} className="repo-row" onClick={() => onPick(r.url)}>
              <img src={r.ownerAvatar} alt="" width={32} height={32} />
              <span className="pop-grow">
                <strong>{r.fullName}</strong>
                <span className="muted">{r.description || (r.private ? 'Privé' : 'Public')} · {ago(r.pushedAt)}</span>
              </span>
              {r.private && <span className="mini-tag">Privé</span>}
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

export function ProjectSettings() {
  const ws = useWorkspace()
  const { backend, user, reload, online } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const me = ws.members.find((m) => m.id === user?.id) ?? (backend.mode === 'demo' ? ws.members[0] : undefined)
  const isAdmin = me?.role === 'admin'
  const canWrite = me?.role !== 'guest'
  const repoLink = projectRepoLink(ws.links)
  const repoRef = repoLink ? parseRepo(repoLink.url) : null

  const [editingName, setEditingName] = useState(false)
  const logoInput = useRef<HTMLInputElement>(null)
  const [newChannel, setNewChannel] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [discord, setDiscord] = useState(false)
  const [hook, setHook] = useState('')
  const [danger, setDanger] = useState<'leave' | 'delete' | null>(null)
  const [confirm, setConfirm] = useState('')
  const [autoPr, setAutoPrState] = useState(() => autoPrEnabled(ws.group.id))
  const [trash, setTrash] = useState<TrashItem[] | null>(null)
  const repo = useAsync<RepoInfo>(repoRef ? () => getRepo(repoRef) : null, [repoLink?.url])

  const loadTrash = () => void backend.listTrash().then(setTrash).catch(() => setTrash(null))
  useEffect(loadTrash, [backend, ws.tasks.length, ws.links.length]) // eslint-disable-line react-hooks/exhaustive-deps

  async function attempt(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn()
      await reload()
      toast(ok)
      return true
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action impossible')
      return false
    }
  }

  const pickRepo = (url: string) => {
    setPicking(false)
    void attempt(async () => {
      if (repoLink) await backend.removeLink(repoLink.id)
      await backend.addLink('Dépôt GitHub', url)
    }, 'Dépôt relié')
  }

  async function leave(kind: 'leave' | 'delete') {
    try {
      if (kind === 'delete') await backend.deleteGroup()
      else await backend.leaveGroup()
      rememberGroup(null)
      navigate('/')
      await reload()
      toast(kind === 'delete' ? 'Projet supprimé, récupérable 30 jours' : 'Tu as quitté le projet')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action impossible')
    }
  }

  async function exportProject() {
    const messages = await Promise.all(ws.channels.map(async (c) => ({ salon: c.name, messages: await backend.listMessages(c.id) })))
    const data = { exporte_le: new Date().toISOString(), projet: ws.group.name, membres: ws.members.map(({ id, name: n, role }) => ({ id, nom: n, role })), taches: ws.tasks, liens: ws.links, salons: messages }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `${ws.group.name.replace(/[^\p{L}\d-]+/gu, '-')}-${new Date().toISOString().slice(0, 10)}.json` })
    a.click()
    URL.revokeObjectURL(url)
    toast('Export téléchargé')
  }

  const open = ws.tasks.filter((t) => t.status !== 'done')
  const done = ws.tasks.length - open.length
  const totalPts = ws.tasks.reduce((n, t) => n + (t.points ?? 0), 0)
  const donePts = ws.tasks.filter((t) => t.status === 'done').reduce((n, t) => n + (t.points ?? 0), 0)
  const pct = totalPts ? Math.round((donePts / totalPts) * 100) : 0
  const admins = ws.members.filter((m) => m.role === 'admin').length
  const lastAdmin = isAdmin && admins === 1 && ws.members.length > 1

  return (
    <>
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
                <section className="card project-hero">
                  <button className="project-logo-btn" disabled={!isAdmin} onClick={() => logoInput.current?.click()} aria-label="Changer le logo du projet" title={isAdmin ? 'Changer le logo' : undefined}>
                    <ProjectMark id={ws.group.id} logoUrl={ws.group.logoUrl} color={ws.group.color} size={72} />
                    {isAdmin && <span className="profile-photo-edit" aria-hidden="true"><Icon name="photo" size={15} /></span>}
                  </button>
                  <input ref={logoInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void attempt(async () => backend.setGroupLogo(await shrinkSquare(f, 320)), 'Logo mis à jour') }} />
                  <div className="project-hero-text">
                    <button className="hero-name" disabled={!isAdmin} onClick={() => setEditingName(true)} title={isAdmin ? 'Renommer' : undefined}>
                      {ws.group.name}
                      {isAdmin && <Icon name="edit" size={16} />}
                    </button>
                    {isAdmin && ws.group.logoUrl && <button className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 13 }} onClick={() => void attempt(() => backend.setGroupLogo(null), 'Logo retiré')}>Retirer le logo</button>}
                    <span className="muted">{ws.members.length} membre{ws.members.length > 1 ? 's' : ''} · ton rôle : {me ? ROLES[me.role].label.toLowerCase() : '—'}</span>
                  </div>
                  <AvatarGroup members={ws.members} size={34} max={5} online={online} />
                </section>

                <div className="stat-tiles">
                  <div className="stat-tile" style={{ ['--tile' as string]: 'var(--accent)' }}><b>{open.length}</b><span>tâches ouvertes</span></div>
                  <div className="stat-tile" style={{ ['--tile' as string]: 'var(--ok)' }}><b>{done}</b><span>terminées</span></div>
                  <div className="stat-tile" style={{ ['--tile' as string]: '#D98A1C' }}>
                    <b>{pct} %</b><span>des points du projet, tous sprints</span>
                    <i className="stat-bar"><i style={{ width: `${pct}%` }} /></i>
                  </div>
                  <div className="stat-tile" style={{ ['--tile' as string]: '#2F6FD0' }}><b>{ws.channels.length}</b><span>salons</span></div>
                </div>

                <section className="card">
                  <div className="row-between"><h2>Salons</h2><button className="link-plain" onClick={() => navigate('/chat')}>Ouvrir le chat</button></div>
                  <div className="chan-chips">
                    {ws.channels.map((c) => (
                      <button key={c.id} className="chan-chip" onClick={() => navigate(`/chat?salon=${c.id}`)}># {c.name}</button>
                    ))}
                    {canWrite && <button className="chan-chip add" onClick={() => setNewChannel('')}><Icon name="plus" size={14} /> Salon</button>}
                  </div>
                </section>
              </>
            ),
          },
          {
            id: 'github',
            label: 'GitHub',
            icon: 'pr',
            render: () => (
              <>
                {repoLink ? (
                  <section className="card repo-card">
                    <div className="repo-card-head">
                      {repo.data ? <img src={repo.data.ownerAvatar} alt="" width={44} height={44} /> : <span className="repo-ico big"><Icon name="pr" size={20} /></span>}
                      <div className="pop-grow">
                        <a href={repoLink.url} target="_blank" rel="noreferrer" className="repo-name">{repoRef ? `${repoRef.owner}/${repoRef.repo}` : repoLink.url}</a>
                        <span className="muted">{repo.data?.description || repo.error || 'Dépôt relié au projet'}</span>
                      </div>
                      {isAdmin && <button className="btn soft small" onClick={() => setPicking(true)}>Changer</button>}
                    </div>
                    {repo.data && (
                      <div className="repo-facts">
                        <span><Icon name="branch" size={14} /> {repo.data.defaultBranch}</span>
                        {repo.data.language && <span>{repo.data.language}</span>}
                        <span>★ {repo.data.stars}</span>
                        <span>Dernier push {ago(repo.data.pushedAt)}</span>
                        <span>{repo.data.private ? 'Privé' : 'Public'}</span>
                      </div>
                    )}
                    <div className="repo-actions">
                      <button className="btn small" onClick={() => navigate('/revues')}>Voir les PR</button>
                      {!ghToken() && <button className="btn soft small" onClick={() => void backend.connectGitHub().catch((e: Error) => toast(e.message))}>Connecter GitHub</button>}
                    </div>
                  </section>
                ) : (
                  <button className="cta-card big" onClick={() => isAdmin && setPicking(true)} disabled={!isAdmin}>
                    <span className="cta-ico"><Icon name="pr" size={24} /></span>
                    <strong>Relier un dépôt GitHub</strong>
                    <span>PR, revues, tests et branches des tâches, directement dans Kollab.</span>
                  </button>
                )}

                <section className="card">
                  <div className="setting-row">
                    <div className="pop-grow">
                      <strong>Branche et PR automatiques</strong>
                      <span className="muted">Quand une tâche passe « En cours », Kollab crée sa branche et sa PR.</span>
                    </div>
                    <Switch label="Branche et PR automatiques" on={autoPr} onChange={(v) => { setAutoPr(ws.group.id, v); setAutoPrState(v) }} />
                  </div>
                  <div className="branch-examples">
                    {(['feature', 'bug', 'research'] as const).map((k) => (
                      <code key={k} className={`kind-${k}`}>{branchName(k, k === 'feature' ? 'Écran de connexion' : k === 'bug' ? 'Menu iPhone' : 'Choix du stack')}</code>
                    ))}
                  </div>
                </section>
              </>
            ),
          },
          {
            id: 'equipe',
            label: 'Membres',
            icon: 'group',
            render: () => (
              <section className="card team-summary">
                <AvatarGroup members={ws.members} size={44} max={6} online={online} />
                <div className="role-counts">
                  {(['admin', 'member', 'guest'] as const).map((r) => (
                    <span key={r}><b>{ws.members.filter((m) => m.role === r).length}</b> {ROLES[r].label.toLowerCase()}{ws.members.filter((m) => m.role === r).length > 1 ? 's' : ''}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {isAdmin && <button className="btn" onClick={openInvite}><Icon name="plus" size={16} /> Inviter</button>}
                  <button className="btn soft" onClick={() => navigate('/equipe')}>Gérer l'équipe</button>
                </div>
              </section>
            ),
          },
          {
            id: 'integrations',
            label: 'Intégrations',
            icon: 'link',
            render: () => (
              <div className="integration-grid">
                <button className="integration" style={{ ['--brand' as string]: '#5865F2' }} onClick={() => isAdmin && setDiscord(true)} disabled={!isAdmin}>
                  <span className="integration-logo">D</span>
                  <strong>Discord</strong>
                  <span>Tâches attribuées, terminées et PR liées, postées dans un salon.</span>
                  <span className={`state-pill${ws.group.discordWebhookSet ? ' on' : ''}`}>{ws.group.discordWebhookSet ? 'Relié' : 'Relier'}</span>
                </button>
                <button className="integration" style={{ ['--brand' as string]: '#14142B' }} onClick={() => navigate('/projet#github')}>
                  <span className="integration-logo"><Icon name="pr" size={20} /></span>
                  <strong>GitHub</strong>
                  <span>PR, revues de code, tests et branches automatiques.</span>
                  <span className={`state-pill${repoLink ? ' on' : ''}`}>{repoLink ? 'Relié' : 'Relier'}</span>
                </button>
              </div>
            ),
          },
          {
            id: 'donnees',
            label: 'Données',
            icon: 'download',
            render: () => (
              <>
                <section className="card">
                  <div className="setting-row">
                    <div className="pop-grow">
                      <strong>Exporter le projet</strong>
                      <span className="muted">Tâches, liens, membres et messages dans un fichier, à garder où tu veux.</span>
                    </div>
                    <button className="btn soft" onClick={() => void exportProject()}><Icon name="download" size={16} /> Exporter</button>
                  </div>
                </section>
                <section className="card">
                  <h2>Corbeille</h2>
                  <p className="hint">Ce qui est supprimé reste ici 30 jours.</p>
                  {trash === null && <p className="hint">Bientôt disponible.</p>}
                  {trash?.length === 0 && <p className="hint">Vide.</p>}
                  <div className="trash-list">
                    {trash?.map((t) => (
                      <div key={t.id} className="trash-row">
                        <span className="repo-ico"><Icon name={t.kind === 'task' ? 'board' : t.kind === 'document' || t.kind === 'note' ? 'doc' : 'link'} size={16} /></span>
                        <span className="pop-grow"><strong>{t.title}</strong><span className="muted">{t.kind === 'task' ? 'Tâche' : t.kind === 'document' ? 'Fichier' : t.kind === 'note' ? 'Document' : 'Lien'} · supprimé {ago(t.deletedAt)}</span></span>
                        {canWrite && <button className="btn soft small" onClick={() => void attempt(() => backend.restoreItem(t.kind, t.id), 'Restauré').then(loadTrash)}>Restaurer</button>}
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ),
          },
          {
            id: 'sensible',
            label: 'Zone sensible',
            icon: 'shield',
            render: () => (
              <section className="card danger-zone">
                <div className="setting-row">
                  <div className="pop-grow">
                    <strong>Quitter le projet</strong>
                    <span className="muted">{lastAdmin ? 'Tu es le seul admin : nomme un autre admin avant de partir.' : "Tu n'y auras plus accès, sauf nouvelle invitation."}</span>
                  </div>
                  <button className="btn soft" disabled={lastAdmin} onClick={() => setDanger('leave')}>Quitter</button>
                </div>
                {isAdmin && (
                  <div className="setting-row">
                    <div className="pop-grow">
                      <strong>Supprimer le projet</strong>
                      <span className="muted">Pour tout le monde. Récupérable 30 jours.</span>
                    </div>
                    <button className="btn danger" onClick={() => setDanger('delete')}>Supprimer</button>
                  </div>
                )}
              </section>
            ),
          },
        ]}
      />

      {picking && <RepoPicker onPick={pickRepo} onClose={() => setPicking(false)} />}

      {editingName && (
        <PromptDialog title="Renommer le projet" confirm="Enregistrer" onClose={() => setEditingName(false)}
          fields={[{ name: 'name', label: 'Nom du projet', initial: ws.group.name, maxLength: 80, required: true }]}
          onSubmit={async (v) => { const n = v.name.trim(); if (!n) return 'Donne un nom au projet'; if (n !== ws.group.name) await attempt(() => backend.renameGroup(n), 'Nom enregistré') }} />
      )}
      {newChannel !== null && (
        <PromptDialog title="Nouveau salon" confirm="Créer" onClose={() => setNewChannel(null)}
          fields={[{ name: 'name', label: 'Nom du salon', prefix: '#', placeholder: 'design', maxLength: 40, required: true }]}
          onSubmit={async (v) => { const n = v.name.trim().replace(/^#/, ''); if (!n) return 'Donne un nom au salon'; await attempt(() => backend.createChannel(n), `#${n} créé`) }} />
      )}
      {discord && (
        <Modal title="Relier Discord" onClose={() => setDiscord(false)} footer={
          <>
            {ws.group.discordWebhookSet && <button className="btn soft" onClick={() => void attempt(() => backend.setDiscordWebhook(null), 'Discord délié').then(() => setDiscord(false))}>Délier</button>}
            <button className="btn" disabled={!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(hook.trim())} onClick={() => void attempt(() => backend.setDiscordWebhook(hook.trim()), 'Discord relié').then((ok) => ok && (setHook(''), setDiscord(false)))}>Relier</button>
          </>
        }>
          <ol className="steps">
            <li><b>1</b><span>Dans Discord, ouvre les paramètres du salon voulu.</span></li>
            <li><b>2</b><span>Intégrations › Webhooks › Nouveau webhook.</span></li>
            <li><b>3</b><span>Copie l'URL du webhook et colle-la ici.</span></li>
          </ol>
          <input className="input" type="url" autoFocus placeholder="https://discord.com/api/webhooks/…" value={hook} onChange={(e) => setHook(e.target.value)} aria-label="URL du webhook Discord" />
        </Modal>
      )}

      {danger && (
        <Modal title={danger === 'delete' ? 'Supprimer le projet ?' : 'Quitter le projet ?'} onClose={() => { setDanger(null); setConfirm('') }} footer={
          <>
            <button className="btn soft" onClick={() => { setDanger(null); setConfirm('') }}>Annuler</button>
            <button className="btn danger" disabled={danger === 'delete' && confirm.trim() !== ws.group.name} onClick={() => { const k = danger; setDanger(null); void leave(k) }}>
              {danger === 'delete' ? 'Supprimer' : 'Quitter'}
            </button>
          </>
        }>
          {danger === 'delete' ? (
            <>
              <p className="muted" style={{ margin: 0 }}>Le projet disparaît pour tout le monde. Un admin peut le restaurer pendant 30 jours. Tape <b>{ws.group.name}</b> pour confirmer.</p>
              <input className="input" autoFocus value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Nom du projet pour confirmer" />
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Tu n'auras plus accès à {ws.group.name}, sauf nouvelle invitation.</p>
          )}
        </Modal>
      )}
    </>
  )
}
