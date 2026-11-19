import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { PromptDialog } from '../components/PromptDialog'
import { useToast } from '../components/Toast'
import type { Room, RoomEvent } from '../lib/backend'
import { useStore, useWorkspace } from '../lib/store'
import type { Member, Note } from '../lib/types'

const toB64 = (u: Uint8Array) => {
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromB64 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0))

type Peer = { clientId: number; name: string; color: string; id: string }

/**
 * Document texte écrit à plusieurs, en direct : chacun voit le curseur et la sélection des autres.
 * Le contenu (Yjs) passe par la salle du document et s'enregistre tout seul en base.
 */
export default function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const ws = useWorkspace()
  const { backend, user, reload } = useStore()
  const toast = useToast()
  const me: Member | undefined = ws.members.find((m) => m.id === user?.id) ?? (backend.mode === 'demo' ? ws.members[0] : undefined)
  const canWrite = me?.role !== 'guest'
  const [title, setTitle] = useState(note.title)
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState<'ok' | 'pending' | 'error'>('ok')
  const [peers, setPeers] = useState<Peer[]>([])

  const doc = useMemo(() => new Y.Doc(), [note.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const awareness = useMemo(() => new Awareness(doc), [doc])
  const provider = useMemo(() => ({ awareness }), [awareness])
  const room = useRef<Room | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const firstPending = useRef(0)

  const editor = useEditor(
    {
      editable: canWrite,
      extensions: [
        StarterKit.configure({ undoRedo: false, link: { openOnClick: false, autolink: true } }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Placeholder.configure({ placeholder: 'Écris ici… Les autres voient ton curseur en direct.' }),
        Collaboration.configure({ document: doc }),
        CollaborationCaret.configure({
          provider,
          user: { name: me?.name ?? 'Invité', color: me?.color ?? '#5546E0' },
          render: (u) => {
            const caret = document.createElement('span')
            caret.className = 'collab-caret'
            caret.style.borderColor = u.color
            const label = document.createElement('span')
            label.className = 'collab-label'
            label.style.background = u.color
            label.textContent = String(u.name).split(' ')[0]
            caret.append(label)
            return caret
          },
          selectionRender: (u) => ({ nodeName: 'span', class: 'collab-selection', style: `background-color: ${u.color}33` }),
        }),
      ],
      editorProps: { attributes: { class: 'note-prose', spellcheck: 'true' } },
    },
    [doc],
  )

  // Enregistre le contenu : 1,2 s après la dernière frappe, et au plus tard toutes les 6 s.
  function scheduleSave() {
    setSaved('pending')
    if (!firstPending.current) firstPending.current = Date.now()
    clearTimeout(saveTimer.current)
    const wait = Math.max(0, Math.min(1200, 6000 - (Date.now() - firstPending.current)))
    saveTimer.current = setTimeout(() => void flush(), wait)
  }
  async function flush() {
    clearTimeout(saveTimer.current)
    firstPending.current = 0
    try {
      await backend.saveNote(note.id, { ystate: toB64(Y.encodeStateAsUpdate(doc)), preview: editorRef.current?.getText({ blockSeparator: '\n' }).slice(0, 2000) ?? '' })
      setSaved('ok')
    } catch {
      setSaved('error')
    }
  }
  const editorRef = useRef(editor)
  editorRef.current = editor

  // Démo : le document d'exemple n'a que son aperçu ; on l'écrit une fois dans l'éditeur.
  const seedFromPreview = useRef<string | null>(null)
  useEffect(() => {
    const text = seedFromPreview.current
    if (!editor || !loaded || !text) return
    seedFromPreview.current = null
    editor.commands.setContent(text.split('\n').map((l) => ({ type: 'paragraph', content: l ? [{ type: 'text', text: l }] : [] })))
  }, [editor, loaded])

  // Chargement depuis la base, puis salle en direct.
  useEffect(() => {
    let alive = true
    let r: Room | null = null
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote' || origin === 'load') return
      r?.send({ type: 'y', u: toB64(update) })
      if (canWrite) scheduleSave()
    }
    const onAware = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin !== 'remote') r?.send({ type: 'aw', u: toB64(encodeAwarenessUpdate(awareness, [...added, ...updated, ...removed])) })
      const list: Peer[] = []
      awareness.getStates().forEach((st, clientId) => {
        const u = st.user as { name?: string; color?: string; id?: string } | undefined
        if (u?.name) list.push({ clientId, name: u.name, color: u.color ?? '#5546E0', id: u.id ?? '' })
      })
      setPeers(list)
    }
    void backend
      .loadNote(note.id)
      .then((b64) => {
        if (!alive) return
        if (b64) Y.applyUpdate(doc, fromB64(b64), 'load')
        else if (backend.mode === 'demo' && note.preview) seedFromPreview.current = note.preview
        setLoaded(true)
        doc.on('update', onUpdate)
        awareness.on('update', onAware)
        awareness.setLocalStateField('user', { name: me?.name ?? 'Invité', color: me?.color ?? '#5546E0', id: me?.id ?? '' })
        r = backend.joinRoom(`note:${note.id}`, {
          onPeers: () => {
            // Quelqu'un arrive : on renvoie notre présence pour qu'il nous voie tout de suite.
            r?.send({ type: 'aw', u: toB64(encodeAwarenessUpdate(awareness, [doc.clientID])) })
          },
          onEvent: (e: RoomEvent) => {
            if (e.type === 'y') Y.applyUpdate(doc, fromB64(e.u as string), 'remote')
            else if (e.type === 'aw') applyAwarenessUpdate(awareness, fromB64(e.u as string), 'remote')
            else if (e.type === 'sync1') r?.send({ type: 'y', u: toB64(Y.encodeStateAsUpdate(doc, fromB64(e.sv as string))) })
            else if (e.type === 'title') setTitle(String(e.title))
          },
        })
        room.current = r
        r.send({ type: 'sync1', sv: toB64(Y.encodeStateVector(doc)) })
      })
      .catch(() => alive && toast('Impossible d\'ouvrir ce document'))
    return () => {
      alive = false
      doc.off('update', onUpdate)
      awareness.off('update', onAware)
      removeAwarenessStates(awareness, [doc.clientID], 'local')
      r?.send({ type: 'aw', u: toB64(encodeAwarenessUpdate(awareness, [doc.clientID])) })
      r?.leave()
      room.current = null
    }
  }, [doc, awareness]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fermeture : on enregistre ce qui reste.
  async function close() {
    if (saveTimer.current && canWrite) await flush()
    void reload()
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && void close()
    window.addEventListener('keydown', onKey)
    const onLeave = () => {
      if (saveTimer.current && canWrite) void flush()
    }
    window.addEventListener('pagehide', onLeave)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pagehide', onLeave)
    }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  async function rename(next: string) {
    const t = next.trim() || 'Sans titre'
    setTitle(t)
    if (t === note.title) return
    room.current?.send({ type: 'title', title: t })
    try {
      await backend.saveNote(note.id, { title: t })
    } catch {
      toast('Renommage impossible')
    }
  }

  async function remove() {
    clearTimeout(saveTimer.current)
    await backend.removeNote(note.id)
    await reload()
    const id = note.id
    toast('Mis à la corbeille', { label: 'Annuler', run: async () => { await backend.restoreItem('note', id); await reload() } })
    onClose()
  }

  const others = peers.filter((p) => p.clientId !== doc.clientID)
  const author = ws.members.find((m) => m.id === note.updatedBy)

  return createPortal(
    <div className="note-back" role="dialog" aria-modal="true" aria-label={title}>
      <header className="note-top">
        <button className="icon-btn" aria-label="Fermer" onClick={() => void close()}><Icon name="close" size={20} /></button>
        <input
          className="note-title"
          value={title}
          aria-label="Titre du document"
          readOnly={!canWrite}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={(e) => void rename(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <div className="note-people" aria-label={`${others.length + 1} dans le document`}>
          {others.map((p) => {
            const m = ws.members.find((x) => x.id === p.id)
            return m ? <Avatar key={p.clientId} member={m} size={30} /> : <span key={p.clientId} className="note-peer" style={{ background: p.color }}>{p.name[0]}</span>
          })}
        </div>
        <span className={`note-saved ${saved}`}>{saved === 'ok' ? 'Enregistré' : saved === 'pending' ? 'Enregistrement…' : 'Hors ligne, réessai…'}</span>
        {editor && <button className="icon-btn" aria-label="Télécharger en Markdown" title="Télécharger (.md)" onClick={() => download(title, editor)}><Icon name="download" size={18} /></button>}
        {canWrite && <button className="icon-btn" aria-label="Mettre à la corbeille" title="Mettre à la corbeille" onClick={() => void remove()}><Icon name="trash" size={18} /></button>}
      </header>

      {editor && canWrite && <Toolbar editor={editor} />}

      <div className="note-scroll">
        <div className="note-page">
          {loaded && editor && canWrite && <Templates editor={editor} onTitle={(t) => { if (!title.trim() || title === 'Sans titre') { setTitle(t); void rename(t) } }} />}
          {!loaded ? <div className="note-loading"><span className="spinner dark" /></div> : <EditorContent editor={editor} />}
          {!canWrite && <p className="hint">Lecture seule.</p>}
        </div>
        <p className="note-foot muted">
          {others.length ? `${others.map((p) => p.name.split(' ')[0]).join(', ')} ${others.length > 1 ? 'écrivent' : 'écrit'} avec toi` : author ? `Modifié par ${author.name}` : ''}
        </p>
      </div>
    </div>,
    document.body,
  )
}

type Ed = NonNullable<ReturnType<typeof useEditor>>

function Toolbar({ editor }: { editor: Ed }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      block: e.isActive('codeBlock'),
      under: e.isActive('underline'),
      check: e.isActive('taskList'),
      link: e.isActive('link'),
    }),
  })
  const b = (label: string, on: boolean, run: () => void, content: React.ReactNode) => (
    <button type="button" className={`tb${on ? ' on' : ''}`} aria-label={label} title={label} aria-pressed={on} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      {content}
    </button>
  )
  const c = () => editor.chain().focus()
  const [linking, setLinking] = useState(false)
  return (
    <div className="note-toolbar" role="toolbar" aria-label="Mise en forme">
      {linking && (
        <PromptDialog title="Ajouter un lien" confirm="Ajouter" onClose={() => setLinking(false)}
          fields={[{ name: 'url', label: 'Adresse', type: 'url', inputMode: 'url', placeholder: 'https://…', required: true }]}
          onSubmit={(v) => {
            const raw = v.url.trim()
            const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
            if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(href)) return 'Adresse invalide'
            if (editor.state.selection.empty) c().insertContent({ type: 'text', text: raw, marks: [{ type: 'link', attrs: { href } }] }).run()
            else c().setLink({ href }).run()
          }} />
      )}
      {b('Titre', s.h1, () => c().toggleHeading({ level: 1 }).run(), <b>T1</b>)}
      {b('Sous-titre', s.h2, () => c().toggleHeading({ level: 2 }).run(), <b>T2</b>)}
      <span className="tb-sep" />
      {b('Gras', s.bold, () => c().toggleBold().run(), <b>G</b>)}
      {b('Italique', s.italic, () => c().toggleItalic().run(), <i style={{ fontFamily: 'Georgia, serif' }}>I</i>)}
      {b('Barré', s.strike, () => c().toggleStrike().run(), <s>S</s>)}
      {b('Souligné', s.under, () => c().toggleUnderline().run(), <u>U</u>)}
      {b('Code', s.code, () => c().toggleCode().run(), <code>{'<>'}</code>)}
      {b('Lien', s.link, () => { if (s.link) c().unsetLink().run(); else setLinking(true) }, <Icon name="link" size={16} />)}
      <span className="tb-sep" />
      {b('Liste', s.bullet, () => c().toggleBulletList().run(), <span>•</span>)}
      {b('Liste numérotée', s.ordered, () => c().toggleOrderedList().run(), <span>1.</span>)}
      {b('Cases à cocher', s.check, () => c().toggleTaskList().run(), <Icon name="check" size={16} />)}
      {b('Citation', s.quote, () => c().toggleBlockquote().run(), <span>“</span>)}
      {b('Bloc de code', s.block, () => c().toggleCodeBlock().run(), <span>{'{}'}</span>)}
      {b('Séparateur', false, () => c().setHorizontalRule().run(), <span>—</span>)}
      <span className="tb-sep" />
      {b('Annuler', false, () => c().undo().run(), <span>↶</span>)}
      {b('Rétablir', false, () => c().redo().run(), <span>↷</span>)}
    </div>
  )
}

