import { useEffect, useRef, useState, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { PdfView } from '../components/PdfView'
import { useToast } from '../components/Toast'
import { useStore, useWorkspace } from '../lib/store'
import type { DocumentItem } from '../lib/types'

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
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<DocumentItem | null>(null)
  const [uploading, setUploading] = useState<{ key: number; name: string }[]>([])
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const depth = useRef(0)

  const q = query.trim().toLowerCase()
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

  async function remove(d: DocumentItem) {
    setOpen(null)
    try {
      await backend.removeDocument(d.id)
      await reload()
      toast('Mis à la corbeille')
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
          <p className="muted" style={{ margin: '2px 0 0' }}>{ws.documents.length} fichier{ws.documents.length > 1 ? 's' : ''} partagé{ws.documents.length > 1 ? 's' : ''} avec l'équipe</p>
        </div>
        {canWrite && (
          <button className="btn" onClick={() => input.current?.click()}>
            <Icon name="upload" size={18} /> Ajouter
          </button>
        )}
        <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = '' }} />
      </div>

      <div className="docs-tools">
        <div className="chips" role="radiogroup" aria-label="Type de fichier">
          {FILTERS.filter((f) => f.id === 'all' || counts[f.id]).map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className="chip" onClick={() => setFilter(f.id)}>
              {f.label} <span className="chip-n">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <label className="search">
          <span className="sr-only">Rechercher un document</span>
          <input type="search" placeholder="Rechercher" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {uploading.length > 0 && (
        <div className="docs-uploading" role="status">
          {uploading.map((u) => <span key={u.key} className="upload-chip"><i /> {u.name}</span>)}
        </div>
      )}

      {ws.documents.length === 0 ? (
        <button className="docs-empty" onClick={() => canWrite && input.current?.click()} disabled={!canWrite}>
          <span className="docs-empty-stack" aria-hidden="true">
            <span className="kind-pdf">PDF</span>
            <span className="kind-image">JPG</span>
            <span className="kind-text">MD</span>
          </span>
          <strong>Dépose ici le cahier des charges, les maquettes, les comptes rendus…</strong>
          <span className="muted">{canWrite ? 'Glisse des fichiers sur la page ou clique pour choisir. 25 Mo maximum.' : 'Aucun document pour le moment.'}</span>
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
              <span className="muted">ou glisse-le ici</span>
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
