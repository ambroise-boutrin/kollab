import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import '@fontsource-variable/newsreader'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import type { Room, RoomEvent } from '../lib/backend'
import { useStore, useWorkspace } from '../lib/store'
import type { Member, Note, NoteKind } from '../lib/types'
import { NOTE_KINDS, NOTE_KIND_ORDER } from '../lib/noteKinds'
import { templateHtml, placeholderFor } from '../lib/noteTemplates'
import { NoteSlash, NoteToolbar, imageToDataUrl } from './NoteTools'
import { STATUSES, type Task, type TaskStatus } from '../lib/types'

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
export default function NoteEditor({ note, template, onClose }: { note: Note; template?: NoteKind; onClose: () => void }) {
  const ws = useWorkspace()
  const { backend, user, reload, online, createTask } = useStore()
  const toast = useToast()
  const me: Member | undefined = ws.members.find((m) => m.id === user?.id) ?? (backend.mode === 'demo' ? ws.members[0] : undefined)
  const canWrite = me?.role !== 'guest'
  const [title, setTitle] = useState(note.title)
  const [exporting, setExporting] = useState(false)
  const [kind, setKind] = useState<NoteKind>(note.kind)
  const [pinned, setPinned] = useState(note.pinned)
  const [picking, setPicking] = useState(false)
  const navigate = useNavigate()
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const fit = () => {
      const el = titleRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    fit()
    void document.fonts?.ready.then(fit)
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [title, loaded])
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
        TableKit.configure({ table: { resizable: false } }),
        Image.configure({ allowBase64: true }),
        Highlight,
        TextStyle,
        Color,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({ includeChildren: true, showOnlyCurrent: false, placeholder: ({ editor: e, node, pos }) => placeholderFor(e.state.doc, node, pos) }),
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
      editorProps: {
        attributes: { class: 'note-prose', spellcheck: 'true' },
        // Image collée ou déposée : réduite puis insérée là où l'on est.
        handlePaste: (view, event) => {
          const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
          if (!file) return false
          void imageToDataUrl(file).then((src) => view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src })))).catch((e) => toast(e instanceof Error ? e.message : 'Image impossible à ajouter'))
          return true
        },
        handleDrop: (view, event) => {
          const file = [...(event.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'))
          if (!file) return false
          const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from
          void imageToDataUrl(file).then((src) => view.dispatch(view.state.tr.insert(at, view.state.schema.nodes.image.create({ src })))).catch((e) => toast(e instanceof Error ? e.message : 'Image impossible à ajouter'))
          return true
        },
      },
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

  // Nouveau document créé depuis un modèle : on le remplit une fois, s'il est encore vide.
  const templated = useRef(false)
  useEffect(() => {
    if (!editor || !loaded || !template || templated.current || !canWrite) return
    templated.current = true
    if (!editor.isEmpty) return
    const html = templateHtml(template, { members: ws.members, tasks: ws.tasks, sprints: ws.sprints, present: [...new Set([...(user ? [user.id] : []), ...online])] })
    if (html) editor.commands.setContent(html)
  }, [editor, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

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
            else if (e.type === 'meta') { if (e.kind) setKind(e.kind as NoteKind); if (typeof e.pinned === 'boolean') setPinned(e.pinned) }
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

  async function changeKind(k: NoteKind) {
    setPicking(false)
    if (k === kind) return
    const before = kind
    setKind(k)
    room.current?.send({ type: 'meta', kind: k })
    try {
      await backend.saveNote(note.id, { kind: k })
      void reload()
    } catch (err) {
      setKind(before)
      toast(err instanceof Error ? err.message : 'Changement impossible')
    }
  }

  async function togglePin() {
    const next = !pinned
    setPinned(next)
    room.current?.send({ type: 'meta', pinned: next })
    try {
      await backend.saveNote(note.id, { pinned: next })
      toast(next ? 'Épinglé pour toute l\'équipe' : 'Retiré des épinglés')
      void reload()
    } catch (err) {
      setPinned(!next)
      toast(err instanceof Error ? err.message : 'Action impossible')
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
  const sprint = ws.sprints.find((sp) => sp.status === 'active')
  const creator = ws.members.find((m) => m.id === note.createdBy)
  const docId = useMemo(() => {
    const same = ws.notes.filter((n) => n.kind === kind).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const i = same.findIndex((n) => n.id === note.id)
    return `${ID_PREFIX[kind]}-${String((i < 0 ? same.length : i) + 1).padStart(3, '0')}`
  }, [ws.notes, kind, note.id])
  const author = ws.members.find((m) => m.id === note.updatedBy)

  return createPortal(
    <div className="note-back" role="dialog" aria-modal="true" aria-label={title}>
      <header className="note-top">
        <button className="icon-btn" aria-label="Fermer" onClick={() => void close()}><Icon name="close" size={20} /></button>
        <span className="note-crumb"><span className="hide-phone">Documents / </span>{NOTE_KINDS[kind].plural}</span>
        <div className="note-people" aria-label={`${others.length + 1} dans le document`}>
          {others.map((p) => {
            const m = ws.members.find((x) => x.id === p.id)
            return m ? <Avatar key={p.clientId} member={m} size={30} /> : <span key={p.clientId} className="note-peer" style={{ background: p.color }}>{p.name[0]}</span>
          })}
        </div>
        <span className={`note-saved ${saved}`}>{saved === 'ok' ? 'Enregistré' : saved === 'pending' ? 'Enregistrement…' : 'Hors ligne, réessai…'}</span>
        {canWrite && <button className={`btn soft small note-pin${pinned ? ' on' : ''}`} aria-pressed={pinned} onClick={() => void togglePin()}><Icon name="pin" size={16} /><span className="hide-phone">{pinned ? 'Épinglé' : 'Épingler'}</span></button>}
        {editor && <button className="btn soft small" title="Exporter en PDF ou Markdown" onClick={() => setExporting(true)}><Icon name="download" size={16} /><span className="hide-phone">Exporter</span></button>}
        {canWrite && <button className="icon-btn" aria-label="Mettre à la corbeille" title="Mettre à la corbeille" onClick={() => void remove()}><Icon name="trash" size={18} /></button>}
      </header>

      {exporting && editor && (
        <Modal title="Exporter le document" onClose={() => setExporting(false)}>
          <div className="export-choices">
            <button type="button" className="export-choice pdf" onClick={() => { printPdf(title, editor, { project: ws.group.name, kind: NOTE_KINDS[kind].label, id: docId, by: creator?.name ?? '' }); setExporting(false) }}>
              <span className="export-ext">PDF</span>
              <strong>Pour partager ou imprimer</strong>
              <span>Mise en page propre, prête à envoyer.</span>
            </button>
            <button type="button" className="export-choice md" onClick={() => { download(title, editor); setExporting(false) }}>
              <span className="export-ext">MD</span>
              <strong>Markdown</strong>
              <span>Pour un dépôt GitHub ou un wiki.</span>
            </button>
          </div>
        </Modal>
      )}

      {editor && canWrite && <NoteToolbar editor={editor} />}
      {editor && canWrite && <NoteSlash editor={editor} />}

      {picking && (
        <Modal title="Type de document" onClose={() => setPicking(false)}>
          <div className="nk-tpls compact" role="radiogroup" aria-label="Type">
            {NOTE_KIND_ORDER.map((id) => (
              <button key={id} type="button" role="radio" aria-checked={kind === id} className={`nk-tpl${kind === id ? ' on' : ''}`} style={{ ['--nk' as string]: NOTE_KINDS[id].color }} onClick={() => void changeKind(id)}>
                <b>{NOTE_KINDS[id].label}</b>
                <span>{NOTE_KINDS[id].hint}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      <div className="note-scroll">
        <div className="note-layout">
          <div className="note-page" style={{ ['--nk' as string]: NOTE_KINDS[kind].color }}>
            <header className="np-head">
              <div className="np-eyebrow">
                <button type="button" className="np-kind" disabled={!canWrite} onClick={() => setPicking(true)} title={canWrite ? 'Changer le type' : undefined}>{NOTE_KINDS[kind].label}</button>
                {sprint && <span>{sprint.name}</span>}
                <i aria-hidden="true" />
                <span className="np-id">{docId}</span>
              </div>
              <textarea
                ref={titleRef}
                className="np-title"
                rows={1}
                value={title}
                aria-label="Titre du document"
                placeholder="Titre"
                readOnly={!canWrite}
                onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
                onBlur={(e) => void rename(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editor?.commands.focus('start') } }}
              />
              <dl className="np-byline">
                <div><dt>Créé le</dt><dd>{longDate(note.createdAt)}</dd></div>
                {creator && <div><dt>Rédigé par</dt><dd>{creator.name}</dd></div>}
                <div><dt>Modifié</dt><dd>{author && author.id !== creator?.id ? `par ${author.name.split(' ')[0]}, ` : ''}{shortAgo(note.updatedAt)}</dd></div>
                {others.length > 0 && <div><dt>En ce moment</dt><dd className="np-live">{others.map((p) => p.name.split(' ')[0]).join(', ')}</dd></div>}
              </dl>
            </header>
            <div className="note-body">
              {loaded && editor && canWrite && <Templates editor={editor} onPick={(k) => { void changeKind(k); if (!title.trim() || title === 'Sans titre') { const t = NOTE_KINDS[k].label; setTitle(t); void rename(t) } editor.commands.setContent(templateHtml(k, { members: ws.members, tasks: ws.tasks, sprints: ws.sprints, present: [...new Set([...(user ? [user.id] : []), ...online])] }) || '<p></p>') }} />}
              {!loaded ? <div className="note-loading"><span className="spinner dark" /></div> : <EditorContent editor={editor} />}
              {!canWrite && <p className="hint">Lecture seule.</p>}
            </div>
          </div>
          {editor && loaded && <NoteSide editor={editor} doc={doc} canWrite={canWrite} noteTitle={title} createTask={createTask} onOpenTask={(id) => { void close(); setTimeout(() => navigate(`/tableau?tache=${id}`), 0) }} />}
        </div>

      </div>
    </div>,
    document.body,
  )
}

type Ed = NonNullable<ReturnType<typeof useEditor>>

const ID_PREFIX: Record<NoteKind, string> = { cr: 'CR', daily: 'DLY', spec: 'SPEC', retro: 'RET', cdc: 'CDC', idee: 'IDE', page: 'DOC' }
const longDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
function shortAgo(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  if (min < 48 * 60) return `il y a ${Math.round(min / 60)} h`
  return `le ${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
}


const STATUS_COLOR: Record<TaskStatus, string> = { todo: '#5B6275', doing: '#2F6FD0', review: '#D98A1C', done: 'var(--ok)' }

type Outline = { headings: { level: number; text: string; pos: number }[]; todos: { text: string; checked: boolean; pos: number }[] }

function outline(editor: Ed): Outline {
  const headings: Outline['headings'] = []
  const todos: Outline['todos'] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') headings.push({ level: Number(node.attrs.level), text: node.textContent.trim(), pos })
    else if (node.type.name === 'taskItem') {
      todos.push({ text: node.firstChild?.textContent.trim() ?? '', checked: !!node.attrs.checked, pos })
      return false
    }
    return true
  })
  return { headings: headings.filter((h) => h.text), todos: todos.filter((t) => t.text) }
}

const clean = (t: string) => t.replace(/@[\p{L}-]+/gu, '').replace(/\s+/g, ' ').replace(/[\s,;:–-]+$/, '').trim()

/**
 * Panneau à droite du document : sommaire, et les cases « À faire » qui deviennent des tâches du tableau.
 * Les tâches créées sont gardées dans le document lui-même (carte Yjs « tasks » : id de tâche → texte de la case).
 */
function NoteSide({ editor, doc, canWrite, noteTitle, createTask, onOpenTask }: {
  editor: Ed; doc: Y.Doc; canWrite: boolean; noteTitle: string
  createTask: (t: Pick<Task, 'title' | 'status'> & Partial<Task>) => Promise<Task>
  onOpenTask: (id: string) => void
}) {
  const ws = useWorkspace()
  const toast = useToast()
  const o = useEditorState({ editor, selector: ({ editor: e }) => outline(e), equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) })
  const links = useMemo(() => doc.getMap<string>('tasks'), [doc])
  const [linked, setLinked] = useState<[string, string][]>(() => [...links.entries()])
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    const sync = () => setLinked([...links.entries()])
    links.observe(sync)
    return () => links.unobserve(sync)
  }, [links])
  const taskFor = (text: string) => {
    const hit = linked.find(([, t]) => t === text)
    return hit ? ws.tasks.find((x) => x.id === hit[0]) ?? null : null
  }

  // Une tâche liée passe en Terminé sur le tableau : on coche sa case dans le document.
  useEffect(() => {
    if (!canWrite || !o) return
    const toCheck = o.todos.filter((t) => !t.checked && taskFor(t.text)?.status === 'done')
    if (!toCheck.length) return
    const tr = editor.state.tr
    for (const t of toCheck) {
      const node = tr.doc.nodeAt(t.pos)
      if (node?.type.name === 'taskItem') tr.setNodeMarkup(t.pos, undefined, { ...node.attrs, checked: true })
    }
    editor.view.dispatch(tr)
  }, [ws.tasks, linked, o?.todos.length]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toTask(text: string) {
    setBusy(text)
    try {
      const names = [...text.matchAll(/@([\p{L}-]+)/gu)].map((m) => m[1].toLowerCase())
      const assigneeIds = ws.members.filter((m) => names.includes(m.name.split(/\s+/)[0].toLowerCase())).map((m) => m.id)
      const sprint = ws.sprints.find((sp) => sp.status === 'active')
      const t = await createTask({ title: clean(text).slice(0, 200) || text.slice(0, 200), status: 'todo', assigneeIds, sprintId: sprint?.id ?? null, description: `Depuis le document « ${noteTitle} ».` })
      links.set(t.id, text)
      toast(sprint ? `Tâche ajoutée à ${sprint.name}` : 'Tâche ajoutée au backlog')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Création impossible')
    } finally {
      setBusy(null)
    }
  }

  if (!o) return null
  const linkedTasks = linked.map(([id]) => ws.tasks.find((x) => x.id === id)).filter((x): x is Task => !!x)
  const open = o.todos.filter((t) => !t.checked && !taskFor(t.text))
  if (!o.headings.length && !o.todos.length && !linkedTasks.length) return null

  return (
    <aside className="note-side">
      {o.headings.length > 1 && (
        <section className="note-panel">
          <h4>Sommaire</h4>
          <nav className="note-toc">
            {o.headings.map((h, i) => (
              <button key={i} type="button" className={`lvl-${h.level}`} onClick={() => editor.chain().focus().setTextSelection(h.pos + 1).scrollIntoView().run()}>{h.text}</button>
            ))}
          </nav>
        </section>
      )}
      {(open.length > 0 || linkedTasks.length > 0) && (
        <section className="note-panel">
          <h4>À faire → tableau</h4>
          {linkedTasks.map((t) => (
            <button key={t.id} type="button" className="note-task" onClick={() => onOpenTask(t.id)}>
              <span>{t.title}</span>
              <span className="note-st" style={{ ['--c' as string]: STATUS_COLOR[t.status] }}>{STATUSES.find((x) => x.id === t.status)?.label}</span>
            </button>
          ))}
          {canWrite && open.map((t) => (
            <div key={t.pos} className="note-todo">
              <span>{t.text}</span>
              <button type="button" className="btn small" disabled={busy === t.text} onClick={() => void toTask(t.text)}>Créer la tâche</button>
            </div>
          ))}
          {open.length > 1 && canWrite && <button type="button" className="btn soft small" disabled={!!busy} onClick={async () => { for (const t of open) await toTask(t.text) }}>Tout transformer en tâches ({open.length})</button>}
          <p className="note-tip">Écris @Prénom dans la case pour attribuer la tâche.</p>
        </section>
      )}
    </aside>
  )
}

/** Document vide : choisir un modèle (il remplit la page et donne le type). */
function Templates({ editor, onPick }: { editor: Ed; onPick: (k: NoteKind) => void }) {
  const empty = useEditorState({ editor, selector: ({ editor: e }) => e.isEmpty })
  if (!empty) return null
  return (
    <div className="note-templates">
      <span className="muted">Partir d'un modèle</span>
      <div className="note-templates-row">
        {NOTE_KIND_ORDER.filter((k) => k !== 'page').map((k) => (
          <button key={k} type="button" className="note-template" style={{ ['--t' as string]: NOTE_KINDS[k].color }} onClick={() => onPick(k)}>
            <span className="note-template-lines" aria-hidden="true"><i /><i /><i /></span>
            <strong>{NOTE_KINDS[k].label}</strong>
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
    case 'image': {
      const src = String(node.attrs?.src ?? '')
      return src.startsWith('data:') ? '[image]' : `![${String(node.attrs?.alt ?? '')}](${src})`
    }
    case 'table': {
      const rows = ((node.content ?? []) as typeof node[]).map((r) =>
        ((r.content ?? []) as typeof node[]).map((c) => toMarkdown(c, depth).replace(/\n+/g, ' ').replace(/\|/g, '\\|')),
      )
      if (!rows.length) return ''
      const line = (cells: string[]) => `| ${cells.join(' | ')} |`
      return [line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n')
    }
    case 'tableCell': case 'tableHeader': return kids(' ')
    default: return kids()
  }
}

const escapeHtml = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** PDF : on imprime le document dans un cadre caché, le système propose « Enregistrer en PDF ». */
/** PDF : le document est mis en page comme à l'écran (titres Newsreader, parties numérotées) puis imprimé ; le système propose « Enregistrer en PDF ». */
function printPdf(title: string, editor: Ed, meta: { project: string; kind: string; id: string; by: string }) {
  const name = title.trim() || 'Document'
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const body = editor.getHTML()
  // Les polices de l'app (Inter, Newsreader) sont reprises dans le cadre d'impression.
  const fonts = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join('')
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  doc.open()
  doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(name)}</title>${fonts}<style>
    @page { margin: 20mm 18mm 18mm 18mm; }
    html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
    body { margin: 0; font: 10.5pt/1.65 'Inter Variable', system-ui, sans-serif; color: #34343C; counter-reset: part; }
    .serif, h1, h2, h3, .lede, blockquote { font-family: 'Newsreader Variable', Georgia, serif; }
    .eyebrow { display: flex; gap: 10px; align-items: center; font-size: 7.5pt; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: #6E6E78; }
    .eyebrow b { color: #4338CA; } .eyebrow i { flex: 1; height: 1px; background: #E2E2E7; } .eyebrow .id { font-family: ui-monospace, Menlo, monospace; letter-spacing: 0; text-transform: none; }
    h1 { font-size: 28pt; font-weight: 500; line-height: 1.1; color: #111114; margin: 14px 0 0; letter-spacing: -0.01em; }
    .byline { display: flex; gap: 26px; margin: 16px 0 22px; padding: 8px 0; border-top: 1px solid #111114; border-bottom: 1px solid #E2E2E7; font-size: 8.5pt; color: #111114; }
    .byline small { display: block; font-size: 6.5pt; letter-spacing: .1em; text-transform: uppercase; color: #6E6E78; font-weight: 600; }
    main > p:first-child { font-family: 'Newsreader Variable', Georgia, serif; font-size: 13.5pt; line-height: 1.5; color: #111114; }
    h2 { position: relative; font-size: 15pt; font-weight: 600; color: #111114; margin: 22px 0 8px 0; padding-top: 7px; border-top: 1px solid #E2E2E7; break-after: avoid; }
    h2::before { counter-increment: part; content: counter(part, decimal-leading-zero) "  "; color: #A0A0AA; font-weight: 500; font-size: 10pt; }
    h3 { font-size: 12pt; color: #111114; margin: 14px 0 4px; }
    main > h1 { font-size: 20pt; }
    p { margin: 0 0 7px; }
    ul, ol { margin: 0 0 8px; padding-left: 20px; }
    ol > li::marker { font-family: ui-monospace, Menlo, monospace; color: #4338CA; font-size: 9pt; }
    ul[data-type="taskList"] { list-style: none; padding-left: 2px; }
    ul[data-type="taskList"] li { display: flex; gap: 8px; }
    ul[data-type="taskList"] li > label input { accent-color: #111114; }
    ul[data-type="taskList"] li[data-checked="true"] > div { text-decoration: line-through; color: #6E6E78; }
    blockquote { margin: 8px 0; padding-left: 14px; border-left: 2px solid #4338CA; font-style: italic; font-size: 13pt; line-height: 1.45; color: #111114; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 9.5pt; break-inside: auto; }
    th, td { text-align: left; vertical-align: top; padding: 6px 10px 6px 0; border-bottom: 1px solid #E2E2E7; }
    th { font-size: 7pt; letter-spacing: .1em; text-transform: uppercase; color: #6E6E78; border-bottom-color: #111114; font-weight: 600; }
    th p, td p { margin: 0; }
    tr { break-inside: avoid; }
    img { max-width: 100%; border: 1px solid #E2E2E7; margin: 8px 0; break-inside: avoid; }
    mark { padding: 0 1px; }
    pre { background: #F6F6F8; padding: 10px 12px; border-radius: 4px; white-space: pre-wrap; font-size: 8.5pt; }
    code { font-family: ui-monospace, Menlo, monospace; }
    a { color: #4338CA; }
    hr { border: 0; border-top: 1px solid #E2E2E7; margin: 14px 0; }
    .foot { margin-top: 28px; padding-top: 8px; border-top: 1px solid #E2E2E7; display: flex; justify-content: space-between; font-size: 7.5pt; color: #A0A0AA; }
  </style></head><body>
    <div class="eyebrow"><b>${escapeHtml(meta.kind)}</b><span>${escapeHtml(meta.project)}</span><i></i><span class="id">${escapeHtml(meta.id)}</span></div>
    <h1>${escapeHtml(name)}</h1>
    <div class="byline"><div><small>Exporté le</small>${date}</div>${meta.by ? `<div><small>Rédigé par</small>${escapeHtml(meta.by)}</div>` : ''}</div>
    <main>${body}</main>
    <div class="foot"><span>${escapeHtml(meta.project)} · Kollab</span><span>${escapeHtml(meta.id)}</span></div>
  </body></html>`)
  doc.close()
  let done = false
  const go = () => {
    if (done) return
    done = true
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    setTimeout(() => frame.remove(), 60_000)
  }
  // On laisse le temps aux polices de se charger.
  frame.onload = () => void (doc.fonts?.ready ?? Promise.resolve()).then(() => setTimeout(go, 50))
  setTimeout(go, 1500)
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
