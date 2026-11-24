import type { ReactNode } from 'react'
import { CGU_VERSION, CGV_VERSION, LEGAL_UPDATED, LEGAL_UPDATED_EN } from '../lib/legal'
import type { Lang } from './copy'

/**
 * Pages juridiques du site, en français et en anglais. La version française fait foi.
 * Éditeur : la micro-entreprise d'Ambroise Boutrin (mêmes informations que ambroise-boutrin.fr).
 */

const EMAIL = 'contact@ambroise-boutrin.fr'
const Mail = () => <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
const ADDRESS = '1 rue Saint-Martin du Mail, 45000 Orléans, France'

/** Information encore à compléter par l'éditeur. */
function Fill({ children }: { children: ReactNode }) {
  return <mark className="s-fill">[{children}]</mark>
}

export type LegalDoc = { key: string; path: string; title: string; short: string; sections: { h: string; body: ReactNode }[] }

const FR: LegalDoc[] = [
  {
    key: 'mentions',
    path: '/mentions-legales',
    title: 'Mentions légales',
    short: 'Mentions légales',
    sections: [
      {
        h: 'Éditeur',
        body: (
          <ul>
            <li>Kollab est édité par Ambroise Boutrin, entrepreneur individuel (micro-entreprise).</li>
            <li>SIRET : 101 033 504 00016</li>
            <li>TVA non applicable, art. 293 B du CGI</li>
            <li>Adresse : {ADDRESS}</li>
            <li>Email : <Mail /></li>
            <li>Téléphone : 07 59 87 83 34</li>
            <li>Directeur de la publication : Ambroise Boutrin</li>
          </ul>
        ),
      },
      {
        h: 'Hébergement',
        body: (
          <ul>
            <li>Site et application web : Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis, vercel.com.</li>
            <li>Base de données, comptes et fichiers : Supabase Inc., supabase.com, serveurs à Paris (UE).</li>
          </ul>
        ),
      },
      {
        h: 'Propriété intellectuelle',
        body: (
          <p>
            Le nom Kollab, le logo, les textes, les visuels et le code source appartiennent à l'éditeur. Toute reproduction
            sans autorisation écrite est interdite. Les contenus créés par les utilisateurs restent leur propriété.
          </p>
        ),
      },
      {
        h: 'Contact',
        body: <p>Question ou signalement de contenu illicite : <Mail />.</p>,
      },
    ],
  },
  {
    key: 'cgu',
    path: '/cgu',
    title: "Conditions générales d'utilisation",
    short: 'CGU',
    sections: [
      {
        h: '1. Objet',
        body: (
          <p>
            Les présentes conditions générales d'utilisation (CGU) encadrent l'utilisation de Kollab, service de gestion de
            projet collaboratif sur le web, le téléphone et l'ordinateur, édité par Ambroise Boutrin (« l'éditeur », voir les{' '}
            <a href="/mentions-legales">mentions légales</a>).
          </p>
        ),
      },
      {
        h: '2. Acceptation',
        body: (
          <p>
            Créer un compte suppose d'accepter les CGU, en cochant la case prévue. La version acceptée et sa date sont
            conservées. Si tu ne les acceptes pas, tu ne peux pas utiliser le service.
          </p>
        ),
      },
      {
        h: '3. Compte',
        body: (
          <>
            <p>
              Tu peux créer un compte avec une adresse email ou via GitHub, Google ou Discord. Tu dois avoir au moins 15 ans, ou
              l'accord d'un titulaire de l'autorité parentale. Tu es responsable de tes identifiants et des actions faites
              depuis ton compte.
            </p>
            <p>Tu peux supprimer ton compte à tout moment depuis les Réglages ou en écrivant à <Mail />.</p>
          </>
        ),
      },
      {
        h: '4. Le service',
        body: (
          <p>
            Kollab permet de gérer des tâches et des sprints, de discuter en groupe, de partager des liens et des documents, et
            de relier des outils tiers (GitHub, Discord). Certaines fonctions sont en cours de développement. Le service est
            gratuit pendant la bêta ; les offres payantes sont régies par les <a href="/cgv">conditions générales de vente</a>.
            Le service peut évoluer ou être interrompu pour maintenance. En cas d'arrêt définitif, l'éditeur prévient au moins
            30 jours avant pour que chacun récupère ses données.
          </p>
        ),
      },
      {
        h: '5. Groupes et rôles',
        body: (
          <p>
            Un groupe est créé par un administrateur, qui invite les membres et leur donne un rôle (administrateur, membre,
            invité en lecture seule). Les contenus d'un groupe sont visibles par tous ses membres. L'administrateur est
            responsable des personnes qu'il invite.
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
              <li>tenter d'accéder aux données d'autres groupes, perturber ou détourner le service (spam, logiciel malveillant) ;</li>
              <li>utiliser le service pour une activité illégale.</li>
            </ul>
            <p>
              L'éditeur peut retirer un contenu signalé comme illicite et suspendre ou supprimer un compte qui ne respecte pas
              ces règles, après avertissement sauf manquement grave.
            </p>
          </>
        ),
      },
      {
        h: '7. Contenus des utilisateurs',
        body: (
          <p>
            Tu restes propriétaire de ce que tu publies. Tu autorises l'éditeur à l'héberger, le copier et l'afficher aux
            membres de ton groupe, uniquement pour faire fonctionner le service.
          </p>
        ),
      },
      {
        h: '8. Services tiers',
        body: (
          <p>
            Quand tu relies GitHub, Google ou Discord, leurs propres conditions s'appliquent. Kollab n'accède qu'aux
            informations nécessaires aux fonctions que tu actives, et tu peux retirer ces liaisons à tout moment.
          </p>
        ),
      },
      {
        h: '9. Responsabilité',
        body: (
          <p>
            L'éditeur fait ses meilleurs efforts pour la disponibilité et la sécurité du service, sans pouvoir les garantir.
            Garde une copie de tes données importantes. Dans les limites de la loi, l'éditeur n'est pas responsable des
            dommages indirects ni des contenus publiés par les utilisateurs.
          </p>
        ),
      },
      {
        h: '10. Données personnelles',
        body: (
          <p>
            Voir la <a href="/confidentialite">politique de confidentialité</a> et la <a href="/cookies">politique cookies</a>.
          </p>
        ),
      },
      {
        h: '11. Modification des CGU',
        body: (
          <p>
            Les CGU peuvent évoluer. En cas de changement important, tu es prévenu dans l'application et la nouvelle version
            t'est soumise.
          </p>
        ),
      },
      {
        h: '12. Droit applicable',
        body: (
          <p>
            Droit français. En cas de litige, écris d'abord à <Mail /> pour une solution amiable. À défaut, les tribunaux
            français sont compétents, sous réserve des règles protégeant les consommateurs.
          </p>
        ),
      },
    ],
  },
  {
    key: 'cgv',
    path: '/cgv',
    title: 'Conditions générales de vente',
    short: 'CGV',
    sections: [
      {
        h: '1. Objet',
        body: (
          <p>
            Les présentes conditions générales de vente (CGV) s'appliquent aux abonnements payants à Kollab, vendus par Ambroise
            Boutrin, entrepreneur individuel, SIRET 101 033 504 00016, {ADDRESS}. Elles complètent les{' '}
            <a href="/cgu">CGU</a>. Pendant la bêta, Kollab est gratuit : les CGV s'appliquent dès qu'une offre payante est
            souscrite.
          </p>
        ),
      },
      {
        h: '2. Offres et prix',
        body: (
          <p>
            Les offres et leurs prix sont indiqués sur la page <a href="/tarifs">Tarifs</a>, en euros. TVA non applicable,
            art. 293 B du CGI : le prix affiché est le prix payé. Le prix applicable est celui affiché au moment de la
            souscription.
          </p>
        ),
      },
      {
        h: '3. Souscription et paiement',
        body: (
          <p>
            L'abonnement se souscrit dans l'application, par un administrateur du groupe. Le paiement se fait d'avance, par
            carte bancaire, via un prestataire de paiement sécurisé : Kollab ne voit ni ne conserve tes numéros de carte. Une
            facture est envoyée par email à chaque paiement.
          </p>
        ),
      },
      {
        h: '4. Durée et renouvellement',
        body: (
          <p>
            L'abonnement est mensuel ou annuel selon l'offre choisie. Il se renouvelle automatiquement pour la même durée. Pour
            un abonnement annuel, tu es prévenu par email au moins un mois avant le renouvellement.
          </p>
        ),
      },
      {
        h: '5. Résiliation',
        body: (
          <p>
            Tu peux résilier à tout moment, en quelques clics depuis les Réglages ou en écrivant à <Mail />. La résiliation
            prend effet à la fin de la période payée ; le groupe repasse alors sur l'offre gratuite. En cas d'impayé, l'accès
            aux fonctions payantes est suspendu après un rappel resté sans réponse 15 jours.
          </p>
        ),
      },
      {
        h: '6. Droit de rétractation',
        body: (
          <p>
            Si tu es un consommateur, tu as 14 jours après la souscription pour changer d'avis, sans justification. Écris à{' '}
            <Mail /> : tu es remboursé intégralement sous 14 jours, avec le même moyen de paiement.
          </p>
        ),
      },
      {
        h: '7. Données',
        body: (
          <p>
            Tes données restent à toi. Après une résiliation, elles restent accessibles avec l'offre gratuite, et tu peux les
            exporter ou supprimer ton compte à tout moment.
          </p>
        ),
      },
      {
        h: '8. Garanties et responsabilité',
        body: (
          <p>
            Les consommateurs bénéficient de la garantie légale de conformité des services numériques (articles L224-25-12 et
            suivants du Code de la consommation). Pour un client professionnel, la responsabilité de l'éditeur est limitée aux
            sommes payées sur les 12 derniers mois.
          </p>
        ),
      },
      {
        h: '9. Médiation et litiges',
        body: (
          <p>
            En cas de litige, écris d'abord à <Mail />. Si aucune solution n'est trouvée, un consommateur peut saisir
            gratuitement le médiateur de la consommation : <Fill>nom et site du médiateur</Fill>. Droit français ; à défaut
            d'accord, les tribunaux français sont compétents.
          </p>
        ),
      },
    ],
  },
  {
    key: 'confidentialite',
    path: '/confidentialite',
    title: 'Politique de confidentialité',
    short: 'Confidentialité',
    sections: [
      {
        h: 'Responsable du traitement',
        body: (
          <p>
            Ambroise Boutrin, éditeur de Kollab (voir les <a href="/mentions-legales">mentions légales</a>), joignable à{' '}
            <Mail />.
          </p>
        ),
      },
      {
        h: 'Données collectées',
        body: (
          <ul>
            <li><strong>Compte</strong> : adresse email, nom affiché, photo de profil, identifiants des comptes reliés (GitHub, Google, Discord).</li>
            <li><strong>Contenus</strong> : groupes, tâches, messages, liens, documents et fichiers que tu ajoutes.</li>
            <li><strong>Données techniques</strong> : journaux de connexion et d'erreurs (adresse IP, date, navigateur), pour la sécurité.</li>
            <li><strong>GitHub</strong> : si tu relies ton compte, les informations de dépôts et de PR nécessaires aux fonctions utilisées.</li>
            <li><strong>Abonnement</strong> : si tu paies, les factures et l'état du paiement (les numéros de carte restent chez le prestataire de paiement).</li>
            <li><strong>Nouveautés par email</strong> : si tu t'inscris depuis le site, ton adresse et la page d'inscription.</li>
            <li><strong>Statistiques du site</strong> : pages vues, pays, appareil et site d'origine, anonymes et sans cookie (Vercel Web Analytics).</li>
          </ul>
        ),
      },
      {
        h: 'Pourquoi et sur quelle base',
        body: (
          <ul>
            <li>Fournir le service et gérer l'abonnement : exécution du contrat (CGU et CGV).</li>
            <li>Sécuriser le service et prévenir les abus : intérêt légitime.</li>
            <li>Envoyer les emails de connexion et les notifications que tu actives : exécution du contrat.</li>
            <li>Envoyer les nouveautés aux inscrits : consentement, retirable à tout moment.</li>
            <li>Mesurer l'audience du site de façon anonyme : intérêt légitime.</li>
            <li>Conserver les factures et répondre aux réquisitions : obligation légale.</li>
          </ul>
        ),
      },
      {
        h: 'Durée de conservation',
        body: (
          <ul>
            <li>Compte et contenus : tant que le compte existe, puis suppression sous 30 jours.</li>
            <li>Compte inactif depuis 3 ans : prévenu par email, puis supprimé.</li>
            <li>Journaux techniques : 12 mois au plus.</li>
            <li>Factures : 10 ans (obligation comptable).</li>
            <li>Adresse inscrite aux nouveautés : jusqu'à la désinscription, ou 3 ans sans ouverture.</li>
            <li>Les messages publiés dans un groupe peuvent y rester, anonymisés, après ton départ.</li>
          </ul>
        ),
      },
      {
        h: 'Destinataires et sous-traitants',
        body: (
          <>
            <p>Les données ne sont ni vendues ni utilisées pour de la publicité. Elles sont visibles par les membres de ton groupe et traitées par :</p>
            <ul>
              <li>Supabase : base de données, comptes et fichiers, hébergés dans l'UE (Paris).</li>
              <li>Vercel : hébergement du site et de l'application, statistiques anonymes du site.</li>
              <li>Resend : envoi des emails (activation, invitations, résumés).</li>
              <li>GitHub, Google et Discord : connexion et intégrations, seulement si tu les relies.</li>
              <li>LiveKit : appels vocaux et vidéo.</li>
              <li>Le prestataire de paiement, seulement si tu souscris une offre payante.</li>
            </ul>
            <p>
              Certains sont situés aux États-Unis. Les transferts sont encadrés par le Data Privacy Framework UE–États-Unis ou
              par les clauses contractuelles types de la Commission européenne.
            </p>
          </>
        ),
      },
      {
        h: 'Tes droits',
        body: (
          <>
            <p>
              Tu peux accéder à tes données, les rectifier, les effacer, en limiter l'usage, t'y opposer, les récupérer, et
              définir leur sort après ton décès. Écris à <Mail /> : réponse sous un mois.
            </p>
            <p>Tu peux aussi saisir la CNIL (cnil.fr, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07).</p>
          </>
        ),
      },
      {
        h: 'Sécurité',
        body: (
          <p>
            Les échanges sont chiffrés (HTTPS). L'accès aux données est limité par groupe grâce à des règles de sécurité dans la
            base. Les mots de passe ne sont jamais stockés en clair.
          </p>
        ),
      },
    ],
  },
  {
    key: 'cookies',
    path: '/cookies',
    title: 'Cookies et stockage local',
    short: 'Cookies',
    sections: [
      {
        h: 'Ce que Kollab utilise',
        body: (
          <>
            <p>
              Aucun cookie publicitaire, aucun traceur tiers. Les polices sont hébergées par Kollab. Le site compte ses visites
              avec Vercel Web Analytics, qui ne dépose aucun cookie et ne te suit pas d'un site à l'autre.
            </p>
            <p>Le site et l'application utilisent seulement le stockage local du navigateur, pour :</p>
            <ul>
              <li>garder ta session ouverte ;</li>
              <li>retenir tes préférences (thème, couleur) ;</li>
              <li>fonctionner hors ligne (fichiers en cache).</li>
            </ul>
          </>
        ),
      },
      {
        h: 'Pourquoi aucun bandeau',
        body: (
          <p>
            Ces éléments sont strictement nécessaires au service demandé, donc dispensés de consentement (article 82 de la loi
            Informatique et Libertés). La mesure d'audience ne lit ni n'écrit rien sur ton appareil et ne tourne pas dans
            l'application. Si un service tiers non essentiel est ajouté un jour, un bandeau te demandera ton accord avant.
          </p>
        ),
      },
      {
        h: 'Les supprimer',
        body: (
          <p>
            Efface-les à tout moment depuis les réglages de ton navigateur (données de site). Tu seras déconnecté et tes
            préférences reviendront par défaut.
          </p>
        ),
      },
    ],
  },
]

