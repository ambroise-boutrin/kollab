import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { LogoMark } from '../components/Logo'
import { LegalPage, LEGAL_DOCS, findLegal } from './legal'
import changelog from '../changelog.json'
import seo from './seo.json'
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

const INTEGRATIONS = [
  { name: 'GitHub', text: 'Connexion, cartes de PR dans le chat, et bientôt la relecture complète.', color: '#0F0F14' },
  { name: 'Discord', text: 'Connexion, et notifications des tâches et mentions dans ton serveur.', color: '#5865F2' },
  { name: 'Google', text: 'Connexion en un clic avec ton compte Google.', color: '#1F5FC4' },
]

const ROADMAP: { when: string; color: string; items: string[] }[] = [
  { when: 'Disponible', color: 'k-bg-mint', items: ['Tableau kanban et attribution', 'Chat avec salons et mentions', 'Invitations et rôles', 'Notifications Discord', 'App téléphone et ordinateur'] },
  { when: 'Ensuite', color: 'k-bg-yellow', items: ['Relecture des PR GitHub', 'Sprints, burndown et vélocité', 'Poker planning en direct', 'Salons vocaux'] },
  { when: 'Plus tard', color: 'k-bg-lilac', items: ['Documents à plusieurs en direct', 'PDF annotés ensemble', 'Recherche globale Ctrl+K', 'Tableaux blancs'] },
]

const FAQ: { q: string; a: string }[] = [
  { q: 'Kollab est-il gratuit ?', a: "Oui. Kollab est gratuit pendant toute la phase bêta, pour toutes les fonctions. Si une offre payante arrive un jour, elle sera annoncée à l'avance et la version gratuite restera utilisable." },
  { q: "Faut-il installer quelque chose ?", a: "Non. Kollab marche dans le navigateur. Tu peux aussi l'installer sur ton téléphone depuis le navigateur, et bientôt sur ordinateur (Windows, macOS, Linux)." },
  { q: 'Combien de personnes dans un groupe ?', a: "Il n'y a pas de limite fixe pendant la bêta. Kollab est pensé pour les équipes de 2 à 15 personnes, comme un projet étudiant ou une petite équipe de dev." },
  { q: 'Où sont stockées mes données ?', a: 'Dans une base Supabase hébergée à Paris, dans l’Union européenne. Chaque groupe ne voit que ses propres données. Les détails sont dans la politique de confidentialité.' },
  { q: 'Faut-il un compte GitHub ?', a: "Non. Tu peux te connecter avec Google, Discord ou un email. GitHub n'est utile que pour les fonctions liées aux PR." },
  { q: 'Comment inviter mon équipe ?', a: "Depuis la page Groupe, crée un lien d'invitation en choisissant le rôle (admin, membre ou invité en lecture seule) et partage-le." },
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

/** Une vraie prise de l'app en boucle (sans son). Image fixe si l'utilisateur préfère moins d'animations. */
function Demo({ name, label, children }: { name: string; label: string; children?: ReactNode }) {
  const [still] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
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

function Soon() {
  return <span className="k-soon">Bientôt</span>
}

const NAV = [
  { href: '/fonctionnalites', label: 'Fonctionnalités' },
  { href: '/pour-qui', label: 'Pour qui' },
  { href: '/comparatif', label: 'Comparatif' },
  { href: '/tarifs', label: 'Tarifs' },
  { href: '/telecharger', label: 'Télécharger' },
  { href: '/faq', label: 'FAQ' },
]

function Header({ current }: { current: string }) {
  return (
    <header className="k-header">
      <div className="k-wrap k-header-row">
        <a href="/" className="k-brand" aria-label="Kollab, accueil">
          <LogoMark size={28} />
          Kollab
        </a>
        <nav className="k-nav" aria-label="Pages">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} aria-current={current === n.href ? 'page' : undefined}>{n.label}</a>
          ))}
        </nav>
        <div className="k-header-cta">
          <a className="k-link" href={APP_URL}>Connexion</a>
          <a className="k-btn k-btn-ink" href={APP_URL}>Essayer<span className="k-hide-sm"> gratuitement</span></a>
        </div>
      </div>
      <nav className="k-subnav" aria-label="Pages">
        {NAV.map((n) => (
          <a key={n.href} href={n.href} aria-current={current === n.href ? 'page' : undefined}>{n.label}</a>
        ))}
      </nav>
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
            <a href="/fonctionnalites">Fonctionnalités</a>
            <a href="/pour-qui">Pour qui</a>
            <a href="/comparatif">Comparatif</a>
            <a href="/tarifs">Tarifs</a>
            <a href="/telecharger">Télécharger</a>
            <a href="/nouveautes">Nouveautés</a>
            <a href="/faq">Questions fréquentes</a>
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

