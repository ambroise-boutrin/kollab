import { useEffect, useState, type ReactNode } from 'react'
import { LogoMark } from '../components/Logo'
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

const DOWNLOADS = [
  { os: 'windows', name: 'Windows', detail: 'Windows 10 et 11, installeur .exe', icon: 'M3 5.5 10 4.5v7H3zM11 4.4 21 3v8.5H11zM3 12.5h7v7l-7-1zM11 12.5h10V21l-10-1.4z' },
  { os: 'mac', name: 'macOS', detail: 'Puces Apple et Intel, fichier .dmg', icon: 'M15.5 3c.2 1.3-.4 2.6-1.2 3.4-.8.9-2 1.5-3.1 1.4-.2-1.2.4-2.5 1.2-3.3.8-.9 2.1-1.5 3.1-1.5zM19 16.6c-.5 1.2-.8 1.7-1.5 2.8-1 1.5-2.3 3.3-4 3.3-1.5 0-1.9-1-3.9-1s-2.5 1-4 1c-1.7 0-2.9-1.6-3.9-3.1C-1 15.4.3 9.6 3.4 8.6c1.3-.4 2.7.5 3.6.5.9 0 2.3-.8 3.9-.6.7 0 2.6.3 3.8 2-3.3 1.9-2.8 6.6.3 6.1z' },
  { os: 'linux', name: 'Linux', detail: 'AppImage et paquet .deb', icon: 'M12 3c-2.2 0-3.5 1.8-3.5 4.5 0 1.4.2 2.2-.6 3.6C6.6 13.2 5 15.4 5 17.5c0 1 .5 1.6 1.4 1.9L9 20.5c.9.4 2 .5 3 .5s2.1-.1 3-.5l2.6-1.1c.9-.3 1.4-.9 1.4-1.9 0-2.1-1.6-4.3-2.9-6.4-.8-1.4-.6-2.2-.6-3.6C15.5 4.8 14.2 3 12 3zM10.5 8h.01M13.5 8h.01M10.5 10.5c.9.6 2.1.6 3 0' },
] as const

function detectOs(): string {
  const ua = navigator.userAgent
  if (/Windows/i.test(ua)) return 'windows'
  if (/Mac OS X|Macintosh/i.test(ua) && !/iPhone|iPad/i.test(ua)) return 'mac'
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return 'linux'
  return ''
}
const YEAR = new Date().getFullYear()

type Feature = { title: string; text: string; icon: string; color: string; soon?: boolean }

const FEATURES: Feature[] = [
  {
    title: 'Relecture des PR GitHub',
    text: 'Diff, commentaires par ligne, approbation et fusion sans quitter Kollab. La tâche passe en « Terminé » quand sa PR est fusionnée.',
    icon: 'M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9c0 6-12 3-12 9',
    color: '#5546E0',
    soon: true,
  },
  {
    title: 'Scrum et kanban',
    text: 'Glisse les tâches entre les colonnes, attribue-les en voyant la charge de chacun, estime en points.',
    icon: 'M4 4h5v16H4zM10.5 4h5v10h-5zM17 4h3v7h-3z',
    color: '#7C5CF5',
  },
  {
    title: 'Poker planning',
    text: "Chacun vote son estimation en même temps, les cartes se retournent ensemble, l'équipe tombe d'accord.",
    icon: 'M7 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM11 9l1.5 2.5L11 14l-1.5-2.5z',
    color: '#C2410C',
    soon: true,
  },
  {
    title: 'Chat et vocal',
    text: 'Des salons pour le groupe, les mentions @, les cartes de PR dans la discussion, et bientôt des appels vocaux.',
    icon: 'M4 5h16v11H9l-5 4z',
    color: '#2E7D4F',
  },
  {
    title: 'Édition en direct',
    text: "Écris les specs et les comptes rendus à plusieurs, en voyant le curseur des autres s'afficher en temps réel.",
    icon: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    color: '#1F5FC4',
    soon: true,
  },
  {
    title: 'PDF partagés',
    text: "Ouvre le cahier des charges ou le sujet dans un panneau, à côté du tableau, et annote-le avec l'équipe.",
    icon: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
    color: '#B5462E',
    soon: true,
  },
  {
    title: 'Relié à Discord',
    text: "Les nouvelles tâches, PR et mentions arrivent dans ton serveur Discord, pour que personne ne rate l'essentiel.",
    icon: 'M8 9h.01M16 9h.01M5 5c4-2 10-2 14 0 2 4 2 9 0 13-1.5 1-3 1.6-4 2l-1-2c-1.3.3-2.7.3-4 0l-1 2c-1-.4-2.5-1-4-2-2-4-2-9 0-13z',
    color: '#5865F2',
  },
  {
    title: 'Liens importants',
    text: 'Le dépôt, la maquette, le drive, la doc : tout ce que le groupe cherche tout le temps, rangé au même endroit.',
    icon: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    color: '#0E7C86',
  },
]