const EN: LegalDoc[] = [
  {
    key: 'mentions',
    path: '/en/legal-notice',
    title: 'Legal notice',
    short: 'Legal notice',
    sections: [
      {
        h: 'Publisher',
        body: (
          <ul>
            <li>Kollab is published by Ambroise Boutrin, sole trader (French micro-entreprise).</li>
            <li>SIRET: 101 033 504 00016</li>
            <li>VAT not applicable, art. 293 B of the French Tax Code</li>
            <li>Address: {ADDRESS}</li>
            <li>Email: <Mail /></li>
            <li>Phone: +33 7 59 87 83 34</li>
            <li>Publication director: Ambroise Boutrin</li>
          </ul>
        ),
      },
      {
        h: 'Hosting',
        body: (
          <ul>
            <li>Website and web app: Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA, vercel.com.</li>
            <li>Database, accounts and files: Supabase Inc., supabase.com, servers in Paris (EU).</li>
          </ul>
        ),
      },
      {
        h: 'Intellectual property',
        body: (
          <p>
            The Kollab name, logo, texts, visuals and source code belong to the publisher. Any reproduction without written
            permission is prohibited. Content created by users remains theirs.
          </p>
        ),
      },
      {
        h: 'Contact',
        body: <p>Questions or reports of illegal content: <Mail />.</p>,
      },
    ],
  },
  {
    key: 'cgu',
    path: '/en/terms',
    title: 'Terms of use',
    short: 'Terms',
    sections: [
      {
        h: '1. Purpose',
        body: (
          <p>
            These terms govern the use of Kollab, a collaborative project management service on web, phone and desktop,
            published by Ambroise Boutrin (“the publisher”, see the <a href="/en/legal-notice">legal notice</a>).
          </p>
        ),
      },
      {
        h: '2. Acceptance',
        body: (
          <p>
            Creating an account requires accepting these terms by ticking the box. The accepted version and its date are
            stored. If you do not accept them, you cannot use the service.
          </p>
        ),
      },
      {
        h: '3. Account',
        body: (
          <>
            <p>
              You can sign up with an email address or with GitHub, Google or Discord. You must be at least 15, or have a
              parent's consent. You are responsible for your credentials and for actions taken from your account.
            </p>
            <p>You can delete your account at any time in Settings or by writing to <Mail />.</p>
          </>
        ),
      },
      {
        h: '4. The service',
        body: (
          <p>
            Kollab lets you manage tasks and sprints, chat as a team, share links and documents, and connect third-party tools
            (GitHub, Discord). Some features are still in development. The service is free during the beta; paid plans are
            governed by the <a href="/en/sales-terms">terms of sale</a>. The service may change or pause for maintenance. If it
            shuts down for good, the publisher gives at least 30 days' notice so everyone can retrieve their data.
          </p>
        ),
      },
      {
        h: '5. Groups and roles',
        body: (
          <p>
            A group is created by an admin, who invites members and gives them a role (admin, member, read-only guest). Group
            content is visible to all its members. The admin is responsible for the people they invite.
          </p>
        ),
      },
      {
        h: '6. Code of conduct',
        body: (
          <>
            <p>When using Kollab, you agree not to:</p>
            <ul>
              <li>post illegal, hateful, harassing or defamatory content, or content that infringes others' rights;</li>
              <li>share third parties' personal data without the right to do so;</li>
              <li>try to access other groups' data, disrupt or misuse the service (spam, malware);</li>
              <li>use the service for illegal activity.</li>
            </ul>
            <p>
              The publisher may remove content reported as illegal and suspend or delete an account that breaks these rules,
              after a warning except in serious cases.
            </p>
          </>
        ),
      },
      {
        h: '7. User content',
        body: (
          <p>
            You keep ownership of what you post. You allow the publisher to host, copy and display it to your group members,
            only to run the service.
          </p>
        ),
      },
      {
        h: '8. Third-party services',
        body: (
          <p>
            When you connect GitHub, Google or Discord, their own terms apply. Kollab only accesses what the features you turn
            on need, and you can remove these connections at any time.
          </p>
        ),
      },
      {
        h: '9. Liability',
        body: (
          <p>
            The publisher does their best to keep the service available and secure, without guaranteeing it. Keep a copy of
            important data. To the extent permitted by law, the publisher is not liable for indirect damage or for content
            posted by users.
          </p>
        ),
      },
      {
        h: '10. Personal data',
        body: (
          <p>
            See the <a href="/en/privacy">privacy policy</a> and the <a href="/en/cookies">cookie policy</a>.
          </p>
        ),
      },
      {
        h: '11. Changes',
        body: <p>These terms may change. For any major change, you are notified in the app and asked to accept the new version.</p>,
      },
      {
        h: '12. Governing law',
        body: (
          <p>
            French law applies. In case of dispute, first write to <Mail /> to find an amicable solution. Failing that, French
            courts have jurisdiction, subject to consumer protection rules.
          </p>
        ),
      },
    ],
  },
  {
    key: 'cgv',
    path: '/en/sales-terms',
    title: 'Terms of sale',
    short: 'Terms of sale',
    sections: [
      {
        h: '1. Purpose',
        body: (
          <p>
            These terms of sale apply to paid Kollab subscriptions, sold by Ambroise Boutrin, sole trader, SIRET 101 033 504
            00016, {ADDRESS}. They complement the <a href="/en/terms">terms of use</a>. Kollab is free during the beta: these
            terms apply as soon as a paid plan is purchased.
          </p>
        ),
      },
      {
        h: '2. Plans and prices',
        body: (
          <p>
            Plans and prices are shown on the <a href="/en/pricing">Pricing</a> page, in euros. VAT not applicable, art. 293 B
            of the French Tax Code: the price shown is the price you pay. The price that applies is the one shown when you
            subscribe.
          </p>
        ),
      },
      {
        h: '3. Subscription and payment',
        body: (
          <p>
            A group admin subscribes in the app. Payment is made in advance by card, through a secure payment provider: Kollab
            never sees or stores your card number. An invoice is emailed for every payment.
          </p>
        ),
      },
      {
        h: '4. Term and renewal',
        body: (
          <p>
            Subscriptions are monthly or yearly depending on the plan. They renew automatically for the same term. For yearly
            plans, you get an email at least one month before renewal.
          </p>
        ),
      },
      {
        h: '5. Cancellation',
        body: (
          <p>
            Cancel at any time, in a few clicks in Settings or by writing to <Mail />. Cancellation takes effect at the end of
            the paid period; the group then moves back to the free plan. If a payment fails, paid features are suspended after
            a reminder left unanswered for 15 days.
          </p>
        ),
      },
      {
        h: '6. Right of withdrawal',
        body: (
          <p>
            If you are a consumer, you have 14 days after subscribing to change your mind, without giving a reason. Write to{' '}
            <Mail />: you get a full refund within 14 days, by the same payment method.
          </p>
        ),
      },
      {
        h: '7. Data',
        body: (
          <p>
            Your data stays yours. After cancelling, it remains available on the free plan, and you can export it or delete
            your account at any time.
          </p>
        ),
      },
      {
        h: '8. Warranty and liability',
        body: (
          <p>
            Consumers benefit from the legal guarantee of conformity for digital services (articles L224-25-12 and following
            of the French Consumer Code). For business customers, the publisher's liability is limited to the amounts paid
            over the last 12 months.
          </p>
        ),
      },
      {
        h: '9. Mediation and disputes',
        body: (
          <p>
            In case of dispute, first write to <Mail />. If no solution is found, a consumer can refer the matter free of
            charge to the consumer mediator: <Fill>mediator name and website</Fill>. French law applies; failing agreement,
            French courts have jurisdiction.
          </p>
        ),
      },
    ],
  },
  {
    key: 'confidentialite',
    path: '/en/privacy',
    title: 'Privacy policy',
    short: 'Privacy',
    sections: [
      {
        h: 'Data controller',
        body: (
          <p>
            Ambroise Boutrin, publisher of Kollab (see the <a href="/en/legal-notice">legal notice</a>), reachable at <Mail />.
          </p>
        ),
      },
      {
        h: 'Data collected',
        body: (
          <ul>
            <li><strong>Account</strong>: email address, display name, profile picture, IDs of connected accounts (GitHub, Google, Discord).</li>
            <li><strong>Content</strong>: groups, tasks, messages, links, documents and files you add.</li>
            <li><strong>Technical data</strong>: sign-in and error logs (IP address, date, browser), for security.</li>
            <li><strong>GitHub</strong>: if you connect it, the repository and PR information the features you use need.</li>
            <li><strong>Subscription</strong>: if you pay, invoices and payment status (card numbers stay with the payment provider).</li>
            <li><strong>Email updates</strong>: if you sign up on the website, your address and the sign-up page.</li>
            <li><strong>Website analytics</strong>: page views, country, device and referrer, anonymous and cookie-free (Vercel Web Analytics).</li>
          </ul>
        ),
      },
      {
        h: 'Why, and on what basis',
        body: (
          <ul>
            <li>Providing the service and managing subscriptions: performance of the contract (terms of use and of sale).</li>
            <li>Securing the service and preventing abuse: legitimate interest.</li>
            <li>Sending sign-in emails and the notifications you turn on: performance of the contract.</li>
            <li>Sending updates to subscribers: consent, which you can withdraw at any time.</li>
            <li>Measuring website traffic anonymously: legitimate interest.</li>
            <li>Keeping invoices and answering legal requests: legal obligation.</li>
          </ul>
        ),
      },
      {
        h: 'Retention',
        body: (
          <ul>
            <li>Account and content: as long as the account exists, then deleted within 30 days.</li>
            <li>Account inactive for 3 years: you get an email, then it is deleted.</li>
            <li>Technical logs: 12 months at most.</li>
            <li>Invoices: 10 years (accounting obligation).</li>
            <li>Email updates address: until you unsubscribe, or 3 years without opening an email.</li>
            <li>Messages posted in a group may remain there, anonymised, after you leave.</li>
          </ul>
        ),
      },
      {
        h: 'Recipients and processors',
        body: (
          <>
            <p>Data is never sold or used for advertising. It is visible to your group members and processed by:</p>
            <ul>
              <li>Supabase: database, accounts and files, hosted in the EU (Paris).</li>
              <li>Vercel: website and app hosting, anonymous website analytics.</li>
              <li>Resend: sending emails (activation, invitations, summaries).</li>
              <li>GitHub, Google and Discord: sign-in and integrations, only if you connect them.</li>
              <li>LiveKit: voice and video calls.</li>
              <li>The payment provider, only if you buy a paid plan.</li>
            </ul>
            <p>
              Some are based in the USA. Transfers are covered by the EU–US Data Privacy Framework or by the European
              Commission's standard contractual clauses.
            </p>
          </>
        ),
      },
      {
        h: 'Your rights',
        body: (
          <>
            <p>
              You can access, correct, delete, restrict, object to and port your data, and decide what happens to it after your
              death. Write to <Mail />: answer within one month.
            </p>
            <p>You can also complain to the CNIL, the French data protection authority (cnil.fr).</p>
          </>
        ),
      },
      {
        h: 'Security',
        body: (
          <p>
            Traffic is encrypted (HTTPS). Data access is restricted per group by security rules in the database. Passwords are
            never stored in plain text.
          </p>
        ),
      },
    ],
  },
  {
    key: 'cookies',
    path: '/en/cookies',
    title: 'Cookies and local storage',
    short: 'Cookies',
    sections: [
      {
        h: 'What Kollab uses',
        body: (
          <>
            <p>
              No advertising cookies, no third-party trackers. Fonts are self-hosted. The website counts visits with Vercel Web
              Analytics, which sets no cookie and does not follow you across sites.
            </p>
            <p>The website and the app only use your browser's local storage to:</p>
            <ul>
              <li>keep you signed in;</li>
              <li>remember your preferences (theme, colour);</li>
              <li>work offline (cached files).</li>
            </ul>
          </>
        ),
      },
      {
        h: 'Why there is no banner',
        body: (
          <p>
            These are strictly necessary for the service you ask for, so no consent is needed (article 82 of the French Data
            Protection Act). Analytics read and write nothing on your device and do not run in the app. If a non-essential
            third-party service is ever added, a banner will ask for your consent first.
          </p>
        ),
      },
      {
        h: 'Deleting them',
        body: (
          <p>
            Clear them at any time in your browser settings (site data). You will be signed out and your preferences reset.
          </p>
        ),
      },
    ],
  },
]

