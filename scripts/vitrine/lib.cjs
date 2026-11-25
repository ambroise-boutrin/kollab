// Outils de tournage des vidéos du site vitrine (démo de l'app, rien n'est envoyé).
// Lancer : npm run build && npx vite preview --port 4319, puis node scripts/vitrine/film.cjs [nom] [fr|en]
const { chromium } = require('playwright')
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const BASE = process.env.FILM_URL || 'http://localhost:4319'
const OUT = path.join(__dirname, '../../public/vitrine')
const TMP = path.join(require('os').tmpdir(), 'kollab-film')

// Curseur visible dans la vidéo (le navigateur sans écran n'en dessine pas) et bandeau démo masqué.
const OVERLAY = `
(() => {
  const css = '.demo-banner{display:none!important}' +
    '#k-cur{position:fixed;z-index:2147483647;left:0;top:0;width:22px;height:24px;pointer-events:none;transition:transform .08s linear;will-change:transform}' +
    '#k-cur.down svg{transform:scale(.86);transform-origin:2px 2px}' +
    '#k-tap{position:fixed;z-index:2147483646;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(85,70,224,.28);pointer-events:none;opacity:0;transition:opacity .25s, transform .25s;transform:scale(.6)}' +
    '#k-tap.on{opacity:1;transform:scale(1)}';
  const add = () => {
    if (document.getElementById('k-cur')) return
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s)
    const c = document.createElement('div'); c.id = 'k-cur'
    c.innerHTML = '<svg width="22" height="24" viewBox="0 0 18 20"><path d="M1 1l15 7.5-6.5 1.6L6.6 18z" fill="#0F0F14" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>'
    if (window.__kTouch) c.style.display = 'none'
    document.body.appendChild(c)
    const t = document.createElement('div'); t.id = 'k-tap'; document.body.appendChild(t)
    window.__kPos = window.__kPos || [-40, -40]
    c.style.transform = 'translate(' + window.__kPos[0] + 'px,' + window.__kPos[1] + 'px)'
    addEventListener('mousemove', (e) => { window.__kPos = [e.clientX, e.clientY]; c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)' }, true)
    addEventListener('mousedown', () => c.classList.add('down'), true)
    addEventListener('mouseup', () => c.classList.remove('down'), true)
  }
  if (document.body) add(); else addEventListener('DOMContentLoaded', add)
})()`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function open({ width = 1360, height = 860, phone = false, lang = 'fr', storage = {} } = {}) {
  fs.mkdirSync(TMP, { recursive: true })
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--font-render-hinting=none'] })
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: phone ? 3 : 2,
    hasTouch: phone,
    isMobile: phone,
    locale: lang === 'en' ? 'en-GB' : 'fr-FR',
    permissions: ['microphone', 'camera'],
  })
  const t0 = Date.now()
  await ctx.addInitScript((st) => {
    try { sessionStorage.setItem('kollab-demo-tour', 'done'); for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v) } catch {}
  }, storage)
  if (phone) await ctx.addInitScript(() => { window.__kTouch = true })
  await ctx.addInitScript(OVERLAY)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  erreur page :', e.message))
  const s = { browser, ctx, page, t0, start: 0, phone, width, height, frames: [], x: width / 2, y: height / 2 }
  return s
}

/** Démarre la prise (capture d'écran continue en JPEG de bonne qualité, à la résolution de l'écran). */
async function action(s) {
  const dir = path.join(TMP, 'f' + Date.now())
  fs.mkdirSync(dir, { recursive: true })
  s.dir = dir
  s.cdp = await s.ctx.newCDPSession(s.page)
  s.cdp.on('Page.screencastFrame', async (f) => {
    const file = path.join(dir, String(s.frames.length).padStart(5, '0') + '.jpg')
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'))
    s.frames.push({ file, t: f.metadata.timestamp })
    s.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  await s.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 })
  s.start = Date.now()
}

async function moveTo(s, x, y, ms = 600) {
  const steps = Math.max(8, Math.round(ms / 16))
  const x0 = s.x, y0 = s.y
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
    await s.page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e)
    await sleep(ms / steps / 2)
  }
  s.x = x; s.y = y
}

async function center(s, sel, dx = 0, dy = 0) {
  const loc = typeof sel === 'string' ? s.page.locator(sel).first() : sel
  await loc.scrollIntoViewIfNeeded().catch(() => {})
  const b = await loc.boundingBox()
  if (!b) throw new Error('introuvable : ' + sel)
  return [b.x + b.width / 2 + dx, b.y + b.height / 2 + dy]
}

async function tap(s, x, y) {
  await s.page.evaluate(([x, y]) => { const t = document.getElementById('k-tap'); if (!t) return; t.style.left = x + 'px'; t.style.top = y + 'px'; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 320) }, [x, y])
  await s.page.touchscreen.tap(x, y)
}

/** Va jusqu'à l'élément puis clique (ou touche, sur téléphone). */
async function click(s, sel, { dx = 0, dy = 0, ms = 650, pause = 180 } = {}) {
  const [x, y] = await center(s, sel, dx, dy)
  if (s.phone) { await sleep(pause); await tap(s, x, y); s.x = x; s.y = y; return }
  await moveTo(s, x, y, ms)
  await sleep(pause)
  await s.page.mouse.down(); await sleep(70); await s.page.mouse.up()
}

async function drag(s, from, to, { ms = 1100 } = {}) {
  const [x1, y1] = await center(s, from)
  const [x2, y2] = Array.isArray(to) ? to : await center(s, to)
  await moveTo(s, x1, y1, 600)
  await sleep(150)
  await s.page.mouse.down()
  await moveTo(s, x1 + 8, y1 + 6, 120)
  await moveTo(s, x2, y2, ms)
  await sleep(200)
  await s.page.mouse.up()
}

async function type(s, text, delay = 55) {
  for (const ch of text) { await s.page.keyboard.type(ch); await sleep(delay + Math.random() * 30) }
}

/** Arrête, assemble les images en mp4 (H.264) et fait l'affiche webp (image à `posterAt` s). */
async function finish(s, name, { posterAt, outW } = {}) {
  await sleep(150)
  await s.cdp.send('Page.stopScreencast').catch(() => {})
  const end = Date.now() / 1000
  await s.ctx.close(); await s.browser.close()
  // Le navigateur n'envoie une image que quand l'écran change : chaque image dure jusqu'à la suivante.
  const list = s.frames.map((f, n) => {
    const next = n + 1 < s.frames.length ? s.frames[n + 1].t : Math.max(f.t + 0.5, f.t + (end - f.t))
    return `file '${f.file}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}`
  })
  list.push(`file '${s.frames[s.frames.length - 1].file}'`)
  const listFile = path.join(s.dir, 'list.txt')
  fs.writeFileSync(listFile, list.join('\n'))
  const mp4 = path.join(OUT, `demo-${name}.mp4`)
  const webp = path.join(OUT, `demo-${name}.webp`)
  const w = outW ?? (s.phone ? 560 : 1360)
  const h = Math.round((w * s.height) / s.width / 2) * 2
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', `scale=${w}:${h}:flags=lanczos,fps=30`, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString())
  const at = posterAt ?? Math.max(0, dur - 0.6)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', mp4, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82', webp])
  fs.rmSync(s.dir, { recursive: true, force: true })
  console.log(`  ${name} : ${dur.toFixed(1)} s, ${(fs.statSync(mp4).size / 1024).toFixed(0)} Ko`)
}

module.exports = { BASE, open, action, moveTo, center, click, drag, type, tap, sleep, finish }
