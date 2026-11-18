import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { boardTasks } from '../lib/sprints'
import { useStore } from '../lib/store'
import { KINDS, STATUSES } from '../lib/types'
import { Avatar } from './Avatar'
import { Icon, type IconName } from './Icon'

type Item = { id: string; group: string; label: string; hint?: string; icon?: IconName; lead?: ReactNode; run: () => void; words: string }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const openSearch = () => window.dispatchEvent(new Event('kollab:search'))

/** Recherche globale (Ctrl+K ou ⌘K) : tâches, documents, fichiers, personnes, salons, pages et actions. */
export function CommandPalette() {
  const { workspace: ws } = useStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('kollab:search', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('kollab:search', onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
    }
  }, [open])

  const items = useMemo<Item[]>(() => {
    if (!ws) return []
    const go = (to: string) => () => navigate(to)
    const onBoard = new Set(boardTasks(ws).map((t) => t.id))
    const out: Item[] = [
      { id: 'a-task', group: 'Actions', label: 'Nouvelle tâche', icon: 'plus', run: () => { navigate('/tableau'); setTimeout(() => window.dispatchEvent(new Event('kollab:new-task')), 50) }, words: 'creer ajouter tache' },
      { id: 'a-note', group: 'Actions', label: 'Nouveau document', icon: 'doc', run: go('/documents?nouveau=1'), words: 'creer ecrire note texte' },
      { id: 'a-poker', group: 'Actions', label: 'Lancer un poker planning', icon: 'cards', run: go('/sprints?poker=1'), words: 'estimer points scrum' },
      { id: 'a-invite', group: 'Actions', label: 'Inviter des membres', icon: 'user', run: () => window.dispatchEvent(new Event('kollab:invite')), words: 'ajouter equipe lien email' },
      { id: 'p-home', group: 'Pages', label: 'Accueil', icon: 'home', run: go('/'), words: 'accueil journee' },
      { id: 'p-board', group: 'Pages', label: 'Tableau', icon: 'board', run: go('/tableau'), words: 'kanban' },
      { id: 'p-sprints', group: 'Pages', label: 'Sprints', icon: 'sprint', run: go('/sprints'), words: 'backlog burndown velocite' },
      { id: 'p-reviews', group: 'Pages', label: 'Revues', icon: 'pr', run: go('/revues'), words: 'pull request github' },
      { id: 'p-chat', group: 'Pages', label: 'Chat', icon: 'chat', run: go('/chat'), words: 'messages' },
      { id: 'p-docs', group: 'Pages', label: 'Documents', icon: 'doc', run: go('/documents'), words: 'fichiers pdf' },
      { id: 'p-team', group: 'Pages', label: 'Équipe', icon: 'group', run: go('/equipe'), words: 'membres' },
      { id: 'p-project', group: 'Pages', label: 'Réglages du projet', icon: 'settings', run: go('/projet'), words: 'parametres github discord corbeille' },
      ...ws.tasks.map((t) => ({
        id: `t-${t.id}`,
        group: 'Tâches',
        label: t.title,
        hint: `${STATUSES.find((s) => s.id === t.status)?.label ?? ''}${t.points != null ? ` · ${t.points} pts` : ''}`,
        icon: 'board' as IconName,
        run: go(onBoard.has(t.id) ? `/tableau?tache=${t.id}` : `/sprints?tache=${t.id}`),
        words: `${t.description} ${KINDS[t.kind]}`,
      })),
      ...ws.notes.map((n) => ({ id: `n-${n.id}`, group: 'Documents', label: n.title, hint: n.preview.split('\n')[0]?.slice(0, 60), icon: 'doc' as IconName, run: go(`/documents?note=${n.id}`), words: n.preview })),
      ...ws.documents.map((d) => ({ id: `d-${d.id}`, group: 'Fichiers', label: d.name, icon: 'upload' as IconName, run: go(`/documents?fichier=${d.id}`), words: d.mime })),
      ...ws.members.map((m) => ({ id: `m-${m.id}`, group: 'Personnes', label: m.name, hint: m.title, lead: <Avatar member={m} size={24} />, run: go('/equipe'), words: m.title })),
      ...ws.channels.map((c) => ({ id: `c-${c.id}`, group: 'Salons', label: `#${c.name}`, icon: 'chat' as IconName, run: go(`/chat?salon=${c.id}`), words: c.name })),
      ...ws.links.map((l) => ({ id: `l-${l.id}`, group: 'Liens', label: l.title, hint: l.url.replace(/^https?:\/\//, ''), icon: 'link' as IconName, run: () => window.open(l.url, '_blank', 'noopener'), words: l.url })),
    ]
    return out
  }, [ws, navigate])

  const results = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean)
    if (!terms.length) return items.filter((i) => i.group === 'Actions' || i.group === 'Pages' || (i.group === 'Tâches' && items.indexOf(i) < 40)).slice(0, 14)
    const scored = items
      .map((i) => {
        const label = norm(i.label)
        const all = `${label} ${norm(i.hint ?? '')} ${norm(i.words)}`
        if (!terms.every((t) => all.includes(t))) return null
        const score = terms.reduce((n, t) => n + (label.startsWith(t) ? 3 : label.includes(t) ? 2 : 1), 0) + (i.group === 'Actions' || i.group === 'Pages' ? 0.5 : 0)
        return { i, score }
      })
      .filter((x): x is { i: Item; score: number } => !!x)
      .sort((a, b) => b.score - a.score)
    return scored.slice(0, 30).map((x) => x.i)
  }, [items, q])

  // Regroupe en gardant l'ordre de pertinence.
  const groups = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const r of results) m.set(r.group, [...(m.get(r.group) ?? []), r])
    return [...m.entries()]
  }, [results])
  const flat = groups.flatMap(([, g]) => g)

  useEffect(() => setSel(0), [q])
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (!open || !ws) return null

  function run(i: Item | undefined) {
    if (!i) return
    setOpen(false)
    i.run()
  }

  return createPortal(
    <div className="cmdk-back" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Rechercher">
        <div className="cmdk-input">
          <Icon name="search" size={20} />
          <input
            autoFocus
            value={q}
            placeholder="Chercher une tâche, un document, une personne…"
            aria-label="Rechercher"
            aria-controls="cmdk-list"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)) }
              else if (e.key === 'Enter') { e.preventDefault(); run(flat[sel]) }
              else if (e.key === 'Escape') setOpen(false)
            }}
          />
          <kbd>Échap</kbd>
        </div>
        <div className="cmdk-list" id="cmdk-list" role="listbox" ref={list}>
          {flat.length === 0 && <p className="cmdk-empty">Rien trouvé pour « {q} ».</p>}
          {groups.map(([g, list]) => (
            <div key={g} className="cmdk-group">
              <span className="cmdk-group-label">{g}</span>
              {list.map((i) => {
                const idx = flat.indexOf(i)
                return (
                  <button key={i.id} role="option" aria-selected={idx === sel} className="cmdk-item" onMouseMove={() => idx !== sel && setSel(idx)} onClick={() => run(i)}>
                    <span className="cmdk-ico">{i.lead ?? (i.icon && <Icon name={i.icon} size={18} />)}</span>
                    <span className="cmdk-label">{i.label}</span>
                    {i.hint && <span className="cmdk-hint">{i.hint}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> choisir</span><span><kbd>Entrée</kbd> ouvrir</span></div>
      </div>
    </div>,
    document.body,
  )
}
