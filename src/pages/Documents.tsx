import { lazy, Suspense, useEffect, useRef, useState, type DragEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { PdfView } from '../components/PdfView'
import { useToast } from '../components/Toast'
import { useStore, useWorkspace } from '../lib/store'
import type { DocumentItem, Note, NoteKind } from '../lib/types'
import { NOTE_KINDS, NOTE_KIND_ORDER } from '../lib/noteKinds'
import { templateTitle } from '../lib/noteTemplates'

// L'éditeur (TipTap + Yjs) n'est chargé qu'à l'ouverture d'un document.
const NoteEditor = lazy(() => import('./NoteEditor'))

const MAX = 25 * 1024 * 1024

type Kind = 'pdf' | 'image' | 'text' | 'other'
const kindOf = (d: DocumentItem): Kind =>
  d.mime === 'application/pdf' || /\.pdf$/i.test(d.name) ? 'pdf' : d.mime.startsWith('image/') ? 'image' : d.mime.startsWith('text/') || /\.(md|txt|csv|json)$/i.test(d.name) ? 'text' : 'other'

const KIND_LABEL: Record<Kind, string> = { pdf: 'PDF', image: 'Image', text: 'Texte', other: 'Fichier' }
const FILTERS: { id: 'all' | Kind; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'pdf', label: 'PDF' },
  { id: 'image', label: 'Images' },
  { id: 'text', label: 'Textes' },
  { id: 'other', label: 'Autres' },
]

const ext = (name: string) => (name.includes('.') ? name.split('.').pop()!.slice(0, 4).toUpperCase() : 'FICHIER')

export function formatSize(n: number) {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
}

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'hier' : `il y a ${d} j`
}

/** Adresse du fichier, demandée une fois et gardée le temps de la page. */
const urlCache = new Map<string, Promise<string>>()
function useDocUrl(doc: DocumentItem | null) {
  const { backend } = useStore()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setUrl(null)
    setError(null)
    if (!doc) return
    let alive = true
    let p = urlCache.get(doc.id)
    if (!p) {
      p = backend.documentUrl(doc)
      urlCache.set(doc.id, p)
      p.catch(() => urlCache.delete(doc.id))
    }
    p.then((u) => alive && setUrl(u)).catch((e) => alive && setError(e instanceof Error ? e.message : 'Fichier introuvable'))
    return () => {
      alive = false
    }
  }, [doc, backend])
  return { url, error }
}

