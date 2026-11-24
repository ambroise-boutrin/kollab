import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar, AvatarGroup } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { VoiceJoin } from '../components/VoiceBar'
import { DiscordLinkDialog, DiscordMark } from '../components/DiscordLinkDialog'
import { initials } from '../components/Avatar'
import { Popover } from '../components/Popover'
import { PromptDialog } from '../components/PromptDialog'
import { Modal } from '../components/Modal'
import { PrStatus } from '../components/PrLink'
import { useToast } from '../components/Toast'
import { ghToken, listPulls, projectRepo } from '../lib/github'
import { useStore, useWorkspace } from '../lib/store'
import { STATUSES, type Attachment, type Channel, type DiscordAccount, type DiscordGuild, type DiscordLink, type Member, type Message, type Task } from '../lib/types'
import { useAsync } from '../lib/useAsync'

const QUICK = ['👍', '❤️', '😂', '🎉', '👀', '✅']
const PR_RE = /https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/g
/** Référence à une tâche dans un message : [#Titre](tache:id). */
const TASK_RE = /\[#([^\]]{1,200})\]\(tache:([\w-]+)\)/g
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Liens, tâches et @mentions. Les noms complets (« @Léa Martin ») passent avant les prénoms seuls. */
function tokenRe(members: Member[]) {
  const names = members.map((m) => m.name.trim()).filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRe)
  const mention = names.length ? `@(?:${names.join('|')})(?![\\p{L}\\d])|` : ''
  return new RegExp(`(\\[#[^\\]]{1,200}\\]\\(tache:[\\w-]+\\)|https?:\\/\\/\\S+|${mention}@[\\p{L}\\d_-]+)`, 'giu')
}

