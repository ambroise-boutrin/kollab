import type { ReactNode } from 'react'
import { CGU_VERSION, LEGAL_UPDATED } from '../lib/legal'

/**
 * Pages juridiques du site. Ce sont des MODÈLES : les passages entre crochets (composant <Fill>)
 * sont à compléter, et l'ensemble est à faire relire par un juriste avant une ouverture au public.
 */

const CONTACT = 'l’adresse de contact indiquée dans les mentions légales'

/** Information à compléter par l'éditeur du site. */
function Fill({ children }: { children: ReactNode }) {
  return <mark className="s-fill">[{children}]</mark>
}

export type LegalDoc = { path: string; title: string; short: string; sections: { h: string; body: ReactNode }[] }

export const LEGAL_DOCS: LegalDoc[] = [
  {
    path: '/mentions-legales',
    title: 'Mentions légales',
    short: 'Mentions légales',
    sections: [
      {
        h: 'Éditeur du site',
        body: (
          <>
            <p>Le site et le service Kollab sont édités par :</p>
            <ul>
              <li>Nom ou raison sociale : <Fill>prénom et nom, ou nom de la société</Fill></li>
              <li>Statut : <Fill>particulier, micro-entreprise, association, SAS…</Fill></li>
              <li>Adresse : <Fill>adresse postale</Fill></li>
              <li>Email de contact : <Fill>adresse email</Fill></li>
              <li>SIRET et numéro de TVA : <Fill>si applicable</Fill></li>
              <li>Directeur ou directrice de la publication : <Fill>prénom et nom</Fill></li>
            </ul>
            <p>
              Si l'éditeur est un particulier qui n'agit pas à titre professionnel, il peut ne publier que les coordonnées de
              l'hébergeur, à condition de lui avoir communiqué son identité (article 6 de la loi n° 2004-575 du 21 juin 2004
              pour la confiance dans l'économie numérique).
            </p>
          </>
        ),
      },
      {
        h: 'Hébergement',
        body: (
          <ul>
            <li>Site et application web : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis, vercel.com.</li>
            <li>Base de données, comptes et fichiers : Supabase Inc., supabase.com, serveurs situés à Paris (région UE eu-west-3).</li>
          </ul>
        ),
      },
      {
        h: 'Propriété intellectuelle',
        body: (
          <p>
            Le nom Kollab, le logo, les textes et les visuels de ce site sont protégés. Toute reproduction sans autorisation est
            interdite. Le code source est publié sur GitHub sous la licence indiquée dans le dépôt <Fill>préciser la licence</Fill>.
            Les contenus créés par les utilisateurs dans Kollab restent leur propriété.
          </p>
        ),
      },
      {
        h: 'Contact',
        body: <p>Pour toute question ou signalement de contenu illicite : <Fill>adresse email</Fill>.</p>,
      },
    ],
  },
  {
    path: '/cgu',
    title: "Conditions générales d'utilisation",
    short: 'CGU',
    sections: [
      {
        h: '1. Objet',
        body: (
          <p>
            Les présentes conditions générales d'utilisation (CGU) encadrent l'accès et l'utilisation de Kollab, service de
            gestion de projet collaboratif disponible sur le web, sur téléphone et sur ordinateur, édité par la personne indiquée
            dans les mentions légales (« l'éditeur »).
          </p>
        ),
      },
      {
        h: '2. Acceptation',
        body: (
          <p>
            La création d'un compte suppose l'acceptation des CGU, en cochant la case prévue à cet effet. La version acceptée et
            sa date sont conservées. Si tu n'acceptes pas les CGU, tu ne peux pas utiliser le service.
          </p>
        ),
      },
      {
        h: '3. Compte',
        body: (
          <>
            <p>
              Tu peux créer un compte avec une adresse email ou via GitHub, Google ou Discord. Tu dois avoir au moins 15 ans, ou
              l'accord d'un titulaire de l'autorité parentale. Tu es responsable de la confidentialité de tes identifiants et des
              actions faites depuis ton compte.
            </p>
            <p>Tu peux supprimer ton compte à tout moment depuis les Réglages ou en écrivant à {CONTACT}.</p>
          </>
        ),
      },
      {
        h: '4. Le service',
        body: (
          <p>
            Kollab permet notamment de gérer des tâches et des sprints, de discuter en groupe, de partager des liens et des
            documents, et de relier des outils tiers (GitHub, Discord). Certaines fonctions sont en cours de développement.
            Le service est fourni gratuitement, « en l'état », et peut évoluer, être interrompu pour maintenance ou arrêté.
            L'éditeur prévient les utilisateurs au moins 30 jours avant un arrêt définitif pour qu'ils puissent récupérer
            leurs données.
          </p>
        ),
      },
      {
        h: '5. Groupes et rôles',
        body: (
          <p>
            Un groupe est créé par un administrateur, qui invite les autres membres par lien ou par code et leur donne un rôle
            (administrateur, membre, invité en lecture seule). Les contenus d'un groupe sont visibles par tous ses membres.
            L'administrateur est responsable des personnes qu'il invite.
          </p>
        ),
      },
      {
        h: '6. Règles de conduite',
        body: (
          <>
            <p>En utilisant Kollab, tu t'engages à ne pas :</p>
            <ul>
              <li>publier de contenu illicite, haineux, harcelant, diffamatoire ou portant atteinte aux droits d'autrui ;</li>
              <li>partager des données personnelles de tiers sans droit de le faire ;</li>
              <li>tenter d'accéder aux données d'autres groupes, de perturber le service ou de le détourner (spam, logiciel malveillant) ;</li>
              <li>utiliser le service pour une activité contraire à la loi.</li>
            </ul>
            <p>
              L'éditeur peut retirer un contenu signalé comme illicite et suspendre ou supprimer un compte qui ne respecte pas ces
              règles, après avertissement sauf en cas de manquement grave.
            </p>
          </>
        ),
      },
      {
        h: '7. Contenus des utilisateurs',
        body: (
          <p>
            Tu restes propriétaire de ce que tu publies (tâches, messages, documents). Tu autorises l'éditeur à les héberger, les
            copier et les afficher aux membres de ton groupe, uniquement pour faire fonctionner le service.
          </p>
        ),
      },
      {
        h: '8. Services tiers',
        body: (
          <p>
            Quand tu relies GitHub, Google ou Discord, l'utilisation de ces services reste soumise à leurs propres conditions.
            Kollab n'accède qu'aux informations nécessaires aux fonctions que tu actives, et tu peux retirer ces liaisons à tout
            moment.
          </p>
        ),
      },
      {
        h: '9. Responsabilité',
        body: (
          <p>
            L'éditeur fait ses meilleurs efforts pour assurer la disponibilité et la sécurité du service, sans pouvoir les
            garantir. Il est conseillé de garder une copie des données importantes. Dans les limites autorisées par la loi,
            l'éditeur n'est pas responsable des dommages indirects liés à l'utilisation du service ni des contenus publiés par
            les utilisateurs.
          </p>
        ),
      },
      {
        h: '10. Données personnelles',
        body: (
          <p>
            Le traitement de tes données est décrit dans la <a href="/confidentialite">politique de confidentialité</a>, et
            l'usage du stockage local dans la <a href="/cookies">politique cookies</a>.
          </p>
        ),
      },
      {
        h: '11. Modification des CGU',
        body: (
          <p>
            Les CGU peuvent évoluer. En cas de changement important, tu es prévenu dans l'application et on te demande
            d'accepter la nouvelle version avant de continuer.
          </p>
        ),
      },
      {
        h: '12. Droit applicable',
        body: (
          <p>
            Les CGU sont soumises au droit français. En cas de litige, une solution amiable est recherchée en priorité en
            écrivant à {CONTACT}. À défaut, les tribunaux français sont compétents, sous réserve des règles protégeant les
            consommateurs.
          </p>
        ),
      },
    ],
  },
  {
    path: '/confidentialite',
    title: 'Politique de confidentialité',
    short: 'Confidentialité',
    sections: [
      {
        h: 'Responsable du traitement',
        body: (
          <p>
            Le responsable du traitement est l'éditeur indiqué dans les <a href="/mentions-legales">mentions légales</a> :{' '}
            <Fill>nom</Fill>, joignable à <Fill>adresse email</Fill>.
          </p>
        ),
      },
      {
        h: 'Données collectées',
        body: (
          <ul>
            <li><strong>Compte</strong> : adresse email, nom affiché, photo de profil, identifiants des comptes reliés (GitHub, Google, Discord).</li>
            <li><strong>Contenus</strong> : groupes, tâches, messages, liens, documents et fichiers que tu ajoutes.</li>
            <li><strong>Données techniques</strong> : journaux de connexion et d'erreurs (adresse IP, date, navigateur), conservés pour la sécurité.</li>
            <li><strong>GitHub</strong> : si tu relies ton compte, les informations de dépôts et de PR nécessaires aux fonctions que tu utilises.</li>
            <li><strong>Nouveautés par email</strong> : si tu t'inscris depuis le site, ton adresse email et la page où tu t'es inscrit.</li>
            <li><strong>Statistiques du site</strong> : pages vues, pays, type d'appareil et site d'origine, de façon anonyme et sans cookie (Vercel Web Analytics).</li>
          </ul>
        ),
      },
      {
        h: 'Pourquoi et sur quelle base',
        body: (
          <ul>
            <li>Fournir le service (compte, groupes, chat, tableau) : exécution du contrat, c'est-à-dire les CGU.</li>
            <li>Sécuriser le service et prévenir les abus : intérêt légitime de l'éditeur.</li>
            <li>Envoyer les emails de connexion et les notifications que tu actives : exécution du contrat.</li>
            <li>Envoyer les nouveautés aux personnes inscrites : consentement, retirable à tout moment.</li>
            <li>Mesurer l'audience du site de présentation de façon anonyme : intérêt légitime de l'éditeur.</li>
            <li>Répondre aux obligations légales (conservation des données de connexion, réquisitions) : obligation légale.</li>
          </ul>
        ),
      },
      {
        h: 'Durée de conservation',
        body: (
          <ul>
            <li>Données du compte et contenus : tant que le compte existe, puis suppression sous 30 jours après sa suppression.</li>
            <li>Compte inactif depuis 3 ans : prévenu par email, puis supprimé.</li>
            <li>Journaux techniques : 12 mois au plus.</li>
            <li>Adresse inscrite aux nouveautés : jusqu'à ta désinscription, ou 3 ans sans ouverture d'email.</li>
            <li>Les messages publiés dans un groupe peuvent rester visibles par le groupe sous forme anonymisée après ton départ.</li>
          </ul>
        ),
      },
      {
        h: 'Destinataires et sous-traitants',
        body: (
          <>
            <p>Les données ne sont ni vendues ni utilisées pour de la publicité. Elles sont accessibles aux membres de ton groupe et aux prestataires suivants, pour le fonctionnement du service :</p>
            <ul>
              <li>Supabase : base de données, authentification et stockage des fichiers, hébergés dans l'Union européenne (Paris).</li>
              <li>Vercel : hébergement du site et de l'application web, et statistiques de visite anonymes du site de présentation (Vercel Web Analytics, sans cookie).</li>
              <li>GitHub, Google et Discord : connexion et intégrations, seulement si tu les relies ou les actives.</li>
              <li>LiveKit : appels vocaux et vidéo, quand cette fonction sera disponible.</li>
              <li><Fill>service d'envoi d'emails, si différent de Supabase</Fill></li>
            </ul>
            <p>
              Certains de ces prestataires sont situés aux États-Unis. Les transferts sont encadrés par le cadre de protection
              des données UE–États-Unis (Data Privacy Framework) ou par les clauses contractuelles types de la Commission
              européenne.
            </p>
          </>
        ),
      },
      {
        h: 'Tes droits',
        body: (
          <>
            <p>
              Tu disposes d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de
              tes données, et tu peux définir des directives sur leur sort après ton décès. Pour les exercer, écris à{' '}
              <Fill>adresse email</Fill>. Une réponse est apportée sous un mois.
            </p>
            <p>
              Tu peux aussi introduire une réclamation auprès de la CNIL (cnil.fr, 3 place de Fontenoy, TSA 80715, 75334 Paris
              Cedex 07).
            </p>
          </>
        ),
      },
      {
        h: 'Sécurité',
        body: (
          <p>
            Les échanges sont chiffrés (HTTPS). L'accès aux données est limité par groupe grâce à des règles de sécurité dans la
            base de données. Les mots de passe ne sont jamais stockés en clair.
          </p>
        ),
      },
    ],
  },
  {
    path: '/cookies',
    title: 'Cookies et stockage local',
    short: 'Cookies',
    sections: [
      {
        h: 'Ce que Kollab utilise',
        body: (
          <>
            <p>
              Kollab n'utilise aucun cookie publicitaire et aucun traceur tiers. Les polices sont hébergées par Kollab lui-même.
              Le site de présentation compte ses visites avec Vercel Web Analytics, un outil qui ne dépose aucun cookie, ne
              stocke rien sur ton appareil et ne permet pas de te suivre d'un site à l'autre (voir ci-dessous).
            </p>
            <p>Le site et l'application utilisent uniquement le stockage local du navigateur, pour :</p>
            <ul>
              <li>garder ta session ouverte une fois connecté ;</li>
              <li>retenir tes préférences, comme le thème et la couleur choisis ;</li>
              <li>faire fonctionner l'application hors ligne (fichiers mis en cache).</li>
            </ul>
          </>
        ),
      },
      {
        h: 'Pourquoi aucun bandeau de consentement',
        body: (
          <>
            <p>
              Ces éléments sont strictement nécessaires au service que tu demandes. Ils sont donc dispensés de consentement
              (article 82 de la loi Informatique et Libertés et lignes directrices de la CNIL).
            </p>
            <p>
              La mesure d'audience du site ne lit ni n'écrit rien sur ton appareil : elle compte les pages vues de façon
              anonyme et agrégée, à partir d'un identifiant calculé côté serveur et renouvelé chaque jour. Elle ne sert qu'à
              des statistiques du site de présentation et ne tourne pas dans l'application. Si Kollab ajoute un jour un service
              tiers non essentiel qui dépose un traceur, un bandeau te demandera ton accord avant tout dépôt.
            </p>
          </>
        ),
      },
      {
        h: 'Les supprimer',
        body: (
          <p>
            Tu peux effacer ces données à tout moment depuis les réglages de ton navigateur (données de site). Tu seras alors
            déconnecté et tes préférences reviendront à leurs valeurs par défaut.
          </p>
        ),
      },
    ],
  },
]

export function findLegal(pathname: string): LegalDoc | undefined {
  const p = pathname.replace(/\/+$/, '') || '/'
  return LEGAL_DOCS.find((d) => d.path === p)
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <article className="s-wrap s-legal">
      <nav className="s-legal-tabs" aria-label="Pages juridiques">
        {LEGAL_DOCS.map((d) => (
          <a key={d.path} href={d.path} aria-current={d.path === doc.path ? 'page' : undefined}>{d.short}</a>
        ))}
      </nav>
      <h1>{doc.title}</h1>
      <p className="s-legal-meta">
        Dernière mise à jour : {LEGAL_UPDATED}
        {doc.path === '/cgu' && ` · version ${CGU_VERSION}`}
      </p>
      {doc.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.body}
        </section>
      ))}
    </article>
  )
}