/** Espace documents : déposer, retrouver et lire les fichiers du projet. */
export function Documents() {
  const ws = useWorkspace()
  const { backend, user, reload } = useStore()
  const toast = useToast()
  const me = ws.members.find((m) => m.id === user?.id) ?? (backend.mode === 'demo' ? ws.members[0] : undefined)
  const canWrite = me?.role !== 'guest'
  const [filter, setFilter] = useState<'all' | Kind>('all')
  const [type, setType] = useState<'all' | 'files' | NoteKind>('all')
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<DocumentItem | null>(null)
  const [uploading, setUploading] = useState<{ key: number; name: string }[]>([])
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const depth = useRef(0)

  const q = query.trim().toLowerCase()
  const [params, setParams] = useSearchParams()
  const noteId = params.get('note')
  const openNote = ws.notes.find((n) => n.id === noteId) ?? null
  const setNote = (id: string | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (id) next.set('note', id)
      else next.delete('note')
      return next
    }, { replace: true })
  const notes = ws.notes.filter((n) => (type === 'all' || type === n.kind) && (!q || n.title.toLowerCase().includes(q) || n.preview.toLowerCase().includes(q)))
  const pinned = notes.filter((n) => n.pinned)
  const rest = notes.filter((n) => !n.pinned)
  const kindCounts = NOTE_KIND_ORDER.map((k) => ({ k, n: ws.notes.filter((x) => x.kind === k).length })).filter((x) => x.n > 0)
  const showNotes = type !== 'files'
  const showFiles = type === 'all' || type === 'files'

  // Ouverture depuis la recherche : ?fichier=… ou ?nouveau=1.
  const wantFile = params.get('fichier')
  const wantNew = params.get('nouveau') === '1'
  useEffect(() => {
    if (!wantFile && !wantNew) return
    setParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('fichier')
      next.delete('nouveau')
      return next
    }, { replace: true })
    if (wantFile) setOpen(wantFile)
    if (wantNew && canWrite) setCreating(true)
  }, [wantFile, wantNew]) // eslint-disable-line react-hooks/exhaustive-deps

  async function newNote(kind: NoteKind = 'page') {
    try {
      const n = await backend.createNote(templateTitle(kind), kind)
      await reload()
      setCreating(false)
      setParams((p) => {
        const next = new URLSearchParams(p)
        next.set('note', n.id)
        if (kind !== 'page') next.set('modele', kind)
        return next
      }, { replace: true })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Création impossible')
    }
  }

  const docs = ws.documents.filter((d) => (filter === 'all' || kindOf(d) === filter) && (!q || d.name.toLowerCase().includes(q)))
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, f.id === 'all' ? ws.documents.length : ws.documents.filter((d) => kindOf(d) === f.id).length]))
  const current = open ? docs.find((d) => d.id === open) ?? ws.documents.find((d) => d.id === open) ?? null : null

  async function upload(files: FileList | File[]) {
    if (!canWrite) return
    const list = [...files]
    for (const f of list) {
      if (f.size > MAX) {
        toast(`${f.name} dépasse 25 Mo`)
        continue
      }
      const key = Math.random()
      setUploading((u) => [...u, { key, name: f.name }])
      try {
        await backend.uploadDocument(f)
      } catch (err) {
        toast(err instanceof Error ? err.message : `Envoi de ${f.name} impossible`)
      } finally {
        setUploading((u) => u.filter((x) => x.key !== key))
      }
    }
    await reload()
    if (list.length) toast(list.length > 1 ? `${list.length} fichiers ajoutés` : 'Fichier ajouté')
  }

  async function togglePin(n: Note) {
    try {
      await backend.saveNote(n.id, { pinned: !n.pinned })
      await reload()
      toast(n.pinned ? 'Retiré des épinglés' : 'Épinglé pour toute l\'équipe')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action impossible')
    }
  }

  async function remove(d: DocumentItem) {
    setOpen(null)
    try {
      await backend.removeDocument(d.id)
      await reload()
      toast('Mis à la corbeille', { label: 'Annuler', run: async () => { await backend.restoreItem('document', d.id); await reload() } })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Suppression impossible')
    }
  }

  const dragProps = canWrite
    ? {
        onDragEnter: (e: DragEvent) => {
          if (!e.dataTransfer.types.includes('Files')) return
          depth.current++
          setDragging(true)
        },
        onDragLeave: () => {
          depth.current = Math.max(0, depth.current - 1)
          if (!depth.current) setDragging(false)
        },
        onDragOver: (e: DragEvent) => e.preventDefault(),
        onDrop: (e: DragEvent) => {
          e.preventDefault()
          depth.current = 0
          setDragging(false)
          if (e.dataTransfer.files.length) void upload(e.dataTransfer.files)
        },
      }
    : {}

  return (
    <div className={`page docs-page${dragging ? ' is-dragging' : ''}`} {...dragProps}>
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <p className="muted" style={{ margin: '2px 0 0' }}>{ws.notes.length} document{ws.notes.length > 1 ? 's' : ''} · {ws.documents.length} fichier{ws.documents.length > 1 ? 's' : ''}</p>
        </div>
        {canWrite && (
          <div className="actions">
            <button className="btn soft" onClick={() => input.current?.click()}>
              <Icon name="upload" size={18} /> Ajouter un fichier
            </button>
            <button className="btn" onClick={() => setCreating(true)}>
              <Icon name="plus" size={18} /> Nouveau document
            </button>
          </div>
        )}
        <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = '' }} />
      </div>

      <div className="docs-tools">
        <div className="chips" role="radiogroup" aria-label="Type">
          <button type="button" role="radio" aria-checked={type === 'all'} className="chip" onClick={() => setType('all')}>Tout <span className="chip-n">{ws.notes.length + ws.documents.length}</span></button>
          {kindCounts.map(({ k, n }) => (
            <button key={k} type="button" role="radio" aria-checked={type === k} className="chip nk-chip" style={{ ['--nk' as string]: NOTE_KINDS[k].color }} onClick={() => setType(type === k ? 'all' : k)}>
              <i aria-hidden="true" />{NOTE_KINDS[k].plural} <span className="chip-n">{n}</span>
            </button>
          ))}
          {ws.documents.length > 0 && (
            <button type="button" role="radio" aria-checked={type === 'files'} className="chip" onClick={() => setType(type === 'files' ? 'all' : 'files')}>Fichiers <span className="chip-n">{ws.documents.length}</span></button>
          )}
        </div>
        <label className="search">
          <span className="sr-only">Rechercher dans les documents et fichiers</span>
          <input type="search" placeholder="Rechercher" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {showNotes && pinned.length > 0 && (
        <section className="notes-section">
          <h2 className="docs-sec">Épinglés</h2>
          <div className="nk-grid">
            {pinned.map((n) => <NoteCard key={n.id} note={n} canWrite={canWrite} onOpen={() => setNote(n.id)} onPin={() => void togglePin(n)} />)}
          </div>
        </section>
      )}

      {showNotes && (
        <section className="notes-section">
          <h2 className="docs-sec">{pinned.length ? 'Les autres' : 'Écrits ensemble'}</h2>
          {rest.length === 0 && !canWrite && <p className="hint">{q || type !== 'all' ? 'Aucun document ne correspond.' : 'Aucun document pour le moment.'}</p>}
          <div className="nk-list">
            {rest.map((n) => <NoteRow key={n.id} note={n} canWrite={canWrite} onOpen={() => setNote(n.id)} onPin={() => void togglePin(n)} />)}
            {canWrite && (
              <button className="nk-row nk-add" onClick={() => setCreating(true)}>
                <span className="invite-plus"><Icon name="plus" size={18} /></span>
                <b>Nouveau document</b>
                <span className="muted">Compte rendu, daily, spec, rétro…</span>
              </button>
            )}
          </div>
        </section>
      )}

      {showFiles && <h2 className="docs-sec files-title">Fichiers</h2>}
      {showFiles && ws.documents.length > 1 && (
        <div className="chips docs-file-chips" role="radiogroup" aria-label="Type de fichier">
          {FILTERS.filter((f) => f.id === 'all' || counts[f.id]).map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className="chip small" onClick={() => setFilter(f.id)}>
              {f.label} <span className="chip-n">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      )}

      {uploading.length > 0 && (
        <div className="docs-uploading" role="status">
          {uploading.map((u) => <span key={u.key} className="upload-chip"><i /> {u.name}</span>)}
        </div>
      )}

      {!showFiles ? null : ws.documents.length === 0 ? (
        <button className="docs-empty" onClick={() => canWrite && input.current?.click()} disabled={!canWrite}>
          <span className="docs-empty-stack" aria-hidden="true">
            <span className="kind-pdf">PDF</span>
            <span className="kind-image">JPG</span>
            <span className="kind-text">MD</span>
          </span>
          <strong><span className="hide-phone">Dépose ici le cahier des charges, les maquettes, les PDF…</span><span className="show-phone">Ajoute le cahier des charges, les maquettes, les PDF…</span></strong>
          <span className="muted">{canWrite ? <><span className="hide-phone">Glisse des fichiers sur la page ou clique pour choisir. </span><span className="show-phone">Touche pour choisir un fichier. </span>25 Mo maximum.</> : 'Aucun document pour le moment.'}</span>
        </button>
      ) : docs.length === 0 ? (
        <p className="hint">Aucun document ne correspond.</p>
      ) : (
        <div className="docs-grid">
          {docs.map((d) => (
            <DocCard key={d.id} doc={d} onOpen={() => setOpen(d.id)} />
          ))}
          {canWrite && (
            <button className="doc-card doc-add" onClick={() => input.current?.click()}>
              <span className="invite-plus"><Icon name="plus" size={26} /></span>
              <strong>Ajouter un fichier</strong>
              <span className="muted hide-phone">ou glisse-le ici</span>
            </button>
          )}
        </div>
      )}

      {dragging && (
        <div className="docs-drop" aria-hidden="true">
          <div><Icon name="upload" size={34} /><strong>Dépose pour partager avec l'équipe</strong></div>
        </div>
      )}

      {current && (
        <Viewer
          doc={current}
          list={docs.length ? docs : ws.documents}
          canWrite={canWrite}
          onNavigate={setOpen}
          onClose={() => setOpen(null)}
          onRename={() => setRenaming(current)}
          onRemove={() => void remove(current)}
        />
      )}

      {openNote && (
        <Suspense fallback={null}>
          <NoteEditor key={openNote.id} note={openNote} template={(params.get('modele') as NoteKind | null) ?? undefined} onClose={() => setParams((p) => {
            const next = new URLSearchParams(p)
            next.delete('note')
            next.delete('modele')
            return next
          }, { replace: true })} />
        </Suspense>
      )}

      {creating && <NewNoteDialog onPick={(k) => void newNote(k)} onClose={() => setCreating(false)} />}

      {renaming && (
        <RenameDialog
          doc={renaming}
          onClose={() => setRenaming(null)}
          onSave={async (name) => {
            await backend.renameDocument(renaming.id, name)
            await reload()
            setRenaming(null)
            toast('Renommé')
          }}
        />
      )}
    </div>
  )
}

