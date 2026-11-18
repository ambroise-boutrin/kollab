import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { useStore, useWorkspace } from '../lib/store'
import type { Member, Message } from '../lib/types'

const PR_RE = /https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/g
const TOKEN_RE = /(https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+|https?:\/\/\S+|@[\p{L}\d_-]+)/gu

/** Affiche le texte avec les @mentions surlignées et les liens cliquables. */
function renderBody(body: string, members: Member[]): ReactNode[] {
  return body.split(TOKEN_RE).map((part, i) => {
    if (part.startsWith('@') && members.some((m) => m.name.toLowerCase() === part.slice(1).toLowerCase())) {
      return <span key={i} className="mention">{part}</span>
    }
    if (/^https?:\/\//.test(part)) {
      return <a key={i} href={part} target="_blank" rel="noreferrer">{part}</a>
    }
    return part
  })
}

function PrCards({ body }: { body: string }) {
  const prs = [...body.matchAll(PR_RE)]
  if (!prs.length) return null
  return (
    <>
      {prs.map(([url, owner, repo, num]) => (
        <a key={url} className="ref-card" href={url} target="_blank" rel="noreferrer">
          <span className="ref-icon" style={{ background: 'color-mix(in srgb, var(--ok) 15%, transparent)', color: 'var(--ok)' }}>PR</span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ fontSize: 14 }}>Pull request #{num}</strong>
            <span className="muted" style={{ fontSize: 12 }}>{owner}/{repo}</span>
          </span>
        </a>
      ))}
    </>
  )
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function Chat() {
  const { channels, members } = useWorkspace()
  const { backend, incoming, online, createTask } = useStore()
  const toast = useToast()
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '')
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [pick, setPick] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    void backend.listMessages(channelId).then((m) => alive && setMessages(m))
    return () => {
      alive = false
    }
  }, [backend, channelId])

  // Messages reçus en direct des autres membres.
  useEffect(() => {
    if (incoming && incoming.channelId === channelId) {
      setMessages((ms) => (ms.some((m) => m.id === incoming.id) ? ms : [...ms, incoming]))
    }
  }, [incoming, channelId])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Autocomplétion des mentions : le mot en cours commence par @.
  const query = /(?:^|\s)@([\p{L}\d_-]*)$/u.exec(text)?.[1]
  const suggestions = useMemo(
    () => (query === undefined ? [] : members.filter((m) => m.name.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5)),
    [query, members],
  )

  function insertMention(m: Member) {
    setText((t) => t.replace(/@[\p{L}\d_-]*$/u, `@${m.name} `))
    setPick(0)
    inputRef.current?.focus()
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setPick((p) => (p + 1) % suggestions.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setPick((p) => (p - 1 + suggestions.length) % suggestions.length) }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(suggestions[pick]) }
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    // Commande rapide : /tache Titre crée une tâche dans « À faire ».
    const cmd = /^\/t[aâ]che\s+(.+)/i.exec(body)
    if (cmd) {
      await createTask({ title: cmd[1], status: 'todo' })
      toast(`Tâche « ${cmd[1]} » créée`)
      return
    }
    const msg = await backend.sendMessage(channelId, body)
    setMessages((ms) => (ms.some((m) => m.id === msg.id) ? ms : [...ms, msg]))
  }

  const channel = channels.find((c) => c.id === channelId)

  return (
    <div className="page chat">
      <nav className="channels" aria-label="Salons">
        <h1 style={{ padding: '0 12px 10px' }}>Chat</h1>
        {channels.map((c) => (
          <button key={c.id} className={`channel${c.id === channelId ? ' active' : ''}`} onClick={() => setChannelId(c.id)}>
            # {c.name}
          </button>
        ))}
      </nav>

      <section className="card thread" aria-label={`Salon ${channel?.name ?? ''}`}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h2># {channel?.name}</h2>
          <span className="muted" style={{ fontSize: 13 }}>{members.length} membres · {online.length} en ligne</span>
        </header>

        <div className="messages" ref={listRef} aria-live="polite">
          {messages.length === 0 && <p className="muted" style={{ margin: 'auto', textAlign: 'center' }}>Aucun message pour l'instant. Lance la discussion !</p>}
          {messages.map((m) => {
            const author = members.find((x) => x.id === m.authorId)
            return (
              <div className="msg" key={m.id}>
                <Avatar member={author} size={36} online={!!author && online.includes(author.id)} />
                <div className="msg-body">
                  <span style={{ fontSize: 14 }}>
                    <strong>{author?.name ?? 'Ancien membre'}</strong> <span className="muted" style={{ fontSize: 12 }}>{time(m.createdAt)}</span>
                  </span>
                  <p>{renderBody(m.body, members)}</p>
                  <PrCards body={m.body} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="composer">
          {suggestions.length > 0 && (
            <div className="suggest" role="listbox" aria-label="Mentionner">
              {suggestions.map((m, i) => (
                <button key={m.id} role="option" aria-selected={i === pick} className={i === pick ? 'active' : ''} onMouseDown={(e) => { e.preventDefault(); insertMention(m) }}>
                  <Avatar member={m} size={26} />
                  {m.name}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={send}>
            <label className="sr-only" htmlFor="msg">Message</label>
            <input
              id="msg"
              ref={inputRef}
              value={text}
              onChange={(e) => { setText(e.target.value); setPick(0) }}
              onKeyDown={onKey}
              placeholder={`Écrire dans #${channel?.name ?? ''} · @ pour mentionner · /tache pour créer une tâche`}
              autoComplete="off"
            />
            <button className="btn small" aria-label="Envoyer" disabled={!text.trim()}>
              <Icon name="send" size={18} />
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
