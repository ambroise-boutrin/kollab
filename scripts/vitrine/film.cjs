// Tourne les vidéos du site vitrine à partir de la démo de l'app.
// node scripts/vitrine/film.cjs            → toutes, en français et en anglais
// node scripts/vitrine/film.cjs chat en    → une seule
const L = require('./lib.cjs')
const { BASE, open, action, click, drag, type, sleep, finish, moveTo, center } = L

const githubMock = require('./github-mock.cjs')

// L'app n'existe qu'en français : la version anglaise change seulement ce qu'on tape.
const T = {
  fr: { chatA: 'Je relis ta PR ', chatB: ' ce soir 👍', task: '/tache Export PDF du sprint', doc: ['Décision', 'Qui', 'Quand', 'Export PDF', 'Léa', 'Sprint 4'], phone: 'Je prends la relecture', },
  en: { chatA: 'Reviewing your PR tonight ', chatB: ' 👍', task: '/tache Sprint PDF export', doc: ['Decision', 'Who', 'When', 'PDF export', 'Léa', 'Sprint 4'], phone: 'I’ll take the review' },
}

/** Modifie les données de la démo (gardées dans le navigateur), puis recharge. */
async function patchDemo(s, fn, arg) {
  await s.page.evaluate(([src, a]) => {
    const st = JSON.parse(localStorage.getItem('kollab-demo-v1'))
    new Function('st', 'a', src)(st, a)
    localStorage.setItem('kollab-demo-v1', JSON.stringify(st))
  }, [fn, arg])
  await s.page.reload(); await s.page.waitForTimeout(1200)
}

async function boot(s, path = '/') {
  await s.page.goto(BASE + '/app/?demo=1')
  await s.page.waitForTimeout(1200)
  if (path !== '/') { await s.page.goto(BASE + '/app' + path); await s.page.waitForTimeout(1200) }
}