function NoteMeta({ note }: { note: Note }) {
  const ws = useWorkspace()
  const who = ws.members.find((m) => m.id === (note.updatedBy ?? note.createdBy))
  return (
    <span className="doc-meta">
      {who && <Avatar member={who} size={18} />}
      <span className="muted">{who ? `${who.name.split(' ')[0]} · ` : ''}{ago(note.updatedAt)}</span>
    </span>
  )
}

function PinButton({ note, onPin }: { note: Note; onPin: () => void }) {
  return (
    <span role="button" tabIndex={0} className={`nk-pin${note.pinned ? ' on' : ''}`} title={note.pinned ? 'Retirer des épinglés' : 'Épingler pour l\'équipe'} aria-label={note.pinned ? 'Retirer des épinglés' : 'Épingler'}
      onClick={(e) => { e.stopPropagation(); onPin() }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onPin() } }}>
      <Icon name="pin" size={16} />
    </span>
  )
}

/** Document épinglé : grande carte avec un bandeau de la couleur de son type. */
function NoteCard({ note, canWrite, onOpen, onPin }: { note: Note; canWrite: boolean; onOpen: () => void; onPin: () => void }) {
  const k = NOTE_KINDS[note.kind]
  const lines = note.preview.split('\n').filter(Boolean).slice(0, 3)
  return (
    <button className="nk-card appear" style={{ ['--nk' as string]: k.color }} onClick={onOpen}>
      <span className="nk-band">
        <small>{k.label}</small>
        <b title={note.title}>{note.title}</b>
        {canWrite && <PinButton note={note} onPin={onPin} />}
      </span>
      <span className="nk-body">
        <span className="nk-lines">{lines.length ? lines.map((l, i) => <span key={i}>{l}</span>) : <span className="muted">Vide pour l'instant</span>}</span>
        <NoteMeta note={note} />
      </span>
    </button>
  )
}

/** Document dans la liste : trait de couleur, titre, type, dernière modification. */
function NoteRow({ note, canWrite, onOpen, onPin }: { note: Note; canWrite: boolean; onOpen: () => void; onPin: () => void }) {
  const k = NOTE_KINDS[note.kind]
  return (
    <button className="nk-row appear" style={{ ['--nk' as string]: k.color }} onClick={onOpen}>
      <i className="nk-bar" aria-hidden="true" />
      <span className="nk-row-main">
        <b>{note.title}</b>
        <span className="nk-row-sub">{note.preview.split('\n').find((l) => l.trim() && l.trim() !== note.title) ?? ''}</span>
      </span>
      <span className="nk-kind">{k.label}</span>
      <NoteMeta note={note} />
      {canWrite && <PinButton note={note} onPin={onPin} />}
    </button>
  )
}

const CREATE_LABEL: Record<NoteKind, string> = {
  cr: 'Créer le compte rendu', daily: 'Créer le daily', spec: 'Créer la spec', retro: 'Créer la rétro', cdc: 'Créer le cahier des charges', idee: 'Créer la page d\'idées', page: 'Créer la page',
}

/** Fenêtre au centre : choisir le type, le document s'ouvre déjà rempli. */
function NewNoteDialog({ onPick, onClose }: { onPick: (k: NoteKind) => void; onClose: () => void }) {
  const [kind, setKind] = useState<NoteKind>('cr')
  const [busy, setBusy] = useState(false)
  return (
    <Modal title="Nouveau document" onClose={onClose} wide>
      <div className="nk-new">
        <div className="nk-tpls" role="radiogroup" aria-label="Modèle">
          {NOTE_KIND_ORDER.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={kind === id} className={`nk-tpl${kind === id ? ' on' : ''}`} style={{ ['--nk' as string]: NOTE_KINDS[id].color }} onClick={() => setKind(id)} onDoubleClick={() => onPick(id)}>
              <span className="nk-mini" aria-hidden="true"><i /><i /><i /><i /></span>
              <b>{NOTE_KINDS[id].label}</b>
              <span>{NOTE_KINDS[id].hint}</span>
            </button>
          ))}
        </div>
        {kind !== 'page' && kind !== 'idee' && (
          <p className="nk-prefill"><b>Déjà rempli pour toi</b>{kind === 'daily' ? 'Ce que chacun a fini et a en cours dans le sprint.' : kind === 'cr' ? 'Date du jour, membres en ligne comme présents, sprint en cours.' : kind === 'retro' ? 'Le sprint, et les actions deviennent des tâches.' : 'Les rubriques à remplir.'}</p>
        )}
        <div className="prompt-foot">
          <button type="button" className="btn soft" onClick={onClose}>Annuler</button>
          <button type="button" className="btn" disabled={busy} onClick={() => { setBusy(true); onPick(kind) }}>{CREATE_LABEL[kind]}</button>
        </div>
      </div>
    </Modal>
  )
}

