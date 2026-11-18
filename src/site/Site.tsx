import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { inject } from '@vercel/analytics'
import { LogoMark } from '../components/Logo'
import { LegalPage, LEGAL_DOCS, findLegal } from './legal'
import changelog from '../changelog.json'
import seo from './seo.json'
import { CHANGELOG_EN, COMPARE_CELLS, COPY, ROUTES, langOf, matchRoute, type Cell, type PageKey } from './copy'
import './site.css'

/** Lien d'invitation au serveur Discord de Kollab. Laisser vide pour masquer le bouton. */
const DISCORD_URL = ''
const APP_URL = '/app/'
/** Démo sans compte : une équipe d'exemple, avec une visite guidée. */
const DEMO_URL = '/app/?demo=1'
/**
 * Passe à true dès que la première release GitHub contient les installeurs Tauri.
 * Les boutons pointent alors vers la dernière release.
 */
const DESKTOP_READY = true
const RELEASES_URL = 'https://github.com/ambroise-boutrin/kollab/releases/latest'
const YEAR = new Date().getFullYear()

/**
 * Chaque lien du site recharge la page : la langue est donc fixée au chargement, d'après l'adresse
 * (/en/… pour l'anglais, le reste en français).
 */
const PATH = window.location.pathname.replace(/\/+$/, '')
const LANG = langOf(PATH)
const t = COPY[LANG]
const to = (key: PageKey) => ROUTES[key][LANG]

const DOWNLOADS = [
  { os: 'windows', name: 'Windows' },
  { os: 'mac', name: 'macOS' },
  { os: 'linux', name: 'Linux' },
] as const

function detectOs(): string {
  const ua = navigator.userAgent
  if (/Windows/i.test(ua)) return 'windows'
  if (/Mac OS X|Macintosh/i.test(ua) && !/iPhone|iPad/i.test(ua)) return 'mac'
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return 'linux'
  return ''
}

/** Fait apparaître les blocs `.reveal` en fondu court quand ils entrent à l'écran. */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('shown'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('shown')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Un curseur de coéquipier, comme dans une session à plusieurs. */
function Cursor({ name, color, style }: { name: string; color: string; style: CSSProperties }) {
  return (
    <span className="k-cursor" style={{ ...style, '--c': color } as CSSProperties} aria-hidden="true">
      <svg width="18" height="20" viewBox="0 0 18 20"><path d="M1 1l15 7.5-6.5 1.6L6.6 18z" fill="var(--c)" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /></svg>
      <span>{name}</span>
    </span>
  )
}

function Shot({ src, alt, children, className = '' }: { src: string; alt: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`k-shot ${className}`}>
      <img src={src} alt={alt} loading="lazy" decoding="async" />
      {children}
    </div>
  )
}

/** Une vraie prise de l'app en boucle (sans son). Image fixe si l'utilisateur préfère moins d'animations. */
function Demo({ name, label, children }: { name: string; label: string; children?: ReactNode }) {
  const [still] = useState(reducedMotion)
  return (
    <div className="k-shot k-video">
      {still ? (
        <img src={`/vitrine/demo-${name}.webp`} alt={label} />
      ) : (
        <video src={`/vitrine/demo-${name}.mp4`} poster={`/vitrine/demo-${name}.webp`} autoPlay muted loop playsInline preload="metadata" aria-label={label} />
      )}
      {children}
    </div>
  )
}

/** Vidéo de l'app sur téléphone, dans un cadre de téléphone. Image fixe si l'animation est réduite. */
function PhoneDemo() {
  const [still] = useState(reducedMotion)
  const label = t.product.phone.video
  return (
    <div className="k-phone">
      {still ? (
        <img src="/vitrine/demo-telephone.webp" alt={label} loading="lazy" decoding="async" />
      ) : (
        <video src="/vitrine/demo-telephone.mp4" poster="/vitrine/demo-telephone.webp" autoPlay muted loop playsInline preload="metadata" aria-label={label} />
      )}
    </div>
  )
}

