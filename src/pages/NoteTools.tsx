import { useEditorState, type Editor } from '@tiptap/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { PromptDialog } from '../components/PromptDialog'
import { useToast } from '../components/Toast'

/** Couleurs de texte et de surlignage proposées : peu nombreuses, lisibles sur fond blanc et sombre. */
const COLORS = [
  { name: 'Encre', value: null },
  { name: 'Gris', value: '#6E6E78' },
  { name: 'Indigo', value: '#4338CA' },
  { name: 'Bleu', value: '#1D4ED8' },
  { name: 'Vert', value: '#166534' },
  { name: 'Ambre', value: '#B45309' },
  { name: 'Rouge', value: '#B91C1C' },
]
const MARKS = [
  { name: 'Jaune', value: '#FDE68A' },
  { name: 'Vert', value: '#BBF7D0' },
  { name: 'Bleu', value: '#BFDBFE' },
  { name: 'Rose', value: '#FBCFE8' },
]

/** Image collée ou choisie : réduite (1600 px, JPEG) puis gardée dans le document. */
export async function imageToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Ce fichier n\'est pas une image')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const png = file.type === 'image/png' && canvas.width * canvas.height < 600 * 600
  const url = canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.82)
  if (url.length > 1_800_000) throw new Error('Image trop lourde, même réduite')
  return url
}

function useImagePicker(editor: Editor) {
  const toast = useToast()
  const input = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    const el = document.createElement('input')
    el.type = 'file'
    el.accept = 'image/*'
    el.onchange = async () => {
      const f = el.files?.[0]
      el.value = ''
      if (!f) return
      try {
        editor.chain().focus().setImage({ src: await imageToDataUrl(f), alt: f.name.replace(/\.[^.]+$/, '') }).run()
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Image impossible à ajouter')
      }
    }
    el.hidden = true
    document.body.appendChild(el)
    input.current = el
    return () => el.remove()
  }, [editor, toast])
  return () => input.current?.click()
}

const STYLES = [
  { id: 'p', label: 'Texte' },
  { id: 'h1', label: 'Titre 1' },
  { id: 'h2', label: 'Titre 2' },
  { id: 'h3', label: 'Titre 3' },
] as const