function DocCard({ doc, onOpen }: { doc: DocumentItem; onOpen: () => void }) {
  const ws = useWorkspace()
  const kind = kindOf(doc)
  const { url } = useDocUrl(kind === 'image' ? doc : null)
  const who = ws.members.find((m) => m.id === doc.uploadedBy)
  return (
    <button className={`doc-card appear kind-${kind}`} onClick={onOpen}>
      <span className="doc-preview">
        {kind === 'image' && url ? (
          <img src={url} alt="" loading="lazy" />
        ) : kind === 'pdf' ? (
          <span className="doc-sheet"><b>{ext(doc.name)}</b><i /><i /><i /><i /></span>
        ) : (
          <span className="doc-ext">{ext(doc.name)}</span>
        )}
      </span>
      <span className="doc-info">
        <strong title={doc.name}>{doc.name}</strong>
        <span className="doc-meta">
          {who && <Avatar member={who} size={18} />}
          <span className="muted">{KIND_LABEL[kind]} · {formatSize(doc.size)} · {ago(doc.createdAt)}</span>
        </span>
      </span>
    </button>
  )
}

/** Lecture plein écran ; flèches pour passer d'un fichier à l'autre. */
function Viewer({ doc, list, canWrite, onNavigate, onClose, onRename, onRemove }: {
  doc: DocumentItem
  list: DocumentItem[]
  canWrite: boolean
  onNavigate: (id: string) => void
  onClose: () => void
  onRename: () => void
  onRemove: () => void
}) {
  const ws = useWorkspace()
  const kind = kindOf(doc)
  const { url, error } = useDocUrl(doc)
  const [text, setText] = useState<string | null>(null)
  const i = list.findIndex((d) => d.id === doc.id)
  const prev = i > 0 ? list[i - 1] : null
  const next = i >= 0 && i < list.length - 1 ? list[i + 1] : null
  const who = ws.members.find((m) => m.id === doc.uploadedBy)

  useEffect(() => {
    setText(null)
    if (kind !== 'text' || !url) return
    let alive = true
    fetch(url).then((r) => r.text()).then((t) => alive && setText(t.slice(0, 200_000))).catch(() => alive && setText(''))
    return () => {
      alive = false
    }
  }, [url, kind])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && prev) onNavigate(prev.id)
      if (e.key === 'ArrowRight' && next) onNavigate(next.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onClose, onNavigate])

  return createPortal(
    <div className="viewer-back" role="dialog" aria-modal="true" aria-label={doc.name}>
      <header className="viewer-top">
        <span className={`viewer-kind kind-${kind}`}>{ext(doc.name)}</span>
        <div className="viewer-title">
          <strong>{doc.name}</strong>
          <span>{who ? `${who.name} · ` : ''}{formatSize(doc.size)} · {ago(doc.createdAt)}</span>
        </div>
        <div className="viewer-actions">
          {canWrite && <button className="viewer-btn" onClick={onRename}>Renommer</button>}
          {url && <a className="viewer-btn" href={url} download={doc.name} target="_blank" rel="noreferrer"><Icon name="download" size={18} /><span>Télécharger</span></a>}
          {canWrite && <button className="viewer-btn icon" aria-label="Mettre à la corbeille" title="Mettre à la corbeille" onClick={onRemove}><Icon name="trash" size={18} /></button>}
          <button className="viewer-btn icon" aria-label="Fermer" onClick={onClose}><Icon name="close" size={20} /></button>
        </div>
      </header>

      <div className="viewer-stage" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        {prev && <button className="viewer-nav left" aria-label="Fichier précédent" onClick={() => onNavigate(prev.id)}><Icon name="chevron" size={24} /></button>}
        {error ? (
          <div className="viewer-empty"><strong>Aperçu indisponible</strong><span>{error}</span></div>
        ) : !url ? (
          <div className="viewer-empty"><span className="spinner" /></div>
        ) : kind === 'pdf' ? (
          <PdfView key={doc.id} url={url} />
        ) : kind === 'image' ? (
          <img className="viewer-img" src={url} alt={doc.name} />
        ) : kind === 'text' ? (
          <pre className="viewer-text">{text ?? '…'}</pre>
        ) : (
          <div className="viewer-empty">
            <span className="doc-ext big">{ext(doc.name)}</span>
            <strong>Pas d'aperçu pour ce type de fichier</strong>
            <a className="btn" href={url} download={doc.name} target="_blank" rel="noreferrer"><Icon name="download" size={18} /> Télécharger</a>
          </div>
        )}
        {next && <button className="viewer-nav right" aria-label="Fichier suivant" onClick={() => onNavigate(next.id)}><Icon name="chevron" size={24} /></button>}
      </div>
      {list.length > 1 && <div className="viewer-count">{i + 1} / {list.length}</div>}
    </div>,
    document.body,
  )
}

function RenameDialog({ doc, onClose, onSave }: { doc: DocumentItem; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(doc.name)
  const [busy, setBusy] = useState(false)
  const ok = name.trim().length > 0 && name.trim() !== doc.name
  async function save() {
    if (!ok) return
    setBusy(true)
    try {
      await onSave(name)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title="Renommer"
      onClose={onClose}
      footer={<><button className="btn soft" onClick={onClose}>Annuler</button><button className="btn" disabled={!ok || busy} onClick={() => void save()}>Enregistrer</button></>}
    >
      <input className="input" autoFocus value={name} aria-label="Nom du fichier" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} onFocus={(e) => e.target.setSelectionRange(0, name.lastIndexOf('.') > 0 ? name.lastIndexOf('.') : name.length)} />
    </Modal>
  )
}