function HeroSection() {
  return (
    <>
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
            <Demo name="tableau" label="Démonstration : une tâche glissée de colonne en colonne, puis attribuée à Léa">
              <Cursor name="Léa" color="#FF7262" style={{ left: '84%', top: '18%' }} />
              <Cursor name="Sami" color="#14AE5C" style={{ left: '30%', top: '78%' }} />
            </Demo>
          </div>
        </div>
      </section>
    </>
  )
}

function ProductSection() {
  return (
    <>
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
            <Demo name="chat" label="Démonstration : un message avec une mention, puis une tâche créée avec /tache" />
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
    </>
  )
}

function MoreSection() {
  return (
    <>
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
    </>
  )
}

function IntegrationsSection() {
  return (
    <>
      {/* Intégrations. */}
      <section className="k-section k-section-tight">
        <div className="k-wrap">
          <p className="k-kicker reveal">Intégrations</p>
          <h2 className="k-h2 reveal">Branché sur les outils que tu utilises déjà.</h2>
          <ul className="k-integ">
            {INTEGRATIONS.map((i) => (
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
  return (
    <>
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
    </>
  )
}

function StepsSection() {
  return (
    <>
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
    </>
  )
}

function PricingSection() {
  return (
    <>
      {/* Tarifs. */}
      <section id="tarifs" className="k-section">
        <div className="k-wrap">
          <p className="k-kicker reveal">Tarifs</p>
          <div className="k-price reveal">
            <div className="k-price-main">
              <h2 className="k-h2">Gratuit pendant la bêta.</h2>
              <p className="k-price-sub">Toutes les fonctions, pour toute l'équipe, sans carte bancaire.</p>
              <div className="k-price-tag"><b>0 €</b><span>par personne, par mois</span></div>
              <a className="k-btn k-btn-ink k-btn-lg" href={APP_URL}>Créer mon groupe</a>
            </div>
            <ul className="k-price-list">
              <li>Groupes et membres sans limite fixe</li>
              <li>Tableau, chat, liens et notifications Discord</li>
              <li>Web, téléphone et ordinateur</li>
              <li>Les nouvelles fonctions dès leur sortie</li>
              <li>Données hébergées dans l'Union européenne</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}

function RoadmapSection() {
  return (
    <>
      {/* Feuille de route. */}
      <section id="feuille-de-route" className="k-section k-section-tight">
        <div className="k-wrap">
          <p className="k-kicker reveal">Feuille de route</p>
          <h2 className="k-h2 reveal">Ce qui arrive dans Kollab.</h2>
          <div className="k-roadmap">
            {ROADMAP.map((col) => (
              <div key={col.when} className={`k-road ${col.color} reveal`}>
                <h3>{col.when}</h3>
                <ul>
                  {col.items.map((it) => <li key={it}>{it}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="k-road-more reveal"><a href="/nouveautes">Voir l'historique des versions →</a></p>
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
            <p className="k-kicker reveal">Questions fréquentes</p>
            <h2 className="k-h2 reveal">Tu te demandes peut-être…</h2>
          </div>
          <div className="k-faq">
            {FAQ.map((f) => (
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

function FinalSection() {
  return (
    <>
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
    </>
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

/** Raccourcis de l'accueil vers les autres pages. */
function TeaserSection() {
  const items = [
    { href: '/fonctionnalites', title: 'Toutes les fonctionnalités', text: 'Le tableau, le chat, les intégrations et ce qui arrive ensuite.', bg: 'k-bg-yellow' },
    { href: '/tarifs', title: 'Tarifs', text: 'Gratuit pendant la bêta, pour toute l’équipe.', bg: 'k-bg-mint' },
    { href: '/telecharger', title: 'Télécharger', text: 'Kollab sur Windows, macOS, Linux et téléphone.', bg: 'k-bg-lilac' },
  ]
  return (
    <section className="k-section k-section-tight">
      <div className="k-wrap k-teasers">
        {items.map((i) => (
          <a key={i.href} href={i.href} className={`k-teaser ${i.bg} reveal`}>
            <h3>{i.title}</h3>
            <p>{i.text}</p>
            <span className="k-teaser-go">Voir →</span>
          </a>
        ))}
      </div>
    </section>
  )
}

function HomePage() {
  return (
    <main>
      <HeroSection />
      <ProductSection />
      <TeaserSection />
      <FinalSection />
    </main>
  )
}

function FeaturesPage() {
  return (
    <main>
      <PageHead kicker="Fonctionnalités" title="Tout ce qu'il faut pour livrer à plusieurs." lead="Ce que Kollab fait déjà, les outils auxquels il se branche, et ce qui arrive ensuite." />
      <ProductSection />
      <MoreSection />
      <IntegrationsSection />
      <RoadmapSection />
      <FinalSection />
    </main>
  )
}

function PricingPage() {
  return (
    <main>
      <PageHead kicker="Tarifs" title="Simple : c'est gratuit." lead="Pendant toute la bêta, Kollab est gratuit pour toutes les équipes, sans limite de fonctions." />
      <PricingSection />
      <FaqSection />
      <FinalSection />
    </main>
  )
}

function DownloadPage() {
  return (
    <main>
      <PageHead kicker="Télécharger" title="Kollab, partout où tu travailles." lead="Dans le navigateur dès maintenant, sur téléphone en l'installant depuis le navigateur, et bientôt en app de bureau." />
      <DownloadSection />
      <StepsSection />
      <FinalSection />
    </main>
  )
}

function FaqPage() {
  return (
    <main>
      <PageHead kicker="Questions fréquentes" title="Les réponses aux questions qu'on nous pose." />
      <FaqSection />
      <FinalSection />
    </main>
  )
}

const AUDIENCES = [
  {
    bg: 'k-bg-yellow',
    who: 'Projets étudiants',
    title: "Le projet de fin d'année, sans le chaos.",
    story: "Quatre étudiants, six semaines, un rendu noté. Le sujet en PDF est rangé dans les liens, les tâches sont réparties en voyant la charge de chacun, et tout le monde sait qui fait quoi avant la soutenance.",
    points: ['Invitations par lien en 10 secondes', 'Charge visible pour éviter qu’un seul fasse tout', 'Gratuit, sans carte bancaire'],
  },
  {
    bg: 'k-bg-coral',
    who: 'Petites équipes de dev',
    title: 'Le sprint et les PR au même endroit.',
    story: "Une startup de cinq devs qui jonglait entre Trello, GitHub et Discord. Les PR s'affichent en cartes dans le chat, les tâches suivent le sprint, et les notifications arrivent dans le serveur Discord de l'équipe.",
    points: ['Cartes de PR dans les conversations', 'Notifications dans Discord', 'App sur ordinateur et téléphone'],
  },
  {
    bg: 'k-bg-mint',
    who: 'Associations tech',
    title: 'Des bénévoles qui avancent ensemble.',
    story: "Une asso qui organise un hackathon avec des bénévoles qui changent chaque année. Les rôles (admin, membre, invité en lecture seule) gardent l'organisation claire, et les nouveaux retrouvent tout dans l'historique.",
    points: ['Rôles et invités en lecture seule', 'Salons par sujet', 'Liens importants épinglés'],
  },
]

function AudiencePage() {
  return (
    <main>
      <PageHead kicker="Pour qui" title="Pensé pour les équipes qui codent ensemble." lead="De deux à quinze personnes, sur un projet court ou sur la durée. Trois exemples concrets." />
      <section className="k-section">
        <div className="k-wrap k-aud">
          {AUDIENCES.map((a) => (
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

type Cell = boolean | 'soon' | 'part'
const COMPARE: { feature: string; kollab: Cell; trello: Cell; jira: Cell; notion: Cell; discord: Cell }[] = [
  { feature: 'Tableau kanban', kollab: true, trello: true, jira: true, notion: true, discord: false },
  { feature: 'Attribution avec la charge de chacun', kollab: true, trello: false, jira: 'part', notion: false, discord: false },
  { feature: 'Chat d’équipe en direct', kollab: true, trello: false, jira: false, notion: 'part', discord: true },
  { feature: 'Cartes de PR GitHub dans le chat', kollab: true, trello: false, jira: false, notion: false, discord: 'part' },
  { feature: 'Relecture des PR', kollab: 'soon', trello: false, jira: false, notion: false, discord: false },
  { feature: 'Sprints et poker planning', kollab: 'soon', trello: false, jira: 'part', notion: false, discord: false },
  { feature: 'Documents à plusieurs', kollab: 'soon', trello: false, jira: false, notion: true, discord: false },
  { feature: 'Appels vocaux', kollab: 'soon', trello: false, jira: false, notion: false, discord: true },
  { feature: 'Gratuit pour toute l’équipe', kollab: true, trello: 'part', jira: 'part', notion: 'part', discord: true },
]
const TOOLS = [
  { key: 'kollab', label: 'Kollab' },
  { key: 'trello', label: 'Trello' },
  { key: 'jira', label: 'Jira' },
  { key: 'notion', label: 'Notion' },
  { key: 'discord', label: 'Discord' },
] as const

function Mark({ v }: { v: Cell }) {
  if (v === true) return <span className="k-mk yes" aria-label="Oui">✓</span>
  if (v === 'soon') return <span className="k-mk soon">Bientôt</span>
  if (v === 'part') return <span className="k-mk part" aria-label="En partie">En partie</span>
  return <span className="k-mk no" aria-label="Non">–</span>
}

function ComparePage() {
  return (
    <main>
      <PageHead kicker="Comparatif" title="Un seul outil à la place de quatre." lead="Beaucoup d'équipes combinent Trello ou Jira pour les tâches, Notion pour les docs et Discord pour parler. Kollab réunit l'essentiel." />
      <section className="k-section">
        <div className="k-wrap">
          <div className="k-compare reveal">
            <table>
              <thead>
                <tr>
                  <th scope="col">Fonction</th>
                  {TOOLS.map((t) => <th key={t.key} scope="col" className={t.key === 'kollab' ? 'me' : undefined}>{t.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((r) => (
                  <tr key={r.feature}>
                    <th scope="row">{r.feature}</th>
                    {TOOLS.map((t) => <td key={t.key} className={t.key === 'kollab' ? 'me' : undefined}><Mark v={r[t.key]} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="k-note reveal">
            « En partie » : disponible avec une extension, une offre payante ou de façon limitée. Comparatif établi en novembre 2026
            d'après les offres gratuites de chaque outil. Trello, Jira, Notion et Discord sont des marques de leurs propriétaires respectifs.
          </p>
        </div>
      </section>
      <FinalSection />
    </main>
  )
}

/** Pages du site, par chemin. */
const SEO = seo.pages as Record<string, { title: string; description: string }>
const PAGES: Record<string, () => ReactNode> = {
  '': () => <HomePage />,
  '/fonctionnalites': () => <FeaturesPage />,
  '/pour-qui': () => <AudiencePage />,
  '/comparatif': () => <ComparePage />,
  '/tarifs': () => <PricingPage />,
  '/telecharger': () => <DownloadPage />,
  '/nouveautes': () => <News />,
  '/faq': () => <FaqPage />,
}


type Release = { version: string; date: string; title: string; items: string[] }

function News() {
  const releases = changelog as Release[]
  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <main className="k-wrap k-news">
      <p className="k-kicker">Nouveautés</p>
      <h1 className="k-display k-display-sm">Ce qui a changé dans Kollab.</h1>
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
      <p className="k-road-more"><a href="/fonctionnalites#feuille-de-route">Voir ce qui arrive ensuite →</a></p>
    </main>
  )
}

export default function Site() {
  const path = window.location.pathname.replace(/\/+$/, '')
  const legal = findLegal(path)
  const key = PAGES[path] ? path : ''
  useReveal()
  useEffect(() => {
    const meta = SEO[key || '/'] ?? SEO['/']
    document.title = meta.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description)
  }, [key])
  return (
    <div className="site">
      <Header current={path} />
      {legal ? <main><LegalPage doc={legal} /></main> : PAGES[key]()}
      <Footer />
    </div>
  )
}