const TEMPLATES: { id: string; name: string; color: string; html: string }[] = [
  { id: 'cr', name: 'Compte rendu', color: 'var(--accent)', html: '<h1>Compte rendu</h1><p><strong>Date :</strong> </p><p><strong>Présents :</strong> </p><h2>Points abordés</h2><ul><li><p></p></li></ul><h2>Décisions</h2><ul><li><p></p></li></ul><h2>À faire</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>' },
  { id: 'cdc', name: 'Cahier des charges', color: '#D9822B', html: '<h1>Cahier des charges</h1><h2>Contexte</h2><p></p><h2>Objectifs</h2><ul><li><p></p></li></ul><h2>Utilisateurs</h2><p></p><h2>Fonctionnalités</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul><h2>Contraintes</h2><p></p><h2>Planning</h2><p></p>' },
  { id: 'spec', name: 'Spécification', color: '#2F6FD0', html: '<h1>Spécification</h1><h2>Problème</h2><p></p><h2>Solution proposée</h2><p></p><h2>Détails techniques</h2><pre><code></code></pre><h2>Critères d\'acceptation</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul><h2>Questions ouvertes</h2><ul><li><p></p></li></ul>' },
  { id: 'retro', name: 'Rétro de sprint', color: 'var(--ok)', html: '<h1>Rétro de sprint</h1><h2>Ce qui a bien marché</h2><ul><li><p></p></li></ul><h2>Ce qui a coincé</h2><ul><li><p></p></li></ul><h2>On essaie la prochaine fois</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>' },
]

