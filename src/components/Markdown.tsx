import { Fragment, type ReactNode } from 'react'
import { highlight } from './Diff'

/** Rendu léger des commentaires GitHub : blocs de code colorés (dont suggestion), `code`, **gras**, liens. */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g)
  return parts.map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="md-code">{p.slice(1, -1)}</code>
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (/^https?:\/\//.test(p)) return <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a>
    return <Fragment key={i}>{p}</Fragment>
  })
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/```(\w*)\n?([\s\S]*?)```/g)
  const out: ReactNode[] = []
  for (let i = 0; i < blocks.length; i += 3) {
    const prose = blocks[i]
    if (prose.trim()) out.push(...prose.trim().split(/\n{2,}/).map((para, j) => <p key={`${i}-${j}`}>{inline(para)}</p>))
    if (i + 2 < blocks.length) {
      const lang = blocks[i + 1]
      const code = blocks[i + 2].replace(/\n$/, '')
      out.push(
        <pre key={`c${i}`} className={lang === 'suggestion' ? 'md-pre suggestion' : 'md-pre'}>
          {lang === 'suggestion' && <span className="md-label">Suggestion</span>}
          <code>{code.split('\n').map((l, k) => <Fragment key={k}>{highlight(l)}{'\n'}</Fragment>)}</code>
        </pre>,
      )
    }
  }
  return <div className="md">{out}</div>
}
