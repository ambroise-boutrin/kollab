// Tous les emails Kollab, au même design (piste A « Bandeau couleur ») : logo, bandeau de couleur
// avec le titre, encadré des infos clés, un bouton, une note. Pur TypeScript, sans API Deno :
// les fonctions Edge l'utilisent pour envoyer, et scripts/emails.mjs pour les aperçus.

export type Tone = 'compte' | 'securite' | 'equipe' | 'ok' | 'alerte' | 'info'

const TONES: Record<Tone, { band: string; soft: string; ink: string }> = {
  compte: { band: '#5546E0', soft: '#E7E3FF', ink: '#FFFFFF' },
  securite: { band: '#FFD23F', soft: '#FFF3C4', ink: '#14142B' },
  equipe: { band: '#7DDCB0', soft: '#D9F5E8', ink: '#14142B' },
  ok: { band: '#7DDCB0', soft: '#D9F5E8', ink: '#14142B' },
  alerte: { band: '#FF7A6B', soft: '#FFE4DF', ink: '#14142B' },
  info: { band: '#E7E3FF', soft: '#F1EFFF', ink: '#14142B' },
}

export type Email = {
  subject: string
  preheader: string
  tone: Tone
  kicker: string
  title: string
  /** Paragraphes en texte brut (échappés ici). */
  lines: string[]
  /** Infos clés : [libellé, valeur], en texte brut. */
  info?: [string, string][]
  cta?: { label: string; url: string }
  /** Gros code à recopier (réauthentification). */
  code?: string
  /** Affiche le lien en clair sous le bouton (liens de connexion). */
  showLink?: boolean
  note?: string
  /** HTML déjà sûr, inséré tel quel après les paragraphes (résumé du lundi). */
  extraHtml?: string
  extraText?: string
  /** Pourquoi la personne reçoit l'email ; avec unsubscribe, le lien pour couper ce type d'email. */
  reason?: string
  unsubscribe?: string
}

export const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const F = "Inter,'Segoe UI',Helvetica,Arial,sans-serif"
const H = "'Plus Jakarta Sans',Inter,'Segoe UI',Helvetica,Arial,sans-serif"
const ADDRESS = 'Kollab · 1 rue Saint-Martin du Mail, 45000 Orléans'