function Soon() {
  return <span className="k-soon">{t.soon}</span>
}

const NAV: PageKey[] = ['features', 'audience', 'pricing', 'download']
const FOOTER_NAV: PageKey[] = ['features', 'audience', 'compare', 'pricing', 'download']

/** Lien vers la même page dans l'autre langue (les pages légales n'existent qu'en français). */
function LangSwitch({ current }: { current: PageKey | null }) {
  const other = LANG === 'fr' ? 'en' : 'fr'
  const href = ROUTES[current ?? 'home'][other]
  return (
    <a className="k-link k-lang" href={href} hrefLang={other} lang={other} title={t.langSwitch.title}>
      {t.langSwitch.label}
    </a>
  )
}

function Header({ current }: { current: PageKey | null }) {
  const [open, setOpen] = useState(false)
  // Menu plein écran sur téléphone : bloque le défilement derrière, se ferme avec Échap.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])
  const links = NAV.map((k) => (
    <a key={k} href={to(k)} aria-current={current === k ? 'page' : undefined}>{t.nav[k as keyof typeof t.nav]}</a>
  ))
  return (
    <header className={`k-header${open ? ' open' : ''}`}>
      <div className="k-wrap k-header-row">
        <a href={to('home')} className="k-brand" aria-label={t.header.home}>
          <LogoMark size={26} />
          Kollab
        </a>
        <nav className="k-nav" aria-label="Pages">{links}</nav>
        <div className="k-header-cta">
          <LangSwitch current={current} />
          <a className="k-link k-login" href={APP_URL}>{t.header.login}</a>
          <a className="k-btn k-btn-line k-hide-md" href={DEMO_URL}>{t.final.demo}</a>
          <a className="k-btn k-btn-ink" href={APP_URL}>{t.header.try}<span className="k-hide-sm">{t.header.trySuffix}</span></a>
          <button className="k-menu-btn" aria-expanded={open} aria-controls="k-menu" onClick={() => setOpen(!open)}>
            {open ? t.header.close : t.header.menu}
          </button>
        </div>
      </div>
      <div className="k-menu" id="k-menu" hidden={!open}>
        <nav className="k-menu-links" aria-label="Pages">
          {[...NAV, 'compare' as PageKey, 'news' as PageKey, 'faq' as PageKey].map((k) => (
            <a key={k} href={to(k)} aria-current={current === k ? 'page' : undefined}>
              {k === 'news' ? t.footer.news : k === 'faq' ? t.footer.faq : t.nav[k as keyof typeof t.nav]}
            </a>
          ))}
        </nav>
        <div className="k-menu-cta">
          <a className="k-btn k-btn-ink k-btn-lg" href={APP_URL}>{t.final.try}</a>
          <a className="k-btn k-btn-line k-btn-lg" href={DEMO_URL}>{t.final.demo}</a>
          <a className="k-btn k-btn-line k-btn-lg" href={APP_URL}>{t.header.login}</a>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="k-footer">
      <div className="k-wrap">
        <div className="k-footer-grid">
          <div>
            <a href={to('home')} className="k-footer-mark">Kollab</a>
            <p className="k-footer-tag">{t.footer.tag}</p>
          </div>
          <nav aria-label={t.footer.product}>
            <h4>{t.footer.product}</h4>
            <a href={APP_URL}>{t.footer.openApp}</a>
            <a href={DEMO_URL}>{t.footer.demo}</a>
            {FOOTER_NAV.map((k) => (
              <a key={k} href={to(k)}>{t.nav[k as keyof typeof t.nav]}</a>
            ))}
            <a href={to('news')}>{t.footer.news}</a>
            <a href={to('faq')}>{t.footer.faq}</a>
            <a href="https://github.com/ambroise-boutrin/kollab" target="_blank" rel="noreferrer">GitHub</a>
            {DISCORD_URL && <a href={DISCORD_URL} target="_blank" rel="noreferrer">Discord</a>}
          </nav>
          <nav aria-label={t.footer.legal}>
            <h4>{t.footer.legal}</h4>
            {LEGAL_DOCS.map((d) => (
              <a key={d.path} href={d.path} hrefLang="fr">{d.title}</a>
            ))}
            {t.footer.legalNote && <span className="k-footer-note">({t.footer.legalNote})</span>}
          </nav>
        </div>
        <p className="k-footer-copy">© {YEAR} Kollab</p>
      </div>
    </footer>
  )
}