function renderBody(body: string, members: Member[], tasks: Task[], open: (id: string) => void): ReactNode[] {
  return body.split(tokenRe(members)).map((part, i) => {
    const t = /^\[#([^\]]+)\]\(tache:([\w-]+)\)$/.exec(part)
    if (t) {
      const task = tasks.find((x) => x.id === t[2])
      return (
        <button key={i} type="button" className={`task-ref status-${task?.status ?? 'gone'}`} onClick={() => task && open(task.id)} disabled={!task}>
          #{task?.title ?? t[1]}
        </button>
      )
    }
    if (part.startsWith('@') && members.some((m) => m.name.toLowerCase() === part.slice(1).toLowerCase())) {
      return <span key={i} className="mention">{part}</span>
    }
    if (/^https?:\/\//.test(part)) {
      const pr = /\/pull\/(\d+)$/.exec(part)
      return <a key={i} href={part} target="_blank" rel="noreferrer">{pr ? `PR #${pr[1]}` : part}</a>
    }
    return part
  })
}

/** Cartes sous le message : tâches et PR citées. */
function Refs({ body, tasks, members, open }: { body: string; tasks: Task[]; members: Member[]; open: (id: string) => void }) {
  const taskIds = [...new Set([...body.matchAll(TASK_RE)].map((m) => m[2]))]
  const prs = [...new Set([...body.matchAll(PR_RE)].map((m) => m[0]))]
  if (!taskIds.length && !prs.length) return null
  return (
    <div className="refs">
      {taskIds.map((id) => {
        const t = tasks.find((x) => x.id === id)
        if (!t) return null
        const st = STATUSES.find((s) => s.id === t.status)
        return (
          <button key={id} type="button" className="ref-card" onClick={() => open(id)}>
            <span className={`ref-icon status-${t.status}`}><Icon name="board" size={16} /></span>
            <span className="ref-text">
              <strong>{t.title}</strong>
              <span className="muted">{st?.label}{t.points != null ? ` · ${t.points} pts` : ''}</span>
            </span>
            <AvatarGroup members={members.filter((m) => t.assigneeIds.includes(m.id))} size={22} />
          </button>
        )
      })}
      {prs.map((url) =>
        ghToken() ? (
          <div key={url} className="ref-card pr"><PrStatus url={url} /></div>
        ) : (
          <a key={url} className="ref-card" href={url} target="_blank" rel="noreferrer">
            <span className="ref-icon pr"><Icon name="pr" size={16} /></span>
            <span className="ref-text"><strong>Pull request #{url.split('/').pop()}</strong><span className="muted">{url.split('/').slice(3, 5).join('/')}</span></span>
          </a>
        ),
      )}
    </div>
  )
}

const sizeLabel = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`)
const extOf = (name: string) => (/\.(\w{1,5})$/.exec(name)?.[1] ?? 'fichier').toUpperCase()

/** Pièces jointes d'un message : images en vignettes, autres fichiers en cartes. */
function Attachments({ files, urls }: { files: Attachment[]; urls: Record<string, string> }) {
  const images = files.filter((f) => f.mime.startsWith('image/'))
  const others = files.filter((f) => !f.mime.startsWith('image/'))
  return (
    <div className="attachments">
      {images.length > 0 && (
        <div className={`attach-images n${Math.min(images.length, 3)}`}>
          {images.map((f) => (
            <a key={f.path} className="attach-image" href={urls[f.path]} target="_blank" rel="noreferrer" title={f.name}>
              {urls[f.path] ? <img src={urls[f.path]} alt={f.name} loading="lazy" onLoad={(e) => {
                // Image chargée en bas du fil : on garde le bas visible.
                const list = e.currentTarget.closest('.messages')
                if (list && list.scrollHeight - list.scrollTop - list.clientHeight < e.currentTarget.clientHeight + 120) list.scrollTop = list.scrollHeight
              }} /> : <span className="skeleton" />}
            </a>
          ))}
        </div>
      )}
      {others.map((f) => (
        <a key={f.path} className="attach-file" href={urls[f.path]} target="_blank" rel="noreferrer" download={f.name}>
          <span className="attach-ext">{extOf(f.name)}</span>
          <span className="attach-text"><strong>{f.name}</strong><span className="muted">{sizeLabel(f.size)}</span></span>
          <Icon name="download" size={18} />
        </a>
      ))}
    </div>
  )
}

/** Aperçu d'une image avant envoi. */
function FileThumb({ file }: { file: File }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setSrc(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return src ? <img className="composer-thumb" src={src} alt="" /> : <span className="composer-thumb" />
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000)
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

type Suggestion = { key: string; label: string; hint: string; insert: string; member?: Member; icon?: 'board' | 'pr'; cls?: string }

export function Chat({ docked = false }: { docked?: boolean } = {}) {
  const ws = useWorkspace()
  const { channels, members, tasks } = ws
  const { backend, incoming, messageUpdate, reactionChange, online, createTask, user, reload } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const me = user?.id ?? 'me'
  const [params] = useSearchParams()
  const wanted = docked ? null : params.get('salon')
  const [channelId, setChannelId] = useState(channels.find((c) => c.id === wanted)?.id ?? channels[0]?.id ?? '')
  useEffect(() => {
    if (wanted && channels.some((c) => c.id === wanted)) setChannelId(wanted)
  }, [wanted, channels])
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [pick, setPick] = useState(0)
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null)
  /** Sur écran tactile : message touché, dont on montre les actions. */
  const [touched, setTouched] = useState<string | null>(null)
  /** Fichiers prêts à partir avec le prochain message. */
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [sending, setSending] = useState(false)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  // Salons : création, renommage, suppression.
  const [channelDialog, setChannelDialog] = useState<{ mode: 'new' | 'rename' | 'delete'; channel?: Channel } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const repo = projectRepo(ws)

  const openTask = (id: string) => navigate(`/tableau?tache=${id}`)

  // Discord : serveur du projet et salons reliés.
  const isAdmin = (members.find((m) => m.id === user?.id) ?? (backend.mode === 'demo' ? members[0] : undefined))?.role === 'admin'
  const [discord, setDiscord] = useState<{ guild: DiscordGuild | null; links: DiscordLink[]; account?: DiscordAccount | null }>({ guild: null, links: [] })
  const [discordOpen, setDiscordOpen] = useState(false)
  const reloadDiscord = async () => setDiscord(await backend.discordState().catch(() => ({ guild: null, links: [] })))
  useEffect(() => {
    let alive = true
    void backend.discordState().then((d) => alive && setDiscord(d), () => undefined)
    return () => { alive = false }
  }, [backend, ws.group.id])
  const linkOf = (id: string) => discord.links.find((l) => l.channelId === id)

  useEffect(() => {
    let alive = true
    void backend.listMessages(channelId).then((m) => alive && setMessages(m))
    return () => {
      alive = false
    }
  }, [backend, channelId])

  useEffect(() => {
    if (incoming && incoming.channelId === channelId) setMessages((ms) => (ms.some((m) => m.id === incoming.id) ? ms : [...ms, incoming]))
  }, [incoming, channelId])
  useEffect(() => {
    if (messageUpdate) setMessages((ms) => ms.map((m) => (m.id === messageUpdate.id ? { ...m, ...messageUpdate, reactions: m.reactions } : m)))
  }, [messageUpdate])
  useEffect(() => {
    if (reactionChange && reactionChange.userId !== me) applyReaction(reactionChange.messageId, reactionChange.emoji, reactionChange.userId, reactionChange.on)
  }, [reactionChange]) // eslint-disable-line react-hooks/exhaustive-deps

  const lastId = messages.at(-1)?.id
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    // Pièces jointes : leur hauteur arrive un peu après.
    const t = setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 450)
    return () => clearTimeout(t)
  }, [lastId])

  // Adresses des pièces jointes affichées (valables une heure).
  const missing = messages.flatMap((m) => m.attachments ?? []).map((a) => a.path).filter((p) => !(p in urls))
  const missingKey = missing.join('|')
  useEffect(() => {
    if (!missing.length) return
    let alive = true
    void backend.attachmentUrls(missing).then((u) => alive && setUrls((x) => ({ ...x, ...Object.fromEntries(missing.map((p) => [p, ''])), ...u })), () => undefined)
    return () => { alive = false }
  }, [backend, missingKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function addFiles(list: FileList | File[] | null) {
    const picked = [...(list ?? [])].filter((f) => f.size > 0)
    const big = picked.find((f) => f.size > 25 * 1024 * 1024)
    if (big) toast(`${big.name} dépasse 25 Mo`)
    setFiles((fs) => [...fs, ...picked.filter((f) => f.size <= 25 * 1024 * 1024)].slice(0, 10))
    inputRef.current?.focus()
  }

  function applyReaction(messageId: string, emoji: string, userId: string, on: boolean) {
    setMessages((ms) =>
      ms.map((m) => {
        if (m.id !== messageId) return m
        const list = (m.reactions ?? []).map((r) => ({ ...r }))
        const r = list.find((x) => x.emoji === emoji)
        if (on) {
          if (!r) list.push({ emoji, userIds: [userId] })
          else if (!r.userIds.includes(userId)) r.userIds.push(userId)
        } else if (r) r.userIds = r.userIds.filter((u) => u !== userId)
        return { ...m, reactions: list.filter((x) => x.userIds.length) }
      }),
    )
  }

  function toggleReaction(m: Message, emoji: string) {
    const on = !(m.reactions ?? []).find((r) => r.emoji === emoji)?.userIds.includes(me)
    applyReaction(m.id, emoji, me, on)
    void backend.react(m.id, emoji, on).catch((e: Error) => {
      applyReaction(m.id, emoji, me, !on)
      toast(e.message)
    })
  }

  // Autocomplétion : @ pour une personne, # pour une tâche ou une PR.
  const at = /(?:^|\s)@([\p{L}\d_' -]{0,40})$/u.exec(text)?.[1]
  const hash = /(?:^|\s)#([^\s#@][^#@]{0,40}|)$/u.exec(text)?.[1]
  const pulls = useAsync(hash !== undefined && repo ? () => listPulls(repo, 'open') : null, [hash !== undefined, repo?.owner, repo?.repo])
  const suggestions = useMemo<Suggestion[]>(() => {
    if (at !== undefined) {
      const q = at.toLowerCase()
      return members
        .filter((m) => m.name.toLowerCase().startsWith(q) || (!q.includes(' ') && m.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q))))
        .filter((m) => m.name.toLowerCase() !== q.trimEnd())
        .slice(0, 6)
        .map((m) => ({ key: m.id, label: m.name, hint: m.title, insert: `@${m.name} `, member: m }))
    }
    if (hash !== undefined) {
      const q = hash.toLowerCase().trim()
      const ts = tasks
        .filter((t) => !q || t.title.toLowerCase().includes(q))
        .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))
        .slice(0, 5)
        .map((t): Suggestion => ({ key: t.id, label: t.title, hint: STATUSES.find((s) => s.id === t.status)?.label ?? '', insert: `[#${t.title.replace(/[[\]]/g, '')}](tache:${t.id}) `, icon: 'board', cls: `status-${t.status}` }))
      const ps = (pulls.data ?? [])
        .filter((p) => !q || p.title.toLowerCase().includes(q) || String(p.number).startsWith(q))
        .slice(0, 4)
        .map((p): Suggestion => ({ key: p.url, label: `#${p.number} ${p.title}`, hint: p.branch, insert: `${p.url} `, icon: 'pr', cls: 'pr' }))
      return [...ts, ...ps]
    }
    return []
  }, [at, hash, members, tasks, pulls.data])

  function insert(s: Suggestion) {
    setText((t) => t.replace(at !== undefined ? /@[\p{L}\d_' -]{0,40}$/u : /#[^#@]{0,41}$/u, s.insert))
    setPick(0)
    inputRef.current?.focus()
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setPick((p) => (p + 1) % suggestions.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setPick((p) => (p - 1 + suggestions.length) % suggestions.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insert(suggestions[pick]); return }
      if (e.key === 'Escape') { setText((t) => t + ' '); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
    if (e.key === 'ArrowUp' && !text) {
      const mine = [...messages].reverse().find((m) => m.authorId === me && !m.deletedAt && !m.discord)
      if (mine) { e.preventDefault(); setEditing({ id: mine.id, body: mine.body }) }
    }
  }

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const body = text.trim()
    if (sending || (!body && !files.length)) return
    if (files.length) {
      const pending = files
      setSending(true)
      try {
        const msg = await backend.sendMessage(channelId, body, pending)
        setText('')
        setFiles([])
        setMessages((ms) => (ms.some((m) => m.id === msg.id) ? ms : [...ms, msg]))
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Envoi impossible')
      } finally {
        setSending(false)
      }
      return
    }
    setText('')
    const cmd = /^\/t[aâ]che\s+(.+)/i.exec(body)
    if (cmd) {
      const t = await createTask({ title: cmd[1], status: 'todo' })
      const msg = await backend.sendMessage(channelId, `Nouvelle tâche : [#${t.title.replace(/[[\]]/g, '')}](tache:${t.id})`)
      setMessages((ms) => (ms.some((m) => m.id === msg.id) ? ms : [...ms, msg]))
      return
    }
    try {
      const msg = await backend.sendMessage(channelId, body)
      setMessages((ms) => (ms.some((m) => m.id === msg.id) ? ms : [...ms, msg]))
    } catch (err) {
      setText(body)
      toast(err instanceof Error ? err.message : 'Envoi impossible')
    }
  }

  async function saveEdit() {
    if (!editing) return
    const body = editing.body.trim()
    const before = messages.find((m) => m.id === editing.id)
    setEditing(null)
    if (!body || body === before?.body) return
    setMessages((ms) => ms.map((m) => (m.id === editing.id ? { ...m, body, editedAt: new Date().toISOString() } : m)))
    await backend.editMessage(editing.id, body).catch((e: Error) => toast(e.message))
  }

  async function remove(m: Message) {
    setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, body: '', deletedAt: new Date().toISOString() } : x)))
    await backend.deleteMessage(m.id).catch((e: Error) => toast(e.message))
  }

  async function toTask(m: Message) {
    const title = m.body.replace(TASK_RE, '#$1').replace(/\s+/g, ' ').slice(0, 120)
    const t = await createTask({ title, status: 'todo' })
    toast('Tâche créée')
    openTask(t.id)
  }

  const channel = channels.find((c) => c.id === channelId)

  return (
    <div className={docked ? 'chat docked' : 'page chat'}>
      {docked ? (
        <div className="dock-channels" role="tablist" aria-label="Salons">
          {channels.map((c) => (
            <button key={c.id} role="tab" aria-selected={c.id === channelId} className={`chip${c.id === channelId ? '' : ''}`} onClick={() => setChannelId(c.id)}># {c.name}</button>
          ))}
        </div>
      ) : (
      <nav className="channels" aria-label="Salons" data-tour="channels">
        <h1 style={{ padding: '0 12px 10px' }}>Chat</h1>
        {channels.map((c) => (
          <div key={c.id} className={`channel-row${c.id === channelId ? ' active' : ''}`}>
            <button className={`channel${c.id === channelId ? ' active' : ''}`} onClick={() => setChannelId(c.id)}>
              <span className="channel-name"># {c.name}</span>
              {linkOf(c.id) && <span className="channel-discord" title={`Relié à # ${linkOf(c.id)!.discordChannelName} sur Discord`}><DiscordMark size={20} /></span>}
            </button>
            {isAdmin && (
              <Popover label={`Options de #${c.name}`} className="channel-more" button={({ open, toggle }) => (
                <button className="channel-more-btn" aria-expanded={open} aria-label={`Options de #${c.name}`} onClick={toggle}>•••</button>
              )}>
                {(close) => (
                  <>
                    <button className="pop-item" onClick={() => { close(); setChannelDialog({ mode: 'rename', channel: c }) }}>Renommer</button>
                    <button className="pop-item danger" onClick={() => { close(); setChannelDialog({ mode: 'delete', channel: c }) }} disabled={channels.length < 2}>Supprimer</button>
                  </>
                )}
              </Popover>
            )}
          </div>
        ))}
        <button className="channel channel-new" onClick={() => setChannelDialog({ mode: 'new' })}><Icon name="plus" size={16} /> Nouveau salon</button>
      </nav>
      )}

      <section className={`card thread${dragging ? ' dragging' : ''}`} aria-label={`Salon ${channel?.name ?? ''}`}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true) } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
        onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) } }}>
        {dragging && <div className="drop-hint" aria-hidden="true"><Icon name="upload" size={28} /><strong>Dépose pour joindre à #{channel?.name}</strong></div>}
        <header className="thread-head">
          <h2># {channel?.name}</h2>
          <div className="thread-tools">
            {channel && (linkOf(channel.id) ? (
              <button className="discord-pill" onClick={() => setDiscordOpen(true)} title="Messages partagés avec Discord">
                <DiscordMark size={18} /> # {linkOf(channel.id)!.discordChannelName}
              </button>
            ) : isAdmin && (
              <button className="btn discord small" onClick={() => setDiscordOpen(true)}>Relier à Discord</button>
            ))}
            <VoiceJoin />
            <AvatarGroup members={members.filter((m) => online.includes(m.id))} size={26} max={5} online={online} />
          </div>
        </header>

        <div className="messages" ref={listRef} aria-live="polite">
          {messages.length === 0 && (
            <div className="chat-empty">
              <span className="chat-empty-ico"><Icon name="chat" size={26} /></span>
              <strong>Premier message dans #{channel?.name}</strong>
              <span className="muted">@ pour mentionner · # pour citer une tâche ou une PR</span>
            </div>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1]
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString()
            const grouped = !newDay && prev?.authorId === m.authorId && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60000
            const author = members.find((x) => x.id === m.authorId)
            // Message écrit sur Discord par quelqu'un qui a relié son compte : rangé de son côté.
            const mine = m.authorId === me
            return (
              <div key={m.id} className="msg-wrap">
                {newDay && <div className="day-sep"><span>{dayLabel(m.createdAt)}</span></div>}
                <div className={`msg${mine ? ' mine' : ''}${grouped ? ' grouped' : ''}${touched === m.id ? ' touched' : ''}`} onPointerUp={(e) => e.pointerType === 'touch' && setTouched((t) => (t === m.id ? null : m.id))}>
                  {!mine && (grouped ? <span className="msg-gutter" /> : m.discord && !author ? (
                    <span className="avatar discord-avatar" style={{ width: 34, height: 34, fontSize: 14 }} title={`${m.discord.name} · Discord`}>
                      {m.discord.avatar ? <img src={m.discord.avatar} alt="" width={34} height={34} /> : initials(m.discord.name)}
                    </span>
                  ) : <Avatar member={author} size={34} online={!!author && online.includes(author.id)} />)}
                  <div className="msg-body">
                    {!grouped && (
                      <span className="msg-meta">
                        {!mine && <strong>{author?.name ?? m.discord?.name ?? 'Ancien membre'}</strong>}
                        {m.discord && <span className="discord-tag">Discord</span>}
                        <span>{time(m.createdAt)}</span>
                      </span>
                    )}
                    {editing?.id === m.id ? (
                      <div className="bubble editing">
                        <textarea autoFocus value={editing.body} onChange={(e) => setEditing({ id: m.id, body: e.target.value })} onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void saveEdit() }
                          if (e.key === 'Escape') setEditing(null)
                        }} aria-label="Modifier le message" />
                        <span className="edit-hint">Entrée pour enregistrer · Échap pour annuler</span>
                      </div>
                    ) : m.deletedAt ? (
                      <div className="bubble deleted">Message supprimé</div>
                    ) : (
                      <>
                        {(m.body || !m.attachments?.length) && (
                          <div className="bubble">
                            <p>{renderBody(m.body, members, tasks, openTask)}{m.editedAt && <span className="edited"> (modifié)</span>}</p>
                          </div>
                        )}
                        {!!m.attachments?.length && <Attachments files={m.attachments} urls={urls} />}
                      </>
                    )}
                    {!m.deletedAt && <Refs body={m.body} tasks={tasks} members={members} open={openTask} />}
                    {!!m.reactions?.length && (
                      <div className="reactions">
                        {m.reactions.map((r) => (
                          <button key={r.emoji} className={`reaction${r.userIds.includes(me) ? ' on' : ''}`} onClick={() => toggleReaction(m, r.emoji)}
                            title={r.userIds.map((u) => members.find((x) => x.id === u)?.name ?? 'Quelqu’un').join(', ')}>
                            <span>{r.emoji}</span> {r.userIds.length}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {!m.deletedAt && editing?.id !== m.id && backend.chatActions() && (
                    <div className="msg-tools" role="toolbar" aria-label="Actions sur le message">
                      {QUICK.slice(0, 4).map((e) => (
                        <button key={e} className="tool-emoji" aria-label={`Réagir ${e}`} onClick={() => toggleReaction(m, e)}>{e}</button>
                      ))}
                      <Popover
                        label="Plus d'actions"
                        className="msg-more"
                        button={({ open, toggle }) => (
                          <button className="tool-more" aria-expanded={open} aria-label="Plus d'actions" onClick={toggle}>•••</button>
                        )}
                      >
                        {(close) => (
                          <>
                            <div className="pop-emojis">
                              {QUICK.map((e) => <button key={e} onClick={() => { close(); toggleReaction(m, e) }} aria-label={`Réagir ${e}`}>{e}</button>)}
                            </div>
                            {mine && !m.discord && <button className="pop-item" onClick={() => { close(); setEditing({ id: m.id, body: m.body }) }}>Modifier</button>}
                            <button className="pop-item" onClick={() => { close(); void navigator.clipboard?.writeText(m.body).then(() => toast('Texte copié')) }}>Copier le texte</button>
                            <button className="pop-item" onClick={() => { close(); void toTask(m) }}>Créer une tâche</button>
                            {mine && !m.discord && <button className="pop-item danger" onClick={() => { close(); void remove(m) }}>Supprimer</button>}
                          </>
                        )}
                      </Popover>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="composer" data-tour="composer">
          {suggestions.length > 0 && (
            <div className="suggest" role="listbox" aria-label={at !== undefined ? 'Mentionner' : 'Citer une tâche ou une PR'}>
              {suggestions.map((s, i) => (
                <button key={s.key} role="option" aria-selected={i === pick} className={i === pick ? 'active' : ''} onMouseDown={(e) => { e.preventDefault(); insert(s) }}>
                  {s.member ? <Avatar member={s.member} size={26} /> : <span className={`ref-icon small ${s.cls ?? ''}`}><Icon name={s.icon ?? 'board'} size={14} /></span>}
                  <span className="suggest-text"><span>{s.label}</span>{s.hint && <small>{s.hint}</small>}</span>
                </button>
              ))}
            </div>
          )}
          {files.length > 0 && (
            <div className="composer-files" aria-label="Pièces jointes">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="composer-file">
                  {f.type.startsWith('image/') ? <FileThumb file={f} /> : <span className="attach-ext small">{extOf(f.name)}</span>}
                  <span className="composer-file-name">{f.name}</span>
                  <button type="button" aria-label={`Retirer ${f.name}`} onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}><Icon name="close" size={14} /></button>
                </span>
              ))}
            </div>
          )}
          <form onSubmit={send}>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            <button type="button" className="composer-ref" aria-label="Joindre un fichier" title="Joindre un fichier" onClick={() => fileRef.current?.click()}><Icon name="clip" size={18} /></button>
            <button type="button" className="composer-ref" aria-label="Citer une tâche ou une PR" onClick={() => { setText((t) => (t && !t.endsWith(' ') ? `${t} #` : `${t}#`)); inputRef.current?.focus() }}>#</button>
            <label className="sr-only" htmlFor="msg">Message</label>
            <textarea
              id="msg"
              ref={inputRef}
              rows={1}
              value={text}
              onChange={(e) => { setText(e.target.value); setPick(0) }}
              onKeyDown={onKey}
              onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files) } }}
              placeholder={`Écrire dans #${channel?.name ?? ''}${channel && linkOf(channel.id) ? ' · Discord le voit aussi' : ''}`}
              autoComplete="off"
            />
            <button className="btn small" aria-label="Envoyer" disabled={sending || (!text.trim() && !files.length)}>
              <Icon name="send" size={18} />
            </button>
          </form>
        </div>
      </section>
      {channelDialog?.mode === 'new' && (
        <PromptDialog title="Nouveau salon" confirm="Créer" onClose={() => setChannelDialog(null)}
          fields={[{ name: 'name', label: 'Nom du salon', prefix: '#', placeholder: 'design', maxLength: 40, required: true }]}
          onSubmit={async (v) => {
            const n = v.name.trim().replace(/^#/, '')
            if (!n) return 'Donne un nom au salon'
            try {
              const c = await backend.createChannel(n)
              await reload()
              setChannelId(c.id)
              setChannelDialog(null)
              toast(`#${c.name} créé`)
            } catch (e) { return e instanceof Error ? e.message : 'Création impossible' }
          }} />
      )}
      {channelDialog?.mode === 'rename' && channelDialog.channel && (
        <PromptDialog title={`Renommer #${channelDialog.channel.name}`} confirm="Enregistrer" onClose={() => setChannelDialog(null)}
          fields={[{ name: 'name', label: 'Nom du salon', prefix: '#', initial: channelDialog.channel.name, maxLength: 40, required: true }]}
          onSubmit={async (v) => {
            const n = v.name.trim().replace(/^#/, '')
            if (!n) return 'Donne un nom au salon'
            try {
              await backend.renameChannel(channelDialog.channel!.id, n)
              await Promise.all([reload(), reloadDiscord()])
              setChannelDialog(null)
              toast(linkOf(channelDialog.channel!.id) ? 'Salon renommé, sur Discord aussi' : 'Salon renommé')
            } catch (e) { return e instanceof Error ? e.message : 'Renommage impossible' }
          }} />
      )}
      {channelDialog?.mode === 'delete' && channelDialog.channel && (
        <Modal title={`Supprimer #${channelDialog.channel.name} ?`} onClose={() => setChannelDialog(null)} footer={
          <>
            <button className="btn soft" onClick={() => setChannelDialog(null)}>Annuler</button>
            <button className="btn danger" onClick={() => {
              const c = channelDialog.channel!
              setChannelDialog(null)
              void backend.deleteChannel(c.id).then(async () => {
                await Promise.all([reload(), reloadDiscord()])
                if (c.id === channelId) setChannelId(channels.find((x) => x.id !== c.id)?.id ?? '')
                toast(`#${c.name} mis à la corbeille`, { label: 'Annuler', run: async () => { await backend.restoreItem('channel', c.id); await reload() } })
              }, (e: Error) => toast(e.message))
            }}>Supprimer</button>
          </>
        }>
          <p style={{ marginTop: 0 }}>Le salon part à la corbeille avec ses messages. Tu peux le restaurer pendant 30 jours.</p>
          {linkOf(channelDialog.channel.id) && <p className="muted">Le salon Discord # {linkOf(channelDialog.channel.id)!.discordChannelName} reste en place, il est seulement délié.</p>}
        </Modal>
      )}
      {discordOpen && channel && (
        <DiscordLinkDialog channel={channel} guild={discord.guild} links={discord.links} account={discord.account ?? null} isAdmin={isAdmin} onClose={() => setDiscordOpen(false)} onChange={reloadDiscord} />
      )}
    </div>
  )
}