/** Barre d'outils du document : styles, mise en forme, insertion, et une barre de tableau quand on est dedans. */
export function NoteToolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      style: e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      under: e.isActive('underline'),
      strike: e.isActive('strike'),
      mark: e.isActive('highlight'),
      color: (e.getAttributes('textStyle').color as string | undefined) ?? null,
      align: e.isActive({ textAlign: 'center' }) ? 'center' : e.isActive({ textAlign: 'right' }) ? 'right' : 'left',
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      check: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      code: e.isActive('codeBlock'),
      link: e.isActive('link'),
      table: e.isActive('table'),
      header: e.isActive('tableHeader'),
    }),
  })
  const c = () => editor.chain().focus()
  const [linking, setLinking] = useState(false)
  const [coloring, setColoring] = useState(false)
  const pickImage = useImagePicker(editor)

  const b = (label: string, on: boolean, run: () => void, content: ReactNode, cls = '') => (
    <button type="button" className={`tb${on ? ' on' : ''}${cls ? ` ${cls}` : ''}`} aria-label={label} title={label} aria-pressed={on} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      {content}
    </button>
  )
  function setStyle(id: string) {
    if (id === 'p') c().setParagraph().run()
    else c().setHeading({ level: Number(id.slice(1)) as 1 | 2 | 3 }).run()
  }
  const nextAlign = s.align === 'left' ? 'center' : s.align === 'center' ? 'right' : 'left'

  return (
    <div className="note-tools">
      <div className="note-toolbar" role="toolbar" aria-label="Mise en forme">
        <label className="tb-select">
          <span className="sr-only">Style</span>
          <select value={s.style} onChange={(e) => setStyle(e.target.value)}>
            {STYLES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
        <span className="tb-sep" />
        {b('Gras', s.bold, () => c().toggleBold().run(), <b>G</b>)}
        {b('Italique', s.italic, () => c().toggleItalic().run(), <i className="tb-it">I</i>)}
        {b('Souligné', s.under, () => c().toggleUnderline().run(), <u>S</u>)}
        {b('Barré', s.strike, () => c().toggleStrike().run(), <s>B</s>)}
        {b('Surligner', s.mark, () => c().toggleHighlight({ color: MARKS[0].value }).run(), <span className="tb-mark">Surligner</span>)}
        {b('Couleur du texte', !!s.color, () => setColoring(true), <span className="tb-color"><span style={{ background: s.color ?? 'currentColor' }} />Couleur</span>)}
        <span className="tb-sep" />
        {b(`Aligner ${s.align === 'left' ? 'à gauche' : s.align === 'center' ? 'au centre' : 'à droite'}`, s.align !== 'left', () => c().setTextAlign(nextAlign).run(), <span className={`tb-align ${s.align}`} aria-hidden="true"><i /><i /><i /></span>)}
        {b('Liste', s.bullet, () => c().toggleBulletList().run(), <span>• Liste</span>)}
        {b('Liste numérotée', s.ordered, () => c().toggleOrderedList().run(), <span>1. Liste</span>)}
        {b('Cases à cocher', s.check, () => c().toggleTaskList().run(), <><Icon name="check" size={15} /> À faire</>)}
        {b('Citation', s.quote, () => c().toggleBlockquote().run(), <span>« Citation »</span>)}
        {b('Bloc de code', s.code, () => c().toggleCodeBlock().run(), <code>{'</>'}</code>)}
        <span className="tb-sep" />
        {b('Tableau', s.table, () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), <span>Tableau</span>)}
        {b('Image', false, pickImage, <span>Image</span>)}
        {b('Lien', s.link, () => { if (s.link) c().unsetLink().run(); else setLinking(true) }, <><Icon name="link" size={15} /> Lien</>)}
        {b('Séparateur', false, () => c().setHorizontalRule().run(), <span>—</span>)}
        <span className="tb-sep" />
        {b('Annuler', false, () => c().undo().run(), <span>↶</span>)}
        {b('Rétablir', false, () => c().redo().run(), <span>↷</span>)}
      </div>

      {s.table && (
        <div className="note-tablebar" role="toolbar" aria-label="Tableau">
          <span className="tbb-label">Tableau</span>
          {b('Ajouter une ligne', false, () => c().addRowAfter().run(), <span>+ Ligne</span>)}
          {b('Ajouter une colonne', false, () => c().addColumnAfter().run(), <span>+ Colonne</span>)}
          {b('Supprimer la ligne', false, () => c().deleteRow().run(), <span>− Ligne</span>)}
          {b('Supprimer la colonne', false, () => c().deleteColumn().run(), <span>− Colonne</span>)}
          {b('Fusionner ou séparer les cellules', false, () => c().mergeOrSplit().run(), <span>Fusionner</span>)}
          {b('Ligne d\'en-tête', s.header, () => c().toggleHeaderRow().run(), <span>En-tête</span>)}
          {b('Supprimer le tableau', false, () => c().deleteTable().run(), <span>Supprimer le tableau</span>, 'danger')}
        </div>
      )}

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

      {coloring && (
        <Modal title="Couleur" onClose={() => setColoring(false)}>
          <div className="color-pick">
            <span className="color-pick-label">Texte</span>
            <div className="color-row">
              {COLORS.map((x) => (
                <button key={x.name} type="button" className={`swatch${(s.color ?? null) === x.value ? ' on' : ''}`} onClick={() => { if (x.value) c().setColor(x.value).run(); else c().unsetColor().run(); setColoring(false) }}>
                  <span style={{ color: x.value ?? 'var(--text)' }}>Aa</span>{x.name}
                </button>
              ))}
            </div>
            <span className="color-pick-label">Surlignage</span>
            <div className="color-row">
              {MARKS.map((x) => (
                <button key={x.name} type="button" className="swatch" onClick={() => { c().setHighlight({ color: x.value }).run(); setColoring(false) }}>
                  <span style={{ background: x.value, color: '#111114' }}>Aa</span>{x.name}
                </button>
              ))}
              <button type="button" className="swatch" onClick={() => { c().unsetHighlight().run(); setColoring(false) }}><span>Aa</span>Aucun</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

type SlashItem = { id: string; label: string; hint: string; words: string; run: (e: Editor) => void }

const SLASH: SlashItem[] = [
  { id: 'h1', label: 'Titre 1', hint: 'Grand titre', words: 'titre h1 heading', run: (e) => e.chain().focus().setHeading({ level: 1 }).run() },
  { id: 'h2', label: 'Titre 2', hint: 'Partie numérotée', words: 'titre h2 partie section', run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { id: 'h3', label: 'Titre 3', hint: 'Sous-partie', words: 'titre h3 sous', run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  { id: 'table', label: 'Tableau', hint: '3 × 3 avec en-tête', words: 'tableau table grille', run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: 'todo', label: 'À faire', hint: 'Cases à cocher, deviennent des tâches', words: 'faire todo tache case cocher action', run: (e) => e.chain().focus().toggleTaskList().run() },
  { id: 'ul', label: 'Liste', hint: 'Liste à puces', words: 'liste puces ul', run: (e) => e.chain().focus().toggleBulletList().run() },
  { id: 'ol', label: 'Liste numérotée', hint: '1, 2, 3', words: 'liste numerotee ol nombre', run: (e) => e.chain().focus().toggleOrderedList().run() },
  { id: 'quote', label: 'Citation', hint: 'Mise en avant', words: 'citation quote', run: (e) => e.chain().focus().toggleBlockquote().run() },
  { id: 'code', label: 'Code', hint: 'Bloc de code', words: 'code bloc', run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { id: 'hr', label: 'Séparateur', hint: 'Trait horizontal', words: 'separateur trait ligne hr', run: (e) => e.chain().focus().setHorizontalRule().run() },
  { id: 'image', label: 'Image', hint: 'Depuis un fichier', words: 'image photo capture', run: () => window.dispatchEvent(new Event('kollab:note-image')) },
]

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Menu « / » : taper / en début de ligne propose les blocs à insérer, au clavier ou au clic. */
export function NoteSlash({ editor }: { editor: Editor }) {
  const [state, setState] = useState<{ from: number; query: string; x: number; y: number } | null>(null)
  const [active, setActive] = useState(0)
  const pickImage = useImagePicker(editor)
  const items = state ? SLASH.filter((i) => !state.query || norm(`${i.label} ${i.words}`).includes(norm(state.query))) : []
  const ref = useRef({ state, items, active })
  ref.current = { state, items, active }

  useEffect(() => {
    const onImage = () => pickImage()
    window.addEventListener('kollab:note-image', onImage)
    return () => window.removeEventListener('kollab:note-image', onImage)
  }, [pickImage])

  useEffect(() => {
    const update = () => {
      const { $from, empty } = editor.state.selection
      if (!empty || !$from.parent.isTextblock || $from.parent.type.name === 'codeBlock') return setState(null)
      const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼')
      const m = before.match(/^\/([\p{L}\d]{0,20})$/u)
      if (!m) return setState(null)
      const at = editor.view.coordsAtPos($from.pos)
      setState((old) => {
        if (!old || old.query !== m[1]) setActive(0)
        return { from: $from.pos - before.length, query: m[1], x: at.left, y: at.bottom }
      })
    }
    editor.on('selectionUpdate', update)
    editor.on('update', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('update', update)
    }
  }, [editor])

  function choose(item: SlashItem) {
    const st = ref.current.state
    if (!st) return
    editor.chain().focus().deleteRange({ from: st.from, to: editor.state.selection.from }).run()
    item.run(editor)
    setState(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { state: st, items: list, active: i } = ref.current
      if (!st || !list.length) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i + 1) % list.length) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i - 1 + list.length) % list.length) }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); choose(list[i]) }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setState(null) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [editor]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!state || !items.length) return null
  const left = Math.min(state.x, window.innerWidth - 300)
  const below = state.y + 340 < window.innerHeight
  return createPortal(
    <div className="slash-menu" role="listbox" aria-label="Insérer" style={below ? { left, top: state.y + 6 } : { left, bottom: window.innerHeight - state.y + 28 }}>
      <span className="slash-head">Insérer</span>
      {items.map((it, i) => (
        <button key={it.id} type="button" role="option" aria-selected={i === active} className={i === active ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => choose(it)}>
          <b>{it.label}</b>
          <span>{it.hint}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
