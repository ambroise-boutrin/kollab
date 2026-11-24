// Parcours rapide de toutes les pages en démo : aucune erreur, pas de débordement.
// Lancer : npm run build && npx vite preview --port 4319 puis npm run smoke
const { chromium } = require('playwright')
const BASE = process.env.SMOKE_URL || 'http://localhost:4319'
;(async () => { const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }); let bad = 0
for (const [w,h,tag] of [[1440,900,'d'],[390,844,'m']]) {
const ctx = await b.newContext({ viewport: { width: w, height: h }, permissions: ['microphone', 'camera'] }); const p = await ctx.newPage()
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text()) && errs.push('console: ' + m.text()))
await p.addInitScript(() => { try { sessionStorage.setItem('kollab-demo-tour', 'done') } catch {} })
await p.goto(BASE + '/app/?demo=1'); await p.waitForTimeout(1000)
const check = async (name) => { const sw = await p.evaluate(() => document.documentElement.scrollWidth); if (sw > w + 1 || errs.length) { bad++; console.log('FAIL', tag, name, sw, errs.splice(0)) } }
for (const path of ['/', '/tableau', '/sprints', '/revues', '/chat', '/documents', '/equipe', '/projet', '/reglages']) { await p.goto(BASE + '/app' + path); await p.waitForTimeout(700); await check(path) }
await p.goto(BASE + '/app/tableau'); await p.waitForTimeout(600); await p.locator('.board .task:visible').first().click(); await p.waitForTimeout(500); await check('task open'); if (!await p.locator('.task-modal, .pt-screen').count()) { bad++; console.log('FAIL no task modal') }
await p.keyboard.press('Escape')
await p.goto(BASE + '/app/sprints'); await p.waitForTimeout(600); await p.locator('.backlog-title').first().click(); await p.waitForTimeout(500); await check('backlog task'); await p.keyboard.press('Escape')
await p.goto(BASE + '/app/sprints?poker=1'); await p.waitForTimeout(600); await check('poker')
await p.goto(BASE + '/app/documents'); await p.waitForTimeout(600); await p.locator('.note-card.appear').first().click(); await p.waitForTimeout(1200); await check('note'); await p.keyboard.press('Escape'); await p.waitForTimeout(400)
await p.locator('.doc-card.kind-pdf').first().click(); await p.waitForTimeout(1200); await check('pdf'); await p.keyboard.press('Escape')
await p.goto(BASE + '/app/chat'); await p.waitForTimeout(600); if (await p.locator('.discord-pill:visible').count()) await p.locator('.discord-pill:visible').first().click(); else { await p.locator('.chan-pick').click(); await p.waitForTimeout(300); await p.locator('.chan-discord').click() }; await p.waitForTimeout(500); await check('discord'); if (!await p.locator('.discord-card').count()) { bad++; console.log('FAIL no discord cards') }
await p.keyboard.press('Escape')
await p.goto(BASE + '/app/chat'); await p.waitForTimeout(600); if (!await p.locator('.call-ic').count()) { bad++; console.log('FAIL no call icons') } else { await p.locator('.call-ic').first().click(); await p.waitForTimeout(3500); await check('call'); if (!await p.locator('.call-stage .call-tile').count()) { bad++; console.log('FAIL call not active') } await p.locator('.cb.end').click(); await p.waitForTimeout(400) }
await p.goto(BASE + '/app/'); await p.waitForTimeout(500); await p.keyboard.press('Control+k'); await p.waitForTimeout(300); await check('cmdk')
await ctx.close() }
console.log(bad ? `${bad} problème(s)` : 'OK'); await b.close(); process.exit(bad ? 1 : 0) })()