const STEPS = [
  { title: 'Connecte-toi', text: 'Avec GitHub, Google, Discord ou un simple lien par email.' },
  { title: 'Invite ton équipe', text: 'Partage le lien du groupe. Chacun arrive directement au bon endroit.' },
  { title: 'Lance le sprint', text: 'Crée les tâches, attribue-les, et suis tout depuis le tableau et le chat.' },
]

function Svg({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
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

function Shot({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`shot ${className}`}>
      <img src={src} alt={alt} loading="lazy" decoding="async" />
    </div>
  )
}

function Section({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`s-section ${className}`}>
      <div className="s-wrap">{children}</div>
    </section>
  )
}

export default function Site() {
  useReveal()
  const [os] = useState(detectOs)
  useEffect(() => {
    document.title = 'Kollab : gestion de projet et revues de code pour équipes de dev'
  }, [])

  return (
    <div className="site">
      <header className="s-header">
        <div className="s-wrap s-header-row">
          <a href="/" className="s-brand" aria-label="Kollab, accueil">
            <LogoMark size={30} />
            Kollab
          </a>
          <nav className="s-nav" aria-label="Sections">
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#equipe">En équipe</a>
            <a href="#partout">Partout</a>
            <a href="#telecharger">Télécharger</a>
          </nav>
          <div className="s-header-cta">
            <a className="btn soft small" href={APP_URL}>Connexion</a>
            <a className="btn small s-try" href={APP_URL}>Essayer</a>
          </div>
        </div>
      </header>

      <main>
        <section className="s-hero">
          <div className="s-wrap">
            <div className="s-hero-text">
              <span className="s-pill fade-in">Pour les équipes de développement</span>
              <h1 className="fade-in d1">Le code, les sprints et l'équipe au même endroit.</h1>
              <p className="s-lead fade-in d2">
                Kollab réunit la relecture des PR GitHub, le tableau Scrum et le chat de groupe. Moins d'onglets, moins de
                messages perdus, plus de temps pour coder.
              </p>
              <div className="s-hero-cta fade-in d3">
                <a className="btn s-big s-try" href={APP_URL}>Essayer Kollab</a>
                <a className="btn soft s-big" href={APP_URL}>J'ai déjà un compte</a>
              </div>
              <p className="s-note fade-in d3">Sans installation, directement dans le navigateur.</p>
            </div>
            <Shot className="s-hero-shot fade-in d2" src="/vitrine/tableau-attribution.png" alt="Le tableau kanban de Kollab avec le panneau d'attribution d'une tâche" />
          </div>
        </section>

        <Section id="fonctionnalites">
          <div className="s-head reveal">
            <h2>Tout ce qu'il faut pour livrer à plusieurs</h2>
            <p>Les outils dont une équipe de dev a besoin au quotidien, pensés pour marcher ensemble.</p>
          </div>
          <div className="s-features">
            {FEATURES.map((f) => (
              <article key={f.title} className="s-feature reveal">
                <div className="s-ico" style={{ color: f.color, background: `color-mix(in srgb, ${f.color} 12%, transparent)` }}>
                  <Svg d={f.icon} />
                </div>
                <h3>
                  {f.title}
                  {f.soon && <span className="s-soon">Bientôt</span>}
                </h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section id="equipe" className="s-alt">
          <div className="s-split">
            <div className="s-split-text reveal">
              <h2>Une discussion qui reste liée au travail</h2>
              <p>
                Mentionne un coéquipier, colle le lien d'une PR et elle s'affiche en carte, crée une tâche avec <code>/tache</code>{' '}
                sans quitter la conversation. Les messages arrivent en direct chez tout le monde.
              </p>
              <ul className="s-list">
                <li>Salons par sujet et mentions @</li>
                <li>Présence en ligne de chaque membre</li>
                <li>Notifications envoyées sur Discord</li>
              </ul>
            </div>
            <Shot className="reveal" src="/vitrine/chat.png" alt="Le chat de groupe de Kollab avec des mentions et une carte de PR" />
          </div>
        </Section>

        <Section id="partout">
          <div className="s-split s-split-rev">
            <div className="s-split-text reveal">
              <h2>Sur ordinateur comme sur téléphone</h2>
              <p>
                Kollab marche dans le navigateur, s'installe sur le téléphone comme une vraie app, et se télécharge sur ordinateur.
                Tes tâches et tes messages te suivent partout.
              </p>
              <div className="s-platforms">
                <span>Web</span>
                <span>iPhone et Android</span>
                <a href="#telecharger">Windows, macOS, Linux</a>
              </div>
            </div>
            <div className="s-phone reveal">
              <img src="/vitrine/telephone-accueil.png" alt="L'accueil de Kollab sur téléphone" loading="lazy" decoding="async" />
            </div>
          </div>

          <div id="telecharger" className="s-download">
            <div className="s-head reveal">
              <h2>Télécharger l'app de bureau</h2>
              <p>
                Kollab dans sa propre fenêtre, avec ses raccourcis et ses notifications.
                {!DESKTOP_READY && ' Les installeurs arrivent bientôt : en attendant, Kollab marche déjà dans le navigateur.'}
              </p>
            </div>
            <div className="s-dl-grid">
              {DOWNLOADS.map((d) => {
                const mine = d.os === os
                const body = (
                  <>
                    <span className="s-dl-ico"><Svg d={d.icon} size={26} /></span>
                    <span className="s-dl-text">
                      <strong>
                        {d.name}
                        {mine && <span className="s-mine">Ton système</span>}
                      </strong>
                      <span>{d.detail}</span>
                    </span>
                    <span className={DESKTOP_READY ? 's-dl-go' : 's-soon'}>{DESKTOP_READY ? 'Télécharger' : 'Bientôt'}</span>
                  </>
                )
                return DESKTOP_READY ? (
                  <a key={d.os} className={`s-dl reveal${mine ? ' mine' : ''}`} href={RELEASES_URL} target="_blank" rel="noreferrer">{body}</a>
                ) : (
                  <div key={d.os} className={`s-dl reveal off${mine ? ' mine' : ''}`} aria-disabled="true">{body}</div>
                )
              })}
            </div>
          </div>
        </Section>

        <Section className="s-alt">
          <div className="s-head reveal">
            <h2>Prêt en trois minutes</h2>
          </div>
          <ol className="s-steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="reveal">
                <span className="s-num">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section>
          <div className="s-final reveal">
            <LogoMark size={56} />
            <h2>Lance ton prochain sprint sur Kollab</h2>
            <p>Crée ton groupe, invite ton équipe et retrouvez tout au même endroit.</p>
            <div className="s-hero-cta">
              <a className="btn s-big s-light" href={APP_URL}>Essayer gratuitement</a>
              {DISCORD_URL && (
                <a className="btn s-big s-ghost" href={DISCORD_URL} target="_blank" rel="noreferrer">Rejoindre le Discord</a>
              )}
            </div>
          </div>
        </Section>
      </main>

      <footer className="s-footer">
        <div className="s-wrap s-footer-row">
          <a href="/" className="s-brand small">
            <LogoMark size={22} />
            Kollab
          </a>
          <nav aria-label="Liens du pied de page">
            <a href={APP_URL}>Ouvrir l'app</a>
            <a href="https://github.com/ambroise-boutrin/kollab" target="_blank" rel="noreferrer">GitHub</a>
            {DISCORD_URL && <a href={DISCORD_URL} target="_blank" rel="noreferrer">Discord</a>}
          </nav>
          <span className="muted">© {YEAR} Kollab</span>
        </div>
      </footer>
    </div>
  )
}