/** Document vide : partir d'un modèle en un clic. */
function Templates({ editor, onTitle }: { editor: Ed; onTitle: (t: string) => void }) {
  const empty = useEditorState({ editor, selector: ({ editor: e }) => e.isEmpty })
  if (!empty) return null
  return (
    <div className="note-templates">
      <span className="muted">Partir d'un modèle</span>
      <div className="note-templates-row">
        {TEMPLATES.map((t) => (
          <button key={t.id} type="button" className="note-template" style={{ ['--t' as string]: t.color }} onClick={() => { editor.chain().focus().setContent(t.html).run(); onTitle(t.name) }}>
            <span className="note-template-lines" aria-hidden="true"><i /><i /><i /></span>
            <strong>{t.name}</strong>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Export Markdown simple, depuis le contenu de l'éditeur. */
function toMarkdown(node: { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: unknown[] }, depth = 0): string {
  const kids = (sep = '') => ((node.content ?? []) as typeof node[]).map((c) => toMarkdown(c, depth)).join(sep)
  switch (node.type) {
    case 'doc': return ((node.content ?? []) as typeof node[]).map((c) => toMarkdown(c, depth)).join('\n\n')
    case 'heading': return `${'#'.repeat(Number(node.attrs?.level ?? 1))} ${kids()}`
    case 'paragraph': return kids()
    case 'text': {
      let t = node.text ?? ''
      for (const m of node.marks ?? []) {
        if (m.type === 'bold') t = `**${t}**`
        else if (m.type === 'italic') t = `*${t}*`
        else if (m.type === 'strike') t = `~~${t}~~`
        else if (m.type === 'code') t = `\`${t}\``
        else if (m.type === 'link') t = `[${t}](${String(m.attrs?.href ?? '')})`
      }
      return t
    }
    case 'bulletList': return ((node.content ?? []) as typeof node[]).map((c) => `${'  '.repeat(depth)}- ${toMarkdown(c, depth + 1)}`).join('\n')
    case 'orderedList': return ((node.content ?? []) as typeof node[]).map((c, i) => `${'  '.repeat(depth)}${i + 1}. ${toMarkdown(c, depth + 1)}`).join('\n')
    case 'taskList': return ((node.content ?? []) as typeof node[]).map((c) => `${'  '.repeat(depth)}- [${c.attrs?.checked ? 'x' : ' '}] ${toMarkdown(c, depth + 1)}`).join('\n')
    case 'listItem': case 'taskItem': return ((node.content ?? []) as typeof node[]).map((c) => toMarkdown(c, depth)).join('\n')
    case 'blockquote': return kids('\n').split('\n').map((l) => `> ${l}`).join('\n')
    case 'codeBlock': return '```\n' + kids() + '\n```'
    case 'horizontalRule': return '---'
    case 'hardBreak': return '\n'
    default: return kids()
  }
}

function download(title: string, editor: Ed) {
  const md = toMarkdown(editor.getJSON() as Parameters<typeof toMarkdown>[0])
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${(title || 'document').replace(/[\\/:*?"<>|]+/g, '-')}.md`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
