import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import {
  allThemes, applyTheme, applyThemeObject, deleteCustomTheme, loadThemeChoice, makeTheme, saveCustomTheme, saveThemeChoice, THEMES,
  type Theme, type ThemeChoice,
} from '../lib/themes'

const ACCENTS = ['#5546E0', '#2F6FD0', '#0F7A63', '#D9822B', '#C2413A', '#9B3FB8', '#D6457A', '#2E7D4F', '#14142B']

type Draft = { id: string | null; name: string; bg: string; surface: string; text: string; accent: string }
const BLANK: Draft = { id: null, name: '', bg: '#F5F6FA', surface: '#FFFFFF', text: '#14142B', accent: '#5546E0' }
const FIELDS: [keyof Omit<Draft, 'id' | 'name'>, string][] = [['bg', 'Fond'], ['surface', 'Cartes'], ['text', 'Texte'], ['accent', 'Accent']]

/** Thèmes prêts à l'emploi, thèmes créés par l'utilisateur et éditeur avec aperçu en direct. */
export function AppearanceCard() {
  const [choice, setChoice] = useState<ThemeChoice>(loadThemeChoice)
  const [themes, setThemes] = useState<Theme[]>(allThemes)
  const [draft, setDraft] = useState<Draft | null>(null)

  useEffect(() => {
    if (draft) return
    applyTheme(choice)
    saveThemeChoice(choice)
  }, [choice, draft])

  // Aperçu en direct pendant l'édition ; on revient au thème choisi en annulant.
  useEffect(() => {
    if (draft) applyThemeObject(makeTheme('apercu', draft.name, draft))
  }, [draft])

  const pick = (id: string) => setChoice({ ...choice, id, accent: null, followSystem: false })


  function save() {
    if (!draft) return
    const id = draft.id ?? `perso-${Date.now().toString(36)}`
    saveCustomTheme(makeTheme(id, draft.name.trim() || 'Mon thème', draft))
    setThemes(allThemes())
    setDraft(null)
    pick(id)
  }

  function remove(id: string) {
    deleteCustomTheme(id)
    setThemes(allThemes())
    if (choice.id === id) pick('indigo')
  }

  const edit = (t: Theme) => setDraft({ id: t.id, name: t.name, bg: t.bg, surface: t.surface, text: t.text, accent: t.accent })
  const isCustom = (t: Theme) => !THEMES.some((x) => x.id === t.id)

  const accentNow = choice.accent ?? themes.find((t) => t.id === choice.id)?.accent ?? '#5546E0'
  const dark = themes.find((t) => t.id === choice.id)?.dark
  const bgMode = choice.followSystem ? 'auto' : dark ? 'sombre' : 'clair'
  const custom = !ACCENTS.includes(accentNow.toUpperCase())

  return (
    <section className="card">
      <div className="ap-preview" style={{ ['--a' as string]: accentNow }}>
        <span className="muted">Aperçu</span>
        <div><b className="ap-btn">Créer la tâche</b><b className="ap-btn soft">Annuler</b></div>
        <div className="ap-bar"><i /><i /></div>
      </div>
      <div className="ap-group">
        <b>Couleur principale</b>
        <div className="ap-colors" role="radiogroup" aria-label="Couleur principale">
          {ACCENTS.map((c) => (
            <button key={c} role="radio" aria-checked={accentNow.toUpperCase() === c} aria-label={c} style={{ ['--c' as string]: c }} onClick={() => !draft && setChoice({ ...choice, accent: c })} />
          ))}
          <label className={`ap-custom${custom ? ' on' : ''}`} style={custom ? { ['--c' as string]: accentNow } : undefined} aria-label="Autre couleur">
            <input type="color" value={accentNow} onChange={(e) => setChoice({ ...choice, accent: e.target.value.toUpperCase() })} />
            {!custom && '+'}
          </label>
        </div>
      </div>
      <div className="ap-group">
        <b>Fond</b>
        <div className="ap-modes" role="radiogroup" aria-label="Fond">
          <button role="radio" aria-checked={bgMode === 'clair'} onClick={() => setChoice({ ...choice, id: dark ? 'indigo' : choice.id, followSystem: false })}>Clair</button>
          <button role="radio" aria-checked={bgMode === 'sombre'} className="dark" onClick={() => setChoice({ ...choice, id: 'nuit', followSystem: false })}>Sombre</button>
          <button role="radio" aria-checked={bgMode === 'auto'} onClick={() => setChoice({ ...choice, id: dark ? 'indigo' : choice.id, followSystem: true })}>Auto</button>
        </div>
      </div>
      <p className="hint" style={{ margin: 0 }}>Ta couleur ne change que chez toi.</p>

      <h2 style={{ marginTop: 8 }}>Plus de thèmes</h2>
      <div className="themes">
        {themes.map((t) => (
          <div key={t.id} className="theme-wrap">
            <button
              className={`theme-btn${choice.id === t.id && !choice.followSystem ? ' selected' : ''}`}
              aria-pressed={choice.id === t.id && !choice.followSystem}
              onClick={() => pick(t.id)}
            >
              <span className="swatch" style={{ background: t.bg }}>
                <i style={{ background: t.accent }} />
                <i style={{ background: t.surface, boxShadow: `inset 0 0 0 1px ${t.line}` }} />
                <i style={{ background: t.text }} />
              </span>
              {t.name}
            </button>
            {isCustom(t) && (
              <span className="theme-tools">
                <button className="icon-btn" aria-label={`Modifier ${t.name}`} onClick={() => edit(t)}><Icon name="palette" size={15} /></button>
                <button className="icon-btn" aria-label={`Supprimer ${t.name}`} onClick={() => remove(t.id)}><Icon name="trash" size={15} /></button>
              </span>
            )}
          </div>
        ))}
        {!draft && (
          <button className="theme-btn theme-new" onClick={() => setDraft({ ...BLANK })}>
            <span className="swatch"><Icon name="plus" size={18} /></span>
            Créer un thème
          </button>
        )}
      </div>

      {draft && (
        <div className="theme-editor">
          <label className="field">
            Nom
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Mon thème" maxLength={30} autoFocus />
          </label>
          <div className="color-fields">
            {FIELDS.map(([k, label]) => (
              <label key={k} className="color-field">
                <input type="color" value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value.toUpperCase() })} />
                <span>{label}<small>{draft[k]}</small></span>
              </label>
            ))}
          </div>
          <p className="hint">Aperçu en direct sur toute l'app.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={save}>Enregistrer</button>
            <button className="btn soft" onClick={() => { setDraft(null); applyTheme(choice) }}>Annuler</button>
          </div>
        </div>
      )}

    </section>
  )
}
