import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IS_TAURI } from '../lib/base'
import { SITE_URL, openExternal } from '../lib/links'
import { useStore } from '../lib/store'
import { applyTheme, loadThemeChoice, saveThemeChoice, THEMES } from '../lib/themes'
import { checkNow } from '../lib/updates'

const IS_MAC = /Mac/i.test(navigator.userAgent)

/**
 * Barre de menus de l'app Mac, en français, à la place de File / Edit.
 * Reconstruite quand la liste des projets change.
 */
export function DesktopMenu({ onNewProject }: { onNewProject: () => void }) {
  const navigate = useNavigate()
  const { groups, workspace, switchGroup } = useStore()
  const currentId = workspace?.group.id

  useEffect(() => {
    if (!IS_TAURI || !IS_MAC) return
    let cancelled = false
    void (async () => {
      const { Menu, MenuItem, Submenu, PredefinedMenuItem, CheckMenuItem } = await import('@tauri-apps/api/menu')
      const sep = () => PredefinedMenuItem.new({ item: 'Separator' })
      const item = (text: string, action: () => void, accelerator?: string) => MenuItem.new({ text, action, accelerator })
      const go = (path: string) => () => navigate(path)

      const kollab = await Submenu.new({
        text: 'Kollab',
        items: [
          await PredefinedMenuItem.new({ item: { About: { name: 'Kollab' } }, text: 'À propos de Kollab' }),
          await item('Rechercher des mises à jour…', () => void checkNow()),
          await sep(),
          await item('Réglages…', go('/reglages'), 'CmdOrCtrl+,'),
          await sep(),
          await PredefinedMenuItem.new({ item: 'Hide', text: 'Masquer Kollab' }),
          await PredefinedMenuItem.new({ item: 'HideOthers', text: 'Masquer les autres' }),
          await PredefinedMenuItem.new({ item: 'ShowAll', text: 'Tout afficher' }),
          await sep(),
          await PredefinedMenuItem.new({ item: 'Quit', text: 'Quitter Kollab' }),
        ],
      })

      const projects = await Submenu.new({
        text: 'Projet',
        items: [
          await item('Nouveau projet…', onNewProject, 'CmdOrCtrl+Shift+N'),
          await item('Réglages du projet', go('/projet'), 'CmdOrCtrl+Shift+,'),
          await item('Équipe et invitations', go('/equipe')),
          await sep(),
          ...(await Promise.all(
            groups.map((g, i) =>
              CheckMenuItem.new({
                text: g.name,
                checked: g.id === currentId,
                accelerator: i < 9 ? `CmdOrCtrl+Alt+${i + 1}` : undefined,
                action: () => void switchGroup(g.id).then(() => navigate('/')),
              }),
            ),
          )),
        ],
      })

      const tasks = await Submenu.new({
        text: 'Tâches',
        items: [
          await item('Nouvelle tâche', () => {
            navigate('/tableau')
            setTimeout(() => window.dispatchEvent(new Event('kollab:new-task')), 50)
          }, 'CmdOrCtrl+N'),
          await sep(),
          await item('Accueil', go('/'), 'CmdOrCtrl+1'),
          await item('Tableau', go('/tableau'), 'CmdOrCtrl+2'),
          await item('Chat', go('/chat'), 'CmdOrCtrl+3'),
          await item('Équipe', go('/equipe'), 'CmdOrCtrl+4'),
        ],
      })

      const edit = await Submenu.new({
        text: 'Édition',
        items: [
          await PredefinedMenuItem.new({ item: 'Undo', text: 'Annuler' }),
          await PredefinedMenuItem.new({ item: 'Redo', text: 'Rétablir' }),
          await sep(),
          await PredefinedMenuItem.new({ item: 'Cut', text: 'Couper' }),
          await PredefinedMenuItem.new({ item: 'Copy', text: 'Copier' }),
          await PredefinedMenuItem.new({ item: 'Paste', text: 'Coller' }),
          await PredefinedMenuItem.new({ item: 'SelectAll', text: 'Tout sélectionner' }),
        ],
      })

      const setTheme = (id: string) => () => {
        const choice = { ...loadThemeChoice(), id, accent: null, followSystem: false }
        applyTheme(choice)
        saveThemeChoice(choice)
      }
      const view = await Submenu.new({
        text: 'Affichage',
        items: [
          ...(await Promise.all(THEMES.map((t) => item(`Thème ${t.name}`, setTheme(t.id))))),
          await sep(),
          await PredefinedMenuItem.new({ item: 'Fullscreen', text: 'Plein écran' }),
        ],
      })

      const win = await Submenu.new({
        text: 'Fenêtre',
        items: [
          await PredefinedMenuItem.new({ item: 'Minimize', text: 'Réduire' }),
          await PredefinedMenuItem.new({ item: 'Maximize', text: 'Agrandir' }),
          await sep(),
          await PredefinedMenuItem.new({ item: 'CloseWindow', text: 'Fermer la fenêtre' }),
        ],
      })

      const help = await Submenu.new({
        text: 'Aide',
        items: [
          await item('Revoir la visite', () => window.dispatchEvent(new Event('kollab:tour'))),
          ...(SITE_URL ? [await item('Site de Kollab', () => void openExternal(SITE_URL))] : []),
        ],
      })

      const menu = await Menu.new({ items: [kollab, projects, tasks, edit, view, win, help] })
      if (!cancelled) await menu.setAsAppMenu()
    })().catch((e) => console.warn('Menu Mac indisponible', e))
    return () => {
      cancelled = true
    }
  }, [groups, currentId, navigate, onNewProject, switchGroup])

  return null
}
