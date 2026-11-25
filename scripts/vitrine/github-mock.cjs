// Fausse API GitHub pour filmer la page Revues sans toucher à un vrai dépôt.
const now = Date.now()
const iso = (min) => new Date(now - min * 60e3).toISOString()
const avatar = (txt, bg) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="20" fill="${bg}"/><text x="20" y="25" font-family="Arial" font-size="14" font-weight="700" fill="#fff" text-anchor="middle">${txt}</text></svg>`)}`
const LEA = { login: 'lea-martin', avatar_url: avatar('LM', '#2E7D4F') }
const SAMI = { login: 'sami-benali', avatar_url: avatar('SB', '#2F6FD0') }
const ME = { login: 'moi', avatar_url: avatar('M', '#5546E0') }

const PATCH = `@@ -1,12 +1,24 @@
 import { useState } from 'react'
-import { Spinner } from './Spinner'
+import { getDocument } from 'pdfjs-dist'
+import { Spinner } from './Spinner'
 
 export function PdfViewer({ url }: { url: string }) {
-  const [page] = useState(1)
-  return <iframe src={url} />
+  const [page, setPage] = useState(1)
+  const [pages, setPages] = useState(0)
+  const doc = usePdf(url, setPages)
+  if (!doc) return <Spinner />
+  return (
+    <div className="pdf">
+      <Canvas doc={doc} page={page} />
+      <Pager page={page} pages={pages} onChange={setPage} />
+    </div>
+  )
 }`

module.exports = function githubMock(lang = 'fr') {
  const en = lang === 'en'
  const state = { merged: false, approved: false }
  const pr = () => ({
    number: 42, title: en ? 'PDF viewer' : 'Visionneuse PDF', state: state.merged ? 'closed' : 'open', merged_at: state.merged ? iso(0) : null, merged: state.merged, draft: false,
    user: LEA, html_url: 'https://github.com/equipe-kollab/kollab/pull/42', head: { sha: 'a1b2c3d', ref: 'feature/visionneuse-pdf' }, updated_at: iso(18), body: '',
    mergeable: true, mergeable_state: 'clean',
  })
  const other = { number: 41, title: en ? 'Invite by link' : 'Invitations par lien', state: 'open', merged_at: null, draft: true, user: SAMI, html_url: 'https://github.com/equipe-kollab/kollab/pull/41', head: { sha: 'e4f5', ref: 'feature/invitations-par-lien' }, updated_at: iso(140), body: '' }
  const files = [
    { filename: 'src/components/PdfViewer.tsx', status: 'modified', additions: 15, deletions: 3, patch: PATCH },
    { filename: 'src/lib/usePdf.ts', status: 'added', additions: 22, deletions: 0, patch: `@@ -0,0 +1,6 @@\n+import { getDocument } from 'pdfjs-dist'\n+\n+export function usePdf(url: string, onPages: (n: number) => void) {\n+  const doc = useAsync(() => getDocument(url).promise, [url])\n+  onPages(doc?.numPages ?? 0)\n+  return doc\n+}` },
  ]
  const checks = ['build', 'tests', 'lint'].map((name, i) => ({ id: i + 1, name, status: 'completed', conclusion: 'success', html_url: '', started_at: iso(20), completed_at: iso(17), output: { title: null, summary: null, annotations_count: 0 } }))
  const comments = [{ id: 1, path: 'src/components/PdfViewer.tsx', line: 9, original_line: 9, side: 'RIGHT', body: en ? 'Nice, the pager works on phone too.' : 'Top, la pagination marche aussi sur téléphone.', user: SAMI, created_at: iso(30) }]

  return async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, '')
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    const m = req.method()
    if (p === '/pulls' && m === 'GET') {
      const st = url.searchParams.get('state')
      if (st === 'closed') return json(state.merged ? [pr()] : [])
      return json([pr(), other])
    }
    if (/^\/pulls\/42$/.test(p)) return json(pr())
    if (/^\/pulls\/41$/.test(p)) return json(other)
    if (/^\/pulls\/\d+\/files/.test(p)) return json(files)
    if (/^\/pulls\/\d+\/comments/.test(p)) return json(comments)
    if (/^\/issues\/\d+\/comments/.test(p)) return json([])
    if (/^\/pulls\/\d+\/reviews/.test(p)) {
      if (m === 'POST') { state.approved = true; return json({ id: 9, state: 'APPROVED' }) }
      return json(state.approved ? [{ id: 9, state: 'APPROVED', user: ME, submitted_at: iso(0) }] : [])
    }
    if (/^\/pulls\/\d+\/merge/.test(p)) { state.merged = true; return json({ merged: true, message: 'ok' }) }
    if (/^\/git\/refs\/heads/.test(p)) return route.fulfill({ status: 204, body: '' })
    if (/check-runs/.test(p)) return json({ check_runs: checks })
    if (/actions\/runs/.test(p)) return json({ workflow_runs: [] })
    if (/\/branches/.test(p)) return json([{ name: 'main', commit: { sha: '1' } }, { name: 'feature/visionneuse-pdf', commit: { sha: 'a1b2c3d' } }])
    if (url.pathname === '/user') return json(ME)
    if (p === '' ) return json({ default_branch: 'main', name: 'kollab', full_name: 'equipe-kollab/kollab', private: true, owner: { login: 'equipe-kollab' }, html_url: '' })
    return json([])
  }
}
