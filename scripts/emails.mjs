// Aperçus de tous les emails Kollab : node scripts/emails.mjs [dossier] (par défaut emails-apercu/).
// Écrit un .html par modèle et index.html qui les montre tous côte à côte.
import { mkdirSync, writeFileSync } from 'node:fs'
import { render, samples, templates } from '../supabase/functions/_shared/email-templates.ts'

const out = process.argv[2] ?? 'emails-apercu'
mkdirSync(out, { recursive: true })
const assets = process.env.EMAIL_ASSETS_URL ?? new URL('../public/email', import.meta.url).href
const names = Object.keys(templates)
for (const name of names) {
  const e = templates[name](samples[name])
  writeFileSync(`${out}/${name}.html`, render(e, assets).html)
  writeFileSync(`${out}/${name}.txt`, `Objet : ${e.subject}\n\n${render(e, assets).text}`)
}
writeFileSync(`${out}/index.html`, `<!doctype html><meta charset="utf-8"><title>Emails Kollab</title>
<body style="margin:0;background:#E9EBF2;font-family:Inter,Arial,sans-serif"><div style="display:flex;flex-wrap:wrap;gap:16px;padding:16px">
${names.map((n) => `<figure style="margin:0"><figcaption style="font-size:13px;margin:0 0 6px;color:#4A4E63">${n} · ${templates[n](samples[n]).subject}</figcaption>
<iframe src="${n}.html" style="width:440px;height:720px;border:0;border-radius:12px;background:#fff"></iframe></figure>`).join('\n')}
</div></body>`)
console.log(`${names.length} emails dans ${out}/`)
