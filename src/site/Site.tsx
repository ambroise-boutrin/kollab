import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { LogoMark } from '../components/Logo'
import { LegalPage, LEGAL_DOCS, findLegal } from './legal'
import './site.css'

/** Lien d'invitation au serveur Discord de Kollab. Laisser vide pour masquer le bouton. */
const DISCORD_URL = ''
const APP_URL = '/app/'
/**
 * Passe à true dès que la première release GitHub contient les installeurs Tauri.
 * Les boutons pointent alors vers la dernière release.
 */
const DESKTOP_READY = false
const RELEASES_URL = 'https://github.com/ambroise-boutrin/kollab/releases/latest'
const YEAR = new Date().getFullYear()

const DOWNLOADS = [
  { os: 'windows', name: 'Windows', detail: 'Windows 10 et 11 · .exe' },
  { os: 'mac', name: 'macOS', detail: 'Puces Apple et Intel · .dmg' },
  { os: 'linux', name: 'Linux', detail: 'AppImage et .deb' },
] as const

function detectOs(): string {
  const ua = navigator.userAgent
  if (/Windows/i.test(ua)) return 'windows'
  if (/Mac OS X|Macintosh/i.test(ua) && !/iPhone|iPad/i.test(ua)) return 'mac'
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return 'linux'
  return ''
}

/** Les autres fonctions, présentées comme un index éditorial plutôt qu'en cartes à icônes. */
const MORE: { title: string; text: string; soon?: boolean }[] = [
  { title: 'Poker planning', text: 'Tout le monde vote en même temps, les cartes se retournent ensemble.', soon: true },
  { title: 'Édition en direct', text: 'Specs et comptes rendus écrits à plusieurs, curseurs visibles.', soon: true },
  { title: 'PDF partagés', text: 'Le sujet ou le cahier des charges ouvert à côté du tableau.', soon: true },
  { title: 'Discord', text: 'Tâches, PR et mentions envoyées dans ton serveur.' },
  { title: 'Liens importants', text: 'Le dépôt, la maquette, la doc : rangés au même endroit.' },
  { title: 'Thèmes', text: 'Cinq thèmes, une couleur à toi et le mode sombre automatique.' },
]

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

function Soon() {
  return <span className="k-soon">Bientôt</span>
}

function Header({ home }: { home: boolean }) {
  const h = (id: string) => (home ? `#${id}` : `/#${id}`)
  return (
    <header className="k-header">
      <div className="k-wrap k-header-row">
        <a href="/" className="k-brand" aria-label="Kollab, accueil">
          <LogoMark size={28} />
          Kollab
        </a>
        <nav className="k-nav" aria-label="Sections">
          <a href={h('produit')}>Produit</a>
          <a href={h('fonctions')}>Fonctions</a>
          <a href={h('telecharger')}>Télécharger</a>
        </nav>
        <div className="k-header-cta">
          <a className="k-link" href={APP_URL}>Connexion</a>
          <a className="k-btn k-btn-ink" href={APP_URL}>Essayer<span className="k-hide-sm"> gratuitement</span></a>
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
            <a href="/" className="k-brand">
              <LogoMark size={26} />
              Kollab
            </a>
            <p className="k-footer-tag">Le code, les sprints et l'équipe au même endroit.</p>
          </div>
          <nav aria-label="Produit">
            <h4>Produit</h4>
            <a href={APP_URL}>Ouvrir l'app</a>
            <a href="/#telecharger">Télécharger</a>
            <a href="https://github.com/ambroise-boutrin/kollab" target="_blank" rel="noreferrer">GitHub</a>
            {DISCORD_URL && <a href={DISCORD_URL} target="_blank" rel="noreferrer">Discord</a>}
          </nav>
          <nav aria-label="Informations légales">
            <h4>Légal</h4>
            {LEGAL_DOCS.map((d) => (
              <a key={d.path} href={d.path}>{d.title}</a>
            ))}
          </nav>
        </div>
        <p className="k-footer-copy">© {YEAR} Kollab</p>
      </div>
    </footer>
  )
}