const scenes = {
  // Accueil du site : une tâche glissée, puis attribuée à Léa.
  async tableau(lang) {
    const s = await open({ lang })
    await boot(s, '/tableau')
    await moveTo(s, 700, 700, 10)
    await action(s)
    await sleep(500)
    const card = s.page.locator('.column').nth(0).locator('.task', { hasText: 'Page de connexion GitHub' })
    const target = await center(s, s.page.locator('.column').nth(1).locator('.add-task'))
    await drag(s, card, [target[0], target[1] - 20])
    await sleep(700)
    await click(s, s.page.locator('.task', { hasText: 'Page de connexion GitHub' }))
    await sleep(900)
    await click(s, s.page.getByText('Léa Martin').last())
    await sleep(1300)
    await s.page.keyboard.press('Escape')
    await sleep(900)
    await finish(s, 'tableau' + (lang === 'en' ? '-en' : ''))
  },

  // Attribution : estimation, deux personnes et leur charge, échéance.
  async attribution(lang) {
    const s = await open({ lang })
    await boot(s, '/tableau')
    await moveTo(s, 600, 650, 10)
    await action(s)
    await sleep(400)
    await click(s, s.page.locator('.task', { hasText: 'Table des groupes' }))
    await sleep(800)
    await click(s, s.page.locator('.task-modal').getByText('8', { exact: true }).first())
    await sleep(500)
    await click(s, s.page.locator('.task-modal').getByText('Léa Martin').last())
    await sleep(600)
    await click(s, s.page.locator('.task-modal').getByText('Vendredi').first())
    await sleep(1400)
    await s.page.keyboard.press('Escape')
    await sleep(900)
    await finish(s, 'attribution' + (lang === 'en' ? '-en' : ''))
  },

  // Chat : une mention, puis une tâche créée avec /tache. Tom écrit depuis Discord.
  async chat(lang, t) {
    const s = await open({ lang })
    await boot(s, '/chat')
    await moveTo(s, 1250, 800, 10)
    await action(s)
    await sleep(400)
    const box = s.page.locator('.composer textarea, .composer input[type=text]').first()
    await click(s, box)
    await type(s, t.chatA + '@Lé')
    await sleep(500)
    await s.page.keyboard.press('Enter')
    await type(s, t.chatB)
    await sleep(300)
    await s.page.keyboard.press('Enter')
    await sleep(900)
    await type(s, t.task)
    await sleep(300)
    await s.page.keyboard.press('Enter')
    await sleep(2200)
    await finish(s, 'chat' + (lang === 'en' ? '-en' : ''))
  },

  // Appel : ça sonne, les collègues décrochent, on parle, on raccroche.
  async appel(lang) {
    const s = await open({ lang })
    await boot(s, '/chat')
    await moveTo(s, 900, 500, 10)
    await action(s)
    await sleep(400)
    await click(s, '.call-ic')
    await sleep(5200)
    await click(s, '.cb.end')
    await sleep(800)
    await finish(s, 'appel' + (lang === 'en' ? '-en' : ''), { posterAt: 4.5 })
  },

  // Revues : la PR, ses tests, Approuver, Fusionner. La tâche passe en Terminé.
  async revues(lang) {
    const s = await open({ lang, width: 1520, height: 961, storage: { 'kollab-gh-token': 'film' } })
    await s.page.route('https://api.github.com/**', githubMock(lang))
    await boot(s, '/')
    await patchDemo(s, `
      const w = st.workspace
      for (const l of w.links) if (l.title === 'Dépôt GitHub') l.url = 'https://github.com/equipe-kollab/kollab'
      const t = w.tasks.find((x) => x.title === 'Visionneuse PDF'); t.prUrl = 'https://github.com/equipe-kollab/kollab/pull/42'
    `)
    await s.page.goto(BASE + '/app/revues'); await s.page.waitForTimeout(1500)
    await moveTo(s, 900, 600, 10)
    await action(s)
    await sleep(1200)
    await click(s, s.page.getByRole('tab', { name: 'Tests' }).or(s.page.locator('button', { hasText: /^Tests/ })).first())
    await sleep(1300)
    await click(s, s.page.locator('.pr-actions button', { hasText: 'Approuver' }))
    await sleep(1200)
    await click(s, s.page.locator('.pr-actions button', { hasText: 'Fusionner' }))
    await sleep(1000)
    await click(s, s.page.locator('.merge-dlg .prompt-foot button', { hasText: 'Fusionner' }))
    await sleep(2400)
    await finish(s, 'revues' + (lang === 'en' ? '-en' : ''), { posterAt: 2.2 })
  },

  // Documents : un compte rendu, le menu « / », un tableau.
  async documents(lang, t) {
    const s = await open({ lang })
    await boot(s, '/documents')
    await moveTo(s, 900, 600, 10)
    await action(s)
    await sleep(400)
    await click(s, s.page.getByText('Démo client du 21 nov.').first())
    await sleep(1500)
    const pm = s.page.locator('.ProseMirror').first()
    const last = pm.locator('> *').last()
    const box = await last.boundingBox()
    await click(s, last, { dx: box.width / 2 - 4 })
    await s.page.evaluate(() => { const el = document.querySelector('.ProseMirror'); const r = document.createRange(); r.selectNodeContents(el.lastElementChild); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r) })
    await sleep(150)
    await s.page.keyboard.press('Enter')
    await type(s, '/')
    await sleep(900)
    await type(s, lang === 'en' ? 'tab' : 'tab', 120)
    await sleep(500)
    await s.page.keyboard.press('Enter')
    await sleep(500)
    for (const [n, w] of t.doc.entries()) { await type(s, w); if (n < t.doc.length - 1) await s.page.keyboard.press('Tab') }
    await sleep(1600)
    await finish(s, 'documents' + (lang === 'en' ? '-en' : ''))
  },

  // Accueil : on range les blocs (déplacer, agrandir).
  async accueil(lang) {
    const s = await open({ lang })
    await boot(s, '/')
    await moveTo(s, 900, 600, 10)
    await action(s)
    await sleep(500)
    await click(s, '[aria-label="Organiser l\'accueil"]')
    await sleep(900)
    const side = s.page.locator('.home-side .he-block').first()
    const main = s.page.locator('.home-main .he-block').first()
    const [mx, my] = await center(s, main.locator('.he-bar'))
    await drag(s, side.locator('.he-bar'), [mx, my - 10], { ms: 1300 })
    await sleep(800)
    const corner = s.page.locator('.home-main .he-block').first().locator('.he-corner')
    const [cx, cy] = await center(s, corner)
    await drag(s, corner, [cx, cy + 120], { ms: 900 })
    await sleep(700)
    await click(s, s.page.getByRole('button', { name: 'Terminé', exact: true }).first())
    await sleep(1200)
    await finish(s, 'accueil' + (lang === 'en' ? '-en' : ''))
  },

  // Téléphone : l'accueil, le tableau, une tâche, puis un message dans le chat.
  async telephone(lang, t) {
    const s = await open({ lang, width: 390, height: 844, phone: true })
    await boot(s, '/')
    await action(s)
    await sleep(1300)
    await s.page.mouse.wheel(0, 0)
    await s.page.evaluate(() => document.scrollingElement.scrollTo({ top: 260, behavior: 'smooth' }))
    await sleep(1300)
    await click(s, s.page.locator('a', { hasText: /^Tableau$/ }).last(), { pause: 300 })
    await sleep(1400)
    await click(s, s.page.locator('.task', { hasText: 'Invitations par lien' }).first(), { pause: 300 })
    await sleep(2000)
    await s.page.keyboard.press('Escape')
    await sleep(500)
    await click(s, s.page.locator('a', { hasText: /^Chat$/ }).last(), { pause: 300 })
    await sleep(1300)
    await click(s, s.page.locator('.composer textarea, .composer input[type=text]').first(), { pause: 300 })
    await sleep(400)
    await type(s, t.phone, 60)
    await sleep(300)
    await s.page.keyboard.press('Enter')
    await sleep(1800)
    await finish(s, 'telephone' + (lang === 'en' ? '-en' : ''), { posterAt: 0.8 })
  },
}

;(async () => {
  const [only, onlyLang] = process.argv.slice(2)
  for (const name of only ? [only] : Object.keys(scenes)) {
    for (const lang of onlyLang ? [onlyLang] : ['fr', 'en']) {
      console.log(name, lang)
      await scenes[name](lang, T[lang])
    }
  }
})().catch((e) => { console.error(e); process.exit(1) })
