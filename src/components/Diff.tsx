import { Fragment, type ReactNode } from 'react'
import type { ReviewComment } from '../lib/github'
import { Markdown } from './Markdown'

/** Coloration légère : mots-clés, chaînes, nombres, commentaires. */
const KW = /\b(import|from|export|default|const|let|var|function|return|if|else|for|while|switch|case|break|continue|new|class|extends|async|await|try|catch|finally|throw|type|interface|enum|public|private|protected|static|def|self|None|True|False|null|undefined|true|false|in|of|as|fn|pub|use|mut|impl|struct|match|select|insert|update|delete|create|table|where|and|or|not)\b/
const TOKEN = /(\/\/.*$|#(?!\{).*$|--.*$|\/\*.*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g

export function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index))
    const [t, comment, str, num, word] = m
    if (comment) out.push(<span key={m.index} className="hl-c">{t}</span>)
    else if (str) out.push(<span key={m.index} className="hl-s">{t}</span>)
    else if (num) out.push(<span key={m.index} className="hl-n">{t}</span>)
    else if (word && KW.test(word)) out.push(<span key={m.index} className="hl-k">{t}</span>)
    else out.push(t)
    last = m.index + t.length
  }
  if (last < code.length) out.push(code.slice(last))
  return out
}

type Line = { kind: 'hunk' | 'add' | 'del' | 'ctx'; text: string; oldNo: number | null; newNo: number | null }

export function parsePatch(patch: string): Line[] {
  const lines: Line[] = []
  let o = 0
  let n = 0
  for (const raw of patch.split('\n')) {
    const h = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/)
    if (h) {
      o = Number(h[1])
      n = Number(h[2])
      lines.push({ kind: 'hunk', text: raw, oldNo: null, newNo: null })
    } else if (raw.startsWith('+')) lines.push({ kind: 'add', text: raw.slice(1), oldNo: null, newNo: n++ })
    else if (raw.startsWith('-')) lines.push({ kind: 'del', text: raw.slice(1), oldNo: o++, newNo: null })
    else if (raw.startsWith('\\')) continue
    else lines.push({ kind: 'ctx', text: raw.slice(1), oldNo: o++, newNo: n++ })
  }
  return lines
}

/** Un fichier de la PR : diff coloré, numéros de ligne, commentaires de revue sous leur ligne. */
export function FileDiff({ patch, comments }: { patch?: string; comments: ReviewComment[] }) {
  if (!patch) return <p className="hint diff-empty">Pas de diff affichable (fichier binaire ou trop gros).</p>
  const lines = parsePatch(patch)
  const at = (l: Line) =>
    comments.filter((c) => (c.side === 'LEFT' ? l.oldNo != null && (c.line ?? c.original_line) === l.oldNo : l.newNo != null && (c.line ?? c.original_line) === l.newNo))
  return (
    <div className="diff" role="table">
      {lines.map((l, i) => {
        const here = l.kind === 'hunk' ? [] : at(l)
        return (
          <Fragment key={i}>
            <div className={`dl ${l.kind}`} role="row">
              <span className="no">{l.oldNo ?? ''}</span>
              <span className="no">{l.newNo ?? ''}</span>
              <span className="sign">{l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ''}</span>
              <code>{l.kind === 'hunk' ? l.text : highlight(l.text)}</code>
            </div>
            {here.map((c) => (
              <div key={c.id} className="dl-comment">
                <img src={c.user.avatar_url} alt="" width={22} height={22} />
                <div>
                  <strong>{c.user.login}</strong>
                  <Markdown text={c.body} />
                </div>
              </div>
            ))}
          </Fragment>
        )
      })}
    </div>
  )
}