export const LEGAL_DOCS: Record<Lang, LegalDoc[]> = { fr: FR, en: EN }

/** Retrouve une page juridique et sa langue à partir de l'adresse. */
export function findLegal(pathname: string): { doc: LegalDoc; lang: Lang } | undefined {
  const p = pathname.replace(/\/+$/, '') || '/'
  for (const lang of ['fr', 'en'] as Lang[]) {
    const doc = LEGAL_DOCS[lang].find((d) => d.path === p)
    if (doc) return { doc, lang }
  }
  return undefined
}

/** Même page juridique dans l'autre langue. */
export function legalAlternate(doc: LegalDoc, lang: Lang): string {
  return LEGAL_DOCS[lang].find((d) => d.key === doc.key)?.path ?? LEGAL_DOCS[lang][0].path
}

export function LegalPage({ doc, lang }: { doc: LegalDoc; lang: Lang }) {
  const en = lang === 'en'
  const version = doc.key === 'cgu' ? CGU_VERSION : doc.key === 'cgv' ? CGV_VERSION : null
  return (
    <article className="s-wrap s-legal">
      <nav className="s-legal-tabs" aria-label={en ? 'Legal pages' : 'Pages juridiques'}>
        {LEGAL_DOCS[lang].map((d) => (
          <a key={d.path} href={d.path} aria-current={d.path === doc.path ? 'page' : undefined}>{d.short}</a>
        ))}
      </nav>
      <h1>{doc.title}</h1>
      <p className="s-legal-meta">
        {en ? 'Last updated: ' : 'Dernière mise à jour : '}
        {en ? LEGAL_UPDATED_EN : LEGAL_UPDATED}
        {version && ` · version ${version}`}
        {en && ' · Translation: the French version prevails.'}
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