function Home() {
  useReveal()
  const [os] = useState(detectOs)

  return (
    <main>
      {/* Accroche : grande typo, puis le produit posé sur un aplat de couleur. */}
      <section className="k-hero">
        <div className="k-wrap">
          <h1 className="k-display fade-in">
            Le code, les sprints <span className="k-hl">et l'équipe.</span> Au même endroit.
          </h1>
          <div className="k-hero-foot fade-in d1">
            <p className="k-lead">
              Kollab réunit le tableau Scrum, le chat de groupe et bientôt la relecture des PR GitHub. Gratuit, dans le
              navigateur, sur téléphone et sur ordinateur.
            </p>
            <div className="k-cta">
              <a className="k-btn k-btn-ink k-btn-lg" href={APP_URL}>Essayer Kollab</a>
              <a className="k-btn k-btn-line k-btn-lg" href="#produit">Voir le produit</a>
            </div>
          </div>
        </div>
        <div className="k-wrap">
          <div className="k-stage k-bg-indigo fade-in d2">
            <Shot src="/vitrine/tableau-attribution.png" alt="Le tableau kanban de Kollab, avec le panneau d'attribution d'une tâche">
              <Cursor name="Léa" color="#FF7262" style={{ left: '44%', top: '34%' }} />
              <Cursor name="Sami" color="#14AE5C" style={{ left: '78%', top: '72%' }} />
            </Shot>
          </div>
        </div>
      </section>

      {/* Le produit, en quatre aplats. */}
      <section id="produit" className="k-section">
        <div className="k-wrap">
          <p className="k-kicker reveal">Le produit</p>
          <h2 className="k-h2 reveal">Fait pour les équipes qui livrent du code ensemble.</h2>
        </div>

        <div className="k-wrap k-blocks">
          <article className="k-block k-bg-yellow reveal">
            <div className="k-block-text">
              <span className="k-num">01</span>
              <h3>Le sprint, visible d'un coup d'œil.</h3>
              <p>
                Glisse les tâches entre les colonnes, attribue-les en voyant la charge de chacun, estime en points. Personne
                ne se retrouve avec tout le travail.
              </p>
            </div>
            <Shot className="k-shot-tilt" src="/vitrine/tableau-attribution.png" alt="Attribution d'une tâche avec la charge de chaque membre">
              <Cursor name="Toi" color="#5546E0" style={{ left: '70%', top: '58%' }} />
            </Shot>
          </article>

          <article className="k-block k-bg-coral reveal">
            <div className="k-block-text">
              <span className="k-num">02</span>
              <h3>Une discussion qui reste liée au travail.</h3>
              <p>
                Salons, mentions @, cartes de PR dans la conversation et commande <code>/tache</code>. Les messages arrivent
                en direct chez tout le monde, et sur Discord si tu veux.
              </p>
            </div>
            <Shot src="/vitrine/chat.png" alt="Le chat de groupe avec des mentions et une carte de PR" />
          </article>

          <article className="k-block k-block-phone k-bg-mint reveal">
            <div className="k-block-text">
              <span className="k-num">03</span>
              <h3>Dans ta poche aussi.</h3>
              <p>
                Kollab s'installe sur le téléphone comme une vraie app. Tes tâches et tes messages te suivent, même hors
                ligne.
              </p>
            </div>
            <div className="k-phone">
              <img src="/vitrine/telephone-accueil.png" alt="L'accueil de Kollab sur téléphone" loading="lazy" decoding="async" />
            </div>
          </article>

          <article className="k-block k-bg-ink reveal">
            <div className="k-block-text">
              <span className="k-num">04</span>
              <h3>
                Relire les PR sans quitter Kollab. <Soon />
              </h3>
              <p>
                Diff, commentaires par ligne, approbation et fusion. La tâche passe en « Terminé » toute seule quand sa PR
                est fusionnée.
              </p>
            </div>
            <div className="k-diff" aria-hidden="true">
              <div className="k-diff-head">
                <span className="k-diff-pr">#42</span> Tableau kanban glisser-déposer
                <span className="k-diff-ok">Approuvée</span>
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
                <b>Léa</b> Bien vu pour les capteurs, ça règle le souci sur iPhone.
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* Le reste, en index typographique. */}
      <section id="fonctions" className="k-section k-section-tight">
        <div className="k-wrap">
          <p className="k-kicker reveal">Et aussi</p>
          <ul className="k-index">
            {MORE.map((m) => (
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

      {/* Téléchargement. */}
      <section id="telecharger" className="k-section">
        <div className="k-wrap">
          <div className="k-download k-bg-lilac reveal">
            <div>
              <p className="k-kicker">App de bureau</p>
              <h2 className="k-h2">Kollab dans sa propre fenêtre.</h2>
              <p className="k-download-note">
                {DESKTOP_READY
                  ? 'Raccourcis, notifications et mises à jour automatiques.'
                  : 'Les installeurs arrivent bientôt. En attendant, Kollab marche déjà dans le navigateur.'}
              </p>
            </div>
            <ul className="k-os">
              {DOWNLOADS.map((d) => {
                const mine = d.os === os
                const inner = (
                  <>
                    <span className="k-os-name">
                      {d.name}
                      {mine && <span className="k-mine">Ton système</span>}
                    </span>
                    <span className="k-os-detail">{d.detail}</span>
                    <span className="k-os-go">{DESKTOP_READY ? 'Télécharger ↓' : 'Bientôt'}</span>
                  </>
                )
                return (
                  <li key={d.os} className={mine ? 'mine' : undefined}>
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

      {/* Démarrer. */}
      <section className="k-section k-section-tight">
        <div className="k-wrap">
          <p className="k-kicker reveal">Démarrer</p>
          <ol className="k-steps">
            <li className="reveal"><span>1</span><b>Connecte-toi</b> avec GitHub, Google, Discord ou un email.</li>
            <li className="reveal"><span>2</span><b>Invite ton équipe</b> avec le lien du groupe.</li>
            <li className="reveal"><span>3</span><b>Lance le sprint</b> et suis tout depuis le tableau et le chat.</li>
          </ol>
        </div>
      </section>

      <section className="k-final k-bg-indigo">
        <div className="k-wrap">
          <h2 className="k-display k-display-sm reveal">Lance ton prochain sprint sur Kollab.</h2>
          <div className="k-cta reveal">
            <a className="k-btn k-btn-paper k-btn-lg" href={APP_URL}>Essayer gratuitement</a>
            {DISCORD_URL && (
              <a className="k-btn k-btn-line-paper k-btn-lg" href={DISCORD_URL} target="_blank" rel="noreferrer">Rejoindre le Discord</a>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default function Site() {
  const legal = findLegal(window.location.pathname)
  useEffect(() => {
    document.title = legal ? `${legal.title} · Kollab` : 'Kollab : gestion de projet et revues de code pour équipes de dev'
  }, [legal])
  return (
    <div className="site">
      <Header home={!legal} />
      {legal ? <main><LegalPage doc={legal} /></main> : <Home />}
      <Footer />
    </div>
  )
}