export function render(e: Email, assets: string): { html: string; text: string } {
  const t = TONES[e.tone]
  const p = (s: string) => `<p style="margin:0 0 14px;font:400 16px/1.55 ${F};color:#4A4E63">${esc(s)}</p>`
  const rows = (e.info ?? [])
    .map(([k, v], i) => `<tr><td style="padding:${i ? 6 : 0}px 0 0;font:400 14px/1.5 ${F};color:#4A4E63">${esc(k)}</td><td align="right" style="padding:${i ? 6 : 0}px 0 0 12px;font:600 14px/1.5 ${F};color:#14142B">${esc(v)}</td></tr>`)
    .join('')
  const info = rows
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 0;background:${t.soft};border-radius:14px"><tr><td style="padding:14px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr></table>`
    : ''
  const code = e.code
    ? `<div style="margin:4px 0 0;background:${t.soft};border-radius:14px;padding:18px;text-align:center;font:800 34px/1 ${H};letter-spacing:.3em;color:#14142B">${esc(e.code)}</div>`
    : ''
  const cta = e.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0"><tr><td style="border-radius:12px;background:#5546E0"><a href="${esc(e.cta.url)}" style="display:inline-block;padding:14px 24px;font:600 16px ${F};color:#FFFFFF;text-decoration:none;border-radius:12px">${esc(e.cta.label)}</a></td></tr></table>`
    : ''
  const link = e.cta && e.showLink
    ? `<p style="margin:16px 0 0;font:400 13px/1.55 ${F};color:#8A90A2">Le bouton ne marche pas ? Copie ce lien :<br><a href="${esc(e.cta.url)}" style="color:#5546E0;word-break:break-all">${esc(e.cta.url)}</a></p>`
    : ''
  const note = e.note ? `<p style="margin:18px 0 0;font:400 13px/1.55 ${F};color:#8A90A2">${esc(e.note)}</p>` : ''
  const unsub = e.unsubscribe ? `<br><a href="${esc(e.unsubscribe)}" style="color:#8A90A2">Ne plus recevoir ces emails</a>` : ''

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(e.subject)}</title></head>
<body style="margin:0;padding:0;background:#F5F6FA;color:#14142B">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(e.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6FA"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 6px 18px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:32px"><img src="${assets}/logo.png" width="32" height="32" alt="" style="display:block;border:0"></td>
<td style="padding-left:9px;font:800 19px ${H};color:#14142B;letter-spacing:-0.02em">Kollab</td>
</tr></table></td></tr>
<tr><td style="background:${t.band};border-radius:20px 20px 0 0;padding:26px 28px 24px">
<div style="font:700 13px ${F};color:${t.ink};opacity:.8">${esc(e.kicker)}</div>
<h1 style="margin:6px 0 0;font:800 27px/1.15 ${H};letter-spacing:-0.03em;color:${t.ink}">${esc(e.title)}</h1>
</td></tr>
<tr><td style="background:#FFFFFF;border-radius:0 0 20px 20px;padding:24px 28px 28px">
${e.lines.map(p).join('\n')}${e.extraHtml ?? ''}${info}${code}${cta}${link}${note}
</td></tr>
<tr><td style="padding:18px 6px 0;font:400 12px/1.6 ${F};color:#8A90A2;text-align:center">${ADDRESS}<br>${esc(e.reason ?? 'Email envoyé car tu as un compte Kollab.')}${unsub}</td></tr>
</table></td></tr></table></body></html>`

  const text = [
    e.title,
    '',
    ...e.lines,
    ...(e.extraText ? ['', e.extraText] : []),
    ...(e.info?.length ? ['', ...e.info.map(([k, v]) => `${k} : ${v}`)] : []),
    ...(e.code ? ['', `Code : ${e.code}`] : []),
    ...(e.cta ? ['', `${e.cta.label} : ${e.cta.url}`] : []),
    ...(e.note ? ['', e.note] : []),
    '',
    '--',
    ADDRESS,
    e.reason ?? 'Email envoyé car tu as un compte Kollab.',
    ...(e.unsubscribe ? [`Ne plus recevoir ces emails : ${e.unsubscribe}`] : []),
  ].join('\n')
  return { html, text }
}

// ---------- Mise en forme ----------

const TZ = 'Europe/Paris'
export const day = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: TZ }).format(new Date(iso))
export const dayTime = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso))
export const money = (cents: number, currency = 'eur') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100).replace(/ | /g, ' ')
const first = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] ?? ''
const hello = (name?: string | null) => (first(name) ? `Bonjour ${first(name)},` : 'Bonjour,')
const PROVIDERS: Record<string, string> = { github: 'GitHub', discord: 'Discord', google: 'Google', email: 'Email' }
const provider = (p?: string) => PROVIDERS[p ?? ''] ?? (p ? p[0].toUpperCase() + p.slice(1) : 'un compte')
const ROLE: Record<string, string> = { admin: 'Admin', member: 'Membre', guest: 'Invité' }
const PLAN: Record<string, string> = { team: 'Équipe', founder: 'Fondateur' }
const plan = (p?: string, period?: string) => `${PLAN[p ?? ''] ?? 'Équipe'}${period === 'year' ? ', annuel' : period === 'month' ? ', mensuel' : ''}`

// ---------- Modèles ----------

type D = Record<string, any>
const SECURITY = 'Email de sécurité, envoyé à chaque changement sur ton compte.'
const NOT_YOU = 'Ce n’est pas toi ? Change ton mot de passe tout de suite et réponds à cet email.'

export const templates = {
  // Compte (envoyés par le hook d'authentification)
  signup: (d: D): Email => ({
    subject: 'Active ton compte Kollab', preheader: 'Un clic pour activer ton compte.', tone: 'compte', kicker: 'Compte', title: 'Active ton compte',
    lines: [`${hello(d.name)} confirme ton adresse pour commencer.`], info: [['Adresse', d.email]],
    cta: { label: 'Activer mon compte', url: d.url }, showLink: true, note: 'Le lien expire dans 24 h. Pas toi ? Ignore cet email.',
    reason: 'Email envoyé car cette adresse a servi à créer un compte Kollab.',
  }),
  magiclink: (d: D): Email => ({
    subject: 'Ton lien de connexion Kollab', preheader: 'Un clic pour te connecter.', tone: 'compte', kicker: 'Connexion', title: 'Ton lien de connexion',
    lines: ['Clique pour te connecter, sans mot de passe.'], cta: { label: 'Me connecter', url: d.url }, showLink: true,
    note: 'Le lien ne marche qu’une fois et expire dans 1 h. Pas toi ? Ignore cet email.',
  }),
  recovery: (d: D): Email => ({
    subject: 'Nouveau mot de passe Kollab', preheader: 'Choisis un nouveau mot de passe.', tone: 'securite', kicker: 'Sécurité', title: 'Choisis un nouveau mot de passe',
    lines: ['Quelqu’un a demandé à changer le mot de passe de ton compte.'], info: [['Compte', d.email], ['Demandé le', dayTime(d.at ?? new Date().toISOString())]],
    cta: { label: 'Changer le mot de passe', url: d.url }, showLink: true, note: 'Ce n’est pas toi ? Ignore cet email, rien ne change.',
  }),
  invite: (d: D): Email => ({
    subject: 'Ton compte Kollab t’attend', preheader: 'Active ton compte pour rejoindre ton équipe.', tone: 'equipe', kicker: 'Équipe', title: 'Ton compte t’attend',
    lines: ['Un compte Kollab a été créé pour toi. Active-le pour rejoindre ton équipe.'], cta: { label: 'Activer mon compte', url: d.url }, showLink: true,
    note: 'Tu ne t’attendais pas à cet email ? Ignore-le.',
  }),
  email_change_new: (d: D): Email => ({
    subject: 'Confirme ta nouvelle adresse', preheader: 'Un clic pour valider ta nouvelle adresse.', tone: 'compte', kicker: 'Compte', title: 'Confirme ta nouvelle adresse',
    lines: ['Tu as demandé à utiliser cette adresse pour Kollab.'], info: [['Ancienne', d.oldEmail], ['Nouvelle', d.newEmail]],
    cta: { label: 'Confirmer cette adresse', url: d.url }, showLink: true, note: 'Pas toi ? Ignore cet email, rien ne change.',
  }),
  email_change_current: (d: D): Email => ({
    subject: 'Changement d’adresse email demandé', preheader: `Ton compte va passer à ${d.newEmail}.`, tone: 'securite', kicker: 'Sécurité', title: 'Changement d’adresse demandé',
    lines: ['Pour valider, confirme depuis cette adresse et depuis la nouvelle.'], info: [['Actuelle', d.oldEmail], ['Nouvelle', d.newEmail]],
    cta: { label: 'Confirmer le changement', url: d.url }, showLink: true, note: NOT_YOU, reason: SECURITY,
  }),
  reauthentication: (d: D): Email => ({
    subject: `${d.code} est ton code Kollab`, preheader: 'Ton code de confirmation.', tone: 'securite', kicker: 'Sécurité', title: 'Ton code de confirmation',
    lines: ['Recopie ce code dans Kollab pour confirmer l’action.'], code: d.code, note: 'Il expire dans quelques minutes. Pas toi ? Ignore cet email.', reason: SECURITY,
  }),
  password_changed: (d: D): Email => ({
    subject: 'Ton mot de passe a changé', preheader: 'Le mot de passe de ton compte Kollab vient de changer.', tone: 'securite', kicker: 'Sécurité', title: 'Ton mot de passe a changé',
    lines: ['Le mot de passe de ton compte vient d’être modifié.'], info: [['Compte', d.email], ['Le', dayTime(d.at ?? new Date().toISOString())]],
    cta: { label: 'Ouvrir Kollab', url: d.appUrl }, note: NOT_YOU, reason: SECURITY,
  }),
  email_changed: (d: D): Email => ({
    subject: 'Ton adresse email a changé', preheader: `Ton compte utilise maintenant ${d.newEmail}.`, tone: 'securite', kicker: 'Sécurité', title: 'Ton adresse a changé',
    lines: ['Ton compte Kollab utilise maintenant une nouvelle adresse.'], info: [['Ancienne', d.oldEmail], ['Nouvelle', d.newEmail]],
    note: NOT_YOU, reason: SECURITY,
  }),
  identity_linked: (d: D): Email => ({
    subject: `${provider(d.provider)} est relié à ton compte`, preheader: `Tu peux te connecter avec ${provider(d.provider)}.`, tone: 'securite', kicker: 'Sécurité', title: `${provider(d.provider)} est relié`,
    lines: [`Ton compte ${provider(d.provider)} est maintenant relié à Kollab.`], info: [['Compte', d.email], ['Le', dayTime(d.at ?? new Date().toISOString())]],
    note: NOT_YOU, reason: SECURITY,
  }),
  identity_unlinked: (d: D): Email => ({
    subject: `${provider(d.provider)} n’est plus relié`, preheader: `${provider(d.provider)} a été retiré de ton compte.`, tone: 'securite', kicker: 'Sécurité', title: `${provider(d.provider)} n’est plus relié`,
    lines: [`Ton compte ${provider(d.provider)} a été retiré de Kollab.`], info: [['Compte', d.email], ['Le', dayTime(d.at ?? new Date().toISOString())]],
    note: NOT_YOU, reason: SECURITY,
  }),
  mfa_changed: (d: D): Email => ({
    subject: d.added ? 'Double authentification activée' : 'Double authentification retirée', preheader: 'Changement de sécurité sur ton compte.', tone: 'securite', kicker: 'Sécurité',
    title: d.added ? 'Double authentification activée' : 'Double authentification retirée',
    lines: [d.added ? 'Une nouvelle méthode de vérification protège ton compte.' : 'Une méthode de vérification a été retirée de ton compte.'],
    info: [['Compte', d.email]], note: NOT_YOU, reason: SECURITY,
  }),

  // Compte (envoyés par Kollab)
  welcome: (d: D): Email => ({
    subject: `Bienvenue sur Kollab${first(d.name) ? `, ${first(d.name)}` : ''} !`, preheader: 'Ton compte est prêt. Trois étapes pour bien démarrer.', tone: 'compte', kicker: 'Compte activé',
    title: `Bienvenue${first(d.name) ? `, ${first(d.name)}` : ''} !`,
    lines: ['Ton équipe, ton code et tes sprints au même endroit. Pour bien démarrer :'],
    info: [['Étape 1', 'Crée ou rejoins un projet'], ['Étape 2', 'Invite ton équipe'], ['Étape 3', 'Ajoute tes premières tâches']],
    cta: { label: 'Ouvrir Kollab', url: d.appUrl }, note: 'Kollab s’installe aussi sur ton ordinateur et ton téléphone, depuis le navigateur.',
  }),
  account_deleted: (d: D): Email => ({
    subject: 'Ton compte Kollab est supprimé', preheader: 'Toutes tes données personnelles ont été effacées.', tone: 'info', kicker: 'Compte', title: 'Ton compte est supprimé',
    lines: [`${hello(d.name)} ton compte et tes données personnelles ont été effacés, comme demandé.`, 'Tes projets partagés restent à ton équipe.'],
    info: [['Compte', d.email], ['Le', dayTime(d.at ?? new Date().toISOString())]],
    note: 'Ce n’est pas toi ? Réponds à cet email, on regarde tout de suite.', reason: 'Dernier email : tu ne recevras plus rien de Kollab.',
  }),

  // Équipe
  group_invite: (d: D): Email => ({
    subject: `${d.inviter} t’invite sur ${d.group}`, preheader: `Rejoins ${d.group} sur Kollab.`, tone: 'equipe', kicker: 'Invitation', title: `Rejoins ${d.group}`,
    lines: [`${d.inviter} t’invite à travailler avec l’équipe sur Kollab.`], info: [['Projet', d.group], ['Rôle', ROLE[d.role] ?? 'Membre'], ['Invité par', d.inviter]],
    cta: { label: 'Rejoindre l’équipe', url: d.url }, note: `Valable 30 jours. Tu ne connais pas ${d.inviter} ? Ignore cet email.`,
    reason: `Email envoyé car ${d.inviter} a saisi ton adresse dans Kollab.`,
  }),
  unread_digest: (d: D): Email => {
    const items = (d.items ?? []) as { label: string; group: string }[]
    const n = d.count ?? items.length
    return {
      subject: n > 1 ? `${n} choses t’attendent sur Kollab` : (items[0]?.label ?? 'Une chose t’attend sur Kollab'),
      preheader: items.slice(0, 2).map((i) => i.label).join(' · '), tone: 'info', kicker: 'Pendant ton absence',
      title: n > 1 ? `${n} choses t’attendent` : 'Une chose t’attend',
      lines: [`${hello(d.name)} voici ce que tu n’as pas encore vu.`],
      info: items.slice(0, 6).map((i) => [i.label, i.group] as [string, string]),
      cta: { label: 'Voir dans Kollab', url: d.appUrl },
      note: n > 6 ? `Et ${n - 6} autre${n - 6 > 1 ? 's' : ''}.` : undefined,
      reason: 'Envoyé quand une mention ou une tâche reste non lue plus d’une heure.', unsubscribe: d.unsubscribe,
    }
  },

  // Abonnement (appelés par le webhook Stripe)
  trial_ending: (d: D): Email => ({
    subject: `Ton essai se termine le ${day(d.trialEnd)}`, preheader: 'Rien à faire pour continuer.', tone: 'securite', kicker: 'Abonnement', title: 'Ton essai se termine bientôt',
    lines: [`L’essai gratuit de ${d.group} se termine dans 3 jours. Rien à faire pour continuer : l’abonnement démarre tout seul.`],
    info: [['Projet', d.group], ['Offre', plan(d.plan, d.period)], ['Premier paiement', `${money(d.amount, d.currency)} le ${day(d.trialEnd)}`]],
    cta: { label: 'Gérer l’abonnement', url: d.url }, note: 'Tu peux résilier avant cette date, sans frais.',
    reason: 'Email envoyé à l’admin qui gère l’abonnement.',
  }),
  payment_succeeded: (d: D): Email => ({
    subject: `Paiement reçu : ${money(d.amount, d.currency)}`, preheader: `Merci ! ${d.group} est à jour.`, tone: 'ok', kicker: 'Abonnement', title: 'Paiement reçu, merci !',
    lines: [`L’abonnement de ${d.group} est à jour.`],
    info: [['Montant', money(d.amount, d.currency)], ['Projet', d.group], ['Offre', plan(d.plan, d.period)], ...(d.periodEnd ? [['Prochain paiement', day(d.periodEnd)] as [string, string]] : [])],
    cta: d.invoiceUrl ? { label: 'Voir la facture', url: d.invoiceUrl } : undefined,
    note: d.pdfUrl ? `Facture PDF : ${d.pdfUrl}` : undefined, reason: 'Email envoyé à l’admin qui gère l’abonnement.',
  }),
  payment_failed: (d: D): Email => ({
    subject: `Paiement refusé pour ${d.group}`, preheader: 'Mets à jour ta carte pour garder ton abonnement.', tone: 'alerte', kicker: 'Abonnement', title: 'Ton paiement n’est pas passé',
    lines: ['Ta banque a refusé le paiement. On réessaie automatiquement dans quelques jours.'],
    info: [['Montant', money(d.amount, d.currency)], ['Projet', d.group], ['Accès garanti jusqu’au', day(d.graceUntil)]],
    cta: { label: 'Mettre à jour la carte', url: d.url },
    note: `Sans paiement d’ici le ${day(d.graceUntil)}, le projet repasse en Gratuit. Rien n’est supprimé.`, reason: 'Email envoyé à l’admin qui gère l’abonnement.',
  }),
  renewal_upcoming: (d: D): Email => ({
    subject: `Renouvellement le ${day(d.renewOn)}`, preheader: `${money(d.amount, d.currency)} pour ${d.group}.`, tone: 'info', kicker: 'Abonnement', title: 'Ton abonnement se renouvelle',
    lines: [`L’abonnement de ${d.group} se renouvelle automatiquement. Rien à faire.`],
    info: [['Projet', d.group], ['Offre', plan(d.plan, d.period)], ['Montant', money(d.amount, d.currency)], ['Le', day(d.renewOn)]],
    cta: { label: 'Gérer l’abonnement', url: d.url }, note: 'Tu peux résilier avant cette date, sans frais.', reason: 'Email envoyé à l’admin qui gère l’abonnement.',
  }),
  subscription_canceled: (d: D): Email => ({
    subject: `${d.group} est repassé en Gratuit`, preheader: 'Tes données restent là.', tone: 'info', kicker: 'Abonnement', title: 'Abonnement terminé',
    lines: [`${d.group} est repassé en offre Gratuite. Tes tâches, documents et messages restent là.`],
    info: [['Projet', d.group], ['Fin le', day(d.endedOn)]],
    cta: { label: 'Reprendre un abonnement', url: d.url }, note: 'Une erreur ? Reprends en un clic, tout revient comme avant.', reason: 'Email envoyé à l’admin qui gère l’abonnement.',
  }),
} satisfies Record<string, (d: D) => Email>

export type TemplateName = keyof typeof templates

// Données d'exemple pour les aperçus (scripts/emails.mjs).
export const samples: Record<TemplateName, D> = (() => {
  const url = 'https://kollab-tan-nu.vercel.app/app'
  const at = '2026-11-25T09:42:00Z'
  const base = { name: 'Léa Martin', email: 'lea.martin@studio.fr', appUrl: url, url, at }
  const bill = { group: 'Équipe Alpha', plan: 'team', period: 'month', amount: 1000, currency: 'eur', url }
  return {
    signup: base, magiclink: base, recovery: base, invite: base,
    email_change_new: { ...base, oldEmail: 'lea@ancien.fr', newEmail: 'lea.martin@studio.fr' },
    email_change_current: { ...base, oldEmail: 'lea@ancien.fr', newEmail: 'lea.martin@studio.fr' },
    reauthentication: { ...base, code: '305805' }, password_changed: base,
    email_changed: { ...base, oldEmail: 'lea@ancien.fr', newEmail: 'lea.martin@studio.fr' },
    identity_linked: { ...base, provider: 'github' }, identity_unlinked: { ...base, provider: 'discord' }, mfa_changed: { ...base, added: true },
    welcome: base, account_deleted: base,
    group_invite: { inviter: 'Ambroise Boutrin', group: 'Équipe Alpha', role: 'member', url },
    unread_digest: { ...base, count: 3, unsubscribe: `${url}/reglages`, items: [
      { label: 'Tom t’a mentionné dans #général', group: 'Équipe Alpha' }, { label: 'Inès t’a attribué « Page de paiement »', group: 'Équipe Alpha' }, { label: 'Noah a rejoint le projet', group: 'Site client' }] },
    trial_ending: { ...bill, trialEnd: '2026-11-28T09:00:00Z' },
    payment_succeeded: { ...bill, invoiceUrl: url, periodEnd: '2026-12-25T09:00:00Z' },
    payment_failed: { ...bill, graceUntil: '2026-12-02T09:00:00Z' },
    renewal_upcoming: { ...bill, plan: 'founder', period: 'year', amount: 4900, renewOn: '2026-12-02T09:00:00Z' },
    subscription_canceled: { ...bill, endedOn: '2026-11-25T09:00:00Z' },
  }
})()