/** Titre de section en deux tons : l'idée en noir, la précision en gris. Lien optionnel à droite. */
function SectionHead({ title, sub, link, as: Tag = 'h2' }: { title: string; sub?: string; link?: { href: string; label: string }; as?: 'h1' | 'h2' }) {
  return (
    <div className="k-head reveal">
      <Tag className="k-head-title">
        {title}
        {sub && <span className="k-dim"> {sub}</span>}
      </Tag>
      {link && <a className="k-arrow" href={link.href}>{link.label}</a>}
    </div>
  )
}

function HeroSection() {
  const h = t.hero
  return (
    <>
      {/* Accroche à gauche, grand bouton à droite, puis le produit en grand. */}
      <section className="k-hero">
        <div className="k-wrap k-hero-row">
          <div>
            <h1 className="k-hero-title fade-in">{h.titleA}{h.titleHl}{h.titleB}</h1>
            <p className="k-hero-sub fade-in d1">{h.lead}</p>
          </div>
          <div className="k-hero-cta fade-in d1">
            <a className="k-btn k-btn-ink k-btn-xl" href={APP_URL}>{h.signup}</a>
            <a className="k-arrow" href={DEMO_URL}>{h.demo} →</a>
          </div>
        </div>
        <div className="k-wrap">
          <div className="k-canvas k-bg-indigo fade-in d2">
            <div className="k-canvas-inner">
              <Demo name="tableau" label={h.video}>
                <Cursor name="Léa" color="#FF7262" style={{ left: '84%', top: '18%' }} />
                <Cursor name="Sami" color="#14AE5C" style={{ left: '30%', top: '78%' }} />
              </Demo>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

/** Bandeau de mots qui défile en continu, avec un bouton pause. Arrêté si l'animation est réduite. */
function Marquee() {
  const words = t.home.marquee
  const [paused, setPaused] = useState(false)
  return (
    <section className="k-marquee" aria-label={t.home.marqueeLabel}>
      <ul className="k-sr">{words.map((w) => <li key={w}>{w}</li>)}</ul>
      <div className={`k-marquee-track${paused ? ' paused' : ''}`} aria-hidden="true">
        {[...words, ...words].map((w, n) => <span key={n}>{w}</span>)}
      </div>
      <button className="k-marquee-btn" onClick={() => setPaused(!paused)} aria-label={paused ? t.home.play : t.home.pause}>
        {paused ? '▶' : '❚❚'}
      </button>
    </section>
  )
}

/** Faux diff pour la revue de PR, fonction à venir. */
function DiffMock() {
  const p = t.product.pr
  return (
    <div className="k-diff" aria-hidden="true">
      <div className="k-diff-head">
        <span className="k-diff-pr">#42</span> {p.prTitle}
        <span className="k-diff-ok">{p.approved}</span>
      </div>
      <div className="k-diff-file">src/pages/Board.tsx</div>
      <pre>
        <span className="del">-  const [cols] = useState(DEFAULT)</span>
        {'\n'}
        <span className="add">+  const cols = useColumns(sprint)</span>
        {'\n'}
        <span className="add">+  const sensors = useSensors(pointer)</span>
        {'\n'}
        {'   return <Board cols={cols} />'}
      </pre>
      <div className="k-diff-comment">
        <b>Léa</b> {p.comment}
      </div>
    </div>
  )
}

/**
 * Le produit en onglets. La page reste blanche ; la couleur vit dans le visuel et change avec l'onglet.
 * Les onglets avancent seuls tant que la section est visible, sauf si on clique ou si l'animation est réduite.
 */
function ProductTabs() {
  const p = t.product
  const tabs = [
    { bg: 'k-bg-yellow', title: p.board.title, text: <>{p.board.text}</>, media: <Shot src="/vitrine/tableau-attribution.png" alt={p.board.alt} /> },
    { bg: 'k-bg-coral', title: p.chat.title, text: <>{p.chat.textA}<code>{p.chat.code}</code>{p.chat.textB}</>, media: <Demo name="chat" label={p.chat.video} /> },
    { bg: 'k-bg-mint', title: p.phone.title, text: <>{p.phone.text}</>, media: <PhoneDemo /> },
    { bg: 'k-bg-ink', title: p.pr.title, text: <>{p.pr.text}</>, media: <DiffMock />, soon: true },
  ]
  const [i, setI] = useState(0)
  const [auto, setAuto] = useState(() => !reducedMotion())
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!auto || !ref.current) return
    let timer = 0
    const io = new IntersectionObserver(([e]) => {
      window.clearInterval(timer)
      if (e.isIntersecting) timer = window.setInterval(() => setI((n) => (n + 1) % tabs.length), 7000)
    }, { threshold: 0.4 })
    io.observe(ref.current)
    return () => { io.disconnect(); window.clearInterval(timer) }
  }, [auto, tabs.length])
  const tab = tabs[i]
  return (
    <section ref={ref} id="produit" className="k-section k-tabs">
      <div className="k-wrap">
        <SectionHead title={t.home.tabsTitle} sub={t.home.tabsSub} link={{ href: to('features'), label: t.home.explore }} />
        <div className="k-tablist" role="tablist" aria-label={t.home.tabsKicker}>
          {tabs.map((_, n) => (
            <button
              key={n}
              role="tab"
              id={`tab-${n}`}
              aria-selected={n === i}
              aria-controls="tab-panel"
              className={n === i ? (auto ? 'on run' : 'on') : undefined}
              onClick={() => { setAuto(false); setI(n) }}
            >
              {t.home.tabs[n]}
              <span className="k-tab-bar" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="k-tabpanel" id="tab-panel" role="tabpanel" aria-labelledby={`tab-${i}`}>
          <div className={`k-tabmedia ${tab.bg}${i === 2 ? ' k-tabmedia-phone' : ''}`} key={i}>{tab.media}</div>
          <div className="k-tabtext" key={`t${i}`}>
            <h3>{tab.title}{tab.soon && <Soon />}</h3>
            <p>{tab.text}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Grande phrase à gauche, chiffres vrais à droite, séparés par un filet. */
function StatementSection() {
  return (
    <section className="k-section">
      <div className="k-wrap k-statement">
        <p className="k-quote reveal">
          {t.home.statementA} <span className="k-dim">{t.home.statementB}</span>
        </p>
        <dl className="k-stats">
          {t.home.stats.map((x) => (
            <div key={x.l} className="reveal">
              <dt>{x.n}</dt>
              <dd>{x.l}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

/** Exemples d'équipes en carrousel horizontal, avec compteur. */
function CasesSection() {
  const track = useRef<HTMLDivElement>(null)
  const [n, setN] = useState(0)
  const items = t.audiences
  const go = (d: number) => {
    const el = track.current
    if (!el) return
    const card = el.children[0] as HTMLElement | undefined
    const step = card ? card.offsetWidth + 16 : el.clientWidth
    el.scrollBy({ left: d * step, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }
  const onScroll = () => {
    const el = track.current
    const card = el?.children[0] as HTMLElement | undefined
    if (!el || !card) return
    setN(Math.min(items.length - 1, Math.round(el.scrollLeft / (card.offsetWidth + 16))))
  }
  return (
    <section className="k-section k-cases">
      <div className="k-wrap">
        <div className="k-cases-head">
          <SectionHead title={t.home.casesTitle} sub={t.home.casesSub} />
          <div className="k-cases-nav">
            <span className="k-count" aria-live="polite">{n + 1} / {items.length}</span>
            <button className="k-round" onClick={() => go(-1)} disabled={n === 0} aria-label={t.home.prev}>←</button>
            <button className="k-round" onClick={() => go(1)} disabled={n === items.length - 1} aria-label={t.home.next}>→</button>
          </div>
        </div>
      </div>
      <div className="k-cases-track" ref={track} onScroll={onScroll}>
        {items.map((a) => (
          <article key={a.who} className="k-case">
            <div className={`k-case-media ${a.bg}`}>
              <h3>{a.title}</h3>
            </div>
            <p className="k-case-who"><a className="k-arrow" href={to('audience')}>{a.who} →</a></p>
            <p className="k-case-story">{a.story}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function ProductSection() {
  const p = t.product
  return (
    <>
      {/* Le produit, en quatre aplats. */}
      <section id="produit" className="k-section">
        <div className="k-wrap">
          <p className="k-kicker reveal">{p.kicker}</p>
          <h2 className="k-h2 reveal">{p.title}</h2>
        </div>

        <div className="k-wrap k-blocks">
          <article className="k-block k-bg-yellow reveal">
            <div className="k-block-text">
              <span className="k-num">01</span>
              <h3>{p.board.title}</h3>
              <p>{p.board.text}</p>
            </div>
            <Shot className="k-shot-tilt" src="/vitrine/tableau-attribution.png" alt={p.board.alt}>
              <Cursor name={t.hero.you} color="#5546E0" style={{ left: '70%', top: '58%' }} />
            </Shot>
          </article>

          <article className="k-block k-bg-coral reveal">
            <div className="k-block-text">
              <span className="k-num">02</span>
              <h3>{p.chat.title}</h3>
              <p>
                {p.chat.textA}<code>{p.chat.code}</code>{p.chat.textB}
              </p>
            </div>
            <Demo name="chat" label={p.chat.video} />
          </article>

          <article className="k-block k-block-phone k-bg-mint reveal">
            <div className="k-block-text">
              <span className="k-num">03</span>
              <h3>{p.phone.title}</h3>
              <p>{p.phone.text}</p>
            </div>
            <PhoneDemo />
          </article>

          <article className="k-block k-bg-ink reveal">
            <div className="k-block-text">
              <span className="k-num">04</span>
              <h3>
                {p.pr.title} <Soon />
              </h3>
              <p>{p.pr.text}</p>
            </div>
            <DiffMock />
          </article>
        </div>
      </section>
    </>
  )
}

function MoreSection() {
  return (
    <>
      {/* Le reste, en index typographique. */}
      <section id="fonctions" className="k-section k-section-tight">
        <div className="k-wrap">
          <p className="k-kicker reveal">{t.more.kicker}</p>
          <ul className="k-index">
            {t.more.items.map((m) => (
              <li key={m.title} className="reveal">
                <h3>
                  {m.title}
                  {m.soon && <Soon />}
                </h3>
                <p>{m.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}

function IntegrationsSection() {
  return (
    <>
      {/* Intégrations. */}
      <section className="k-section k-section-tight">
        <div className="k-wrap">
          <p className="k-kicker reveal">{t.integrations.kicker}</p>
          <h2 className="k-h2 reveal">{t.integrations.title}</h2>
          <ul className="k-integ">
            {t.integrations.items.map((i) => (
              <li key={i.name} className="reveal">
                <span className="k-integ-mark" style={{ background: i.color }}>{i.name[0]}</span>
                <h3>{i.name}</h3>
                <p>{i.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}

function DownloadSection() {
  const [os] = useState(detectOs)
  const d = t.download
  return (
    <>
      {/* Téléchargement. */}
      <section id="telecharger" className="k-section">
        <div className="k-wrap">
          <div className="k-download k-bg-lilac reveal">
            <div>
              <p className="k-kicker">{d.kicker}</p>
              <h2 className="k-h2">{d.title}</h2>
              <p className="k-download-note">{DESKTOP_READY ? d.ready : d.notReady}</p>
            </div>
            <ul className="k-os">
              {DOWNLOADS.map((x) => {
                const mine = x.os === os
                const inner = (
                  <>
                    <span className="k-os-name">
                      {x.name}
                      {mine && <span className="k-mine">{d.mine}</span>}
                    </span>
                    <span className="k-os-detail">{d.os[x.os]}</span>
                    <span className="k-os-go">{DESKTOP_READY ? d.go : t.soon}</span>
                  </>
                )
                return (
                  <li key={x.os} className={mine ? 'mine' : undefined}>
                    {DESKTOP_READY ? (
                      <a href={RELEASES_URL} target="_blank" rel="noreferrer">{inner}</a>
                    ) : (
                      <div aria-disabled="true">{inner}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}

function StepsSection() {
  return (
    <>
      {/* Démarrer. */}
      <section className="k-section k-section-tight">
        <div className="k-wrap">
          <p className="k-kicker reveal">{t.steps.kicker}</p>
          <ol className="k-steps">
            {t.steps.items.map((s, n) => (
              <li key={s.b} className="reveal"><span>{n + 1}</span><b>{s.b}</b>{s.t}</li>
            ))}
          </ol>
        </div>
      </section>
    </>
  )
}

function PricingSection() {
  const p = t.pricing
  return (
    <>
      {/* Tarifs. */}
      <section id="tarifs" className="k-section">
        <div className="k-wrap">
          <p className="k-kicker reveal">{p.kicker}</p>
          <div className="k-price reveal">
            <div className="k-price-main">
              <h2 className="k-h2">{p.title}</h2>
              <p className="k-price-sub">{p.sub}</p>
              <div className="k-price-tag"><b>{p.price}</b><span>{p.per}</span></div>
              <a className="k-btn k-btn-ink k-btn-lg" href={APP_URL}>{p.cta}</a>
            </div>
            <ul className="k-price-list">
              {p.list.map((it) => <li key={it}>{it}</li>)}
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}

function RoadmapSection() {
  const r = t.roadmap
  return (
    <>
      {/* Feuille de route. */}
      <section id="feuille-de-route" className="k-section k-section-tight">
        <div className="k-wrap">
          <p className="k-kicker reveal">{r.kicker}</p>
          <h2 className="k-h2 reveal">{r.title}</h2>
          <div className="k-roadmap">
            {r.cols.map((col) => (
              <div key={col.when} className={`k-road ${col.color} reveal`}>
                <h3>{col.when}</h3>
                <ul>
                  {col.items.map((it) => <li key={it}>{it}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="k-road-more reveal"><a href={to('news')}>{r.history}</a></p>
        </div>
      </section>
    </>
  )
}

function FaqSection() {
  return (
    <>
      {/* Questions fréquentes. */}
      <section id="faq" className="k-section k-section-tight">
        <div className="k-wrap k-faq-wrap">
          <div>
            <p className="k-kicker reveal">{t.faq.kicker}</p>
            <h2 className="k-h2 reveal">{t.faq.title}</h2>
          </div>
          <div className="k-faq">
            {t.faq.items.map((f) => (
              <details key={f.q} className="reveal">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

/** Appel final : une phrase, puis un très grand bouton noir pleine largeur. */
function FinalSection() {
  return (
    <section className="k-section k-final">
      <div className="k-wrap">
        <SectionHead title={t.final.title} sub={t.final.sub} link={{ href: DEMO_URL, label: `${t.final.demo} →` }} />
        <a className="k-bar reveal" href={APP_URL}>{t.final.try}</a>
        {DISCORD_URL && (
          <p className="k-final-more"><a className="k-arrow" href={DISCORD_URL} target="_blank" rel="noreferrer">{t.final.discord} →</a></p>
        )}
      </div>
    </section>
  )
}

/** En-tête des pages secondaires. */
function PageHead({ kicker, title, lead }: { kicker: string; title: string; lead?: string }) {
  return (
    <section className="k-pagehead">
      <div className="k-wrap">
        <p className="k-kicker fade-in">{kicker}</p>
        <h1 className="k-display k-display-sm fade-in d1">{title}</h1>
        {lead && <p className="k-lead fade-in d2">{lead}</p>}
      </div>
    </section>
  )
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Inscription aux nouveautés par email. Le site peut seulement ajouter une adresse dans la table waitlist
 * (jamais la lire). Une adresse déjà inscrite compte comme un succès.
 */
function WaitlistSection({ source }: { source: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  const w = t.waitlist

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY!,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), source: LANG === 'en' ? `${source}-en` : source }),
      })
      setState(res.ok || res.status === 409 ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <section className="k-section k-section-tight">
      <div className="k-wrap">
        <div className="k-waitlist k-bg-yellow reveal">
          <div>
            <h2 className="k-h3">{w.title}</h2>
            <p>{w.text}</p>
          </div>
          {state === 'done' ? (
            <p className="k-waitlist-ok" role="status">{w.done}</p>
          ) : (
            <form onSubmit={submit} className="k-waitlist-form">
              <label className="k-sr" htmlFor={`wl-${source}`}>{w.label}</label>
              <input
                id={`wl-${source}`}
                type="email"
                required
                autoComplete="email"
                placeholder={w.placeholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="k-btn k-btn-ink" disabled={state === 'sending'}>
                {state === 'sending' ? w.sending : w.submit}
              </button>
              {state === 'error' && <p className="k-waitlist-err" role="alert">{w.error}</p>}
              <p className="k-waitlist-legal">{w.legal} <a href="/confidentialite" hrefLang="fr">{w.privacy}</a></p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

function HomePage() {
  return (
    <main>
      <HeroSection />
      <Marquee />
      <ProductTabs />
      <StatementSection />
      <CasesSection />
      <FinalSection />
    </main>
  )
}

function FeaturesPage() {
  const p = t.pages.features
  return (
    <main>
      <PageHead kicker={p.kicker} title={p.title} lead={p.lead} />
      <ProductSection />
      <MoreSection />
      <IntegrationsSection />
      <RoadmapSection />
      <FinalSection />
    </main>
  )
}

function PricingPage() {
  const p = t.pages.pricing
  return (
    <main>
      <PageHead kicker={p.kicker} title={p.title} lead={p.lead} />
      <PricingSection />
      <FaqSection />
      <FinalSection />
    </main>
  )
}

function DownloadPage() {
  const p = t.pages.download
  return (
    <main>
      <PageHead kicker={p.kicker} title={p.title} lead={p.lead} />
      <DownloadSection />
      <StepsSection />
      <WaitlistSection source="telecharger" />
      <FinalSection />
    </main>
  )
}

function FaqPage() {
  const p = t.pages.faq
  return (
    <main>
      <PageHead kicker={p.kicker} title={p.title} />
      <FaqSection />
      <FinalSection />
    </main>
  )
}

function AudiencePage() {
  const p = t.pages.audience
  return (
    <main>
      <PageHead kicker={p.kicker} title={p.title} lead={p.lead} />
      <section className="k-section">
        <div className="k-wrap k-aud">
          {t.audiences.map((a) => (
            <article key={a.who} className={`k-aud-card ${a.bg} reveal`}>
              <p className="k-kicker">{a.who}</p>
              <h2 className="k-h3">{a.title}</h2>
              <p className="k-aud-story">{a.story}</p>
              <ul>
                {a.points.map((pt) => <li key={pt}>{pt}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <FinalSection />
    </main>
  )
}

const TOOLS = [
  { key: 'kollab', label: 'Kollab' },
  { key: 'trello', label: 'Trello' },
  { key: 'jira', label: 'Jira' },
  { key: 'notion', label: 'Notion' },
  { key: 'discord', label: 'Discord' },
] as const

function Mark({ v }: { v: Cell }) {
  const c = t.compare
  if (v === true) return <span className="k-mk yes" aria-label={c.yes}>✓</span>
  if (v === 'soon') return <span className="k-mk soon">{t.soon}</span>
  if (v === 'part') return <span className="k-mk part">{c.part}</span>
  return <span className="k-mk no" aria-label={c.no}>–</span>
}

function ComparePage() {
  const p = t.pages.compare
  return (
    <main>
      <PageHead kicker={p.kicker} title={p.title} lead={p.lead} />
      <section className="k-section">
        <div className="k-wrap">
          <div className="k-compare reveal">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.compare.head}</th>
                  {TOOLS.map((x) => <th key={x.key} scope="col" className={x.key === 'kollab' ? 'me' : undefined}>{x.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {t.compare.rows.map((feature, n) => (
                  <tr key={feature}>
                    <th scope="row">{feature}</th>
                    {TOOLS.map((x) => <td key={x.key} className={x.key === 'kollab' ? 'me' : undefined}><Mark v={COMPARE_CELLS[n][x.key]} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="k-note reveal">{t.compare.note}</p>
        </div>
      </section>
      <FinalSection />
    </main>
  )
}

type Release = { version: string; date: string; title: string; items: string[] }

function News() {
  const releases = (changelog as Release[]).map((r) => (LANG === 'en' && CHANGELOG_EN[r.version] ? { ...r, ...CHANGELOG_EN[r.version] } : r))
  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(t.news.locale, { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <main>
      <div className="k-wrap k-news">
        <p className="k-kicker">{t.news.kicker}</p>
        <h1 className="k-display k-display-sm">{t.news.title}</h1>
        <ol className="k-releases">
          {releases.map((r) => (
            <li key={r.version}>
              <div className="k-rel-meta">
                <span className="k-rel-v">v{r.version}</span>
                <time dateTime={r.date}>{fmt(r.date)}</time>
              </div>
              <div>
                <h2>{r.title}</h2>
                <ul>
                  {r.items.map((it) => <li key={it}>{it}</li>)}
                </ul>
              </div>
            </li>
          ))}
        </ol>
        <p className="k-road-more"><a href={`${to('features')}#feuille-de-route`}>{t.news.next}</a></p>
      </div>
      <WaitlistSection source="nouveautes" />
    </main>
  )
}

/** Pages du site, par clé. */
const PAGES: Record<PageKey, () => ReactNode> = {
  home: () => <HomePage />,
  features: () => <FeaturesPage />,
  audience: () => <AudiencePage />,
  compare: () => <ComparePage />,
  pricing: () => <PricingPage />,
  download: () => <DownloadPage />,
  news: () => <News />,
  faq: () => <FaqPage />,
}
const SEO = seo.pages as Record<string, { title: string; description: string }>

export default function Site() {
  const legal = findLegal(PATH)
  const route = matchRoute(PATH)
  const key: PageKey = route?.key ?? 'home'
  useReveal()
  // Statistiques de visite sans cookie (Vercel Web Analytics), seulement sur le site de présentation.
  useEffect(() => {
    inject({ mode: import.meta.env.PROD ? 'production' : 'development' })
  }, [])
  useEffect(() => {
    const meta = SEO[legal ? legal.path : ROUTES[key][LANG]] ?? SEO['/']
    document.title = meta.title
    document.documentElement.lang = LANG
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description)
  }, [key, legal])
  return (
    <div className="site">
      <Header current={legal ? null : key} />
      {legal ? <main><LegalPage doc={legal} /></main> : PAGES[key]()}
      <Footer />
    </div>
  )
}
