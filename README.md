# Kollab

Gestion de projet pour équipes de dev : tableau kanban, attribution des tâches, chat de groupe en temps réel, liens importants, notifications Discord. Web, installable sur téléphone (PWA), et bientôt sur ordinateur (Tauri).

## Lancer en local

```bash
npm install
npm run dev
```

Sans configuration, Kollab démarre en **mode démo** : les données restent dans le navigateur, et deux onglets ouverts se synchronisent en direct.

## Brancher Supabase (vraie base partagée)

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Applique le schéma : `supabase db push` (ou colle `supabase/migrations/*.sql` dans l'éditeur SQL).
3. Dans *Authentication › Providers*, active **GitHub**, **Google**, **Discord** et **Email**, et active *Manual linking* pour pouvoir relier plusieurs comptes.
4. Déploie les fonctions Discord : `supabase functions deploy notify-discord` et `supabase functions deploy discord --no-verify-jwt`.
   Pour les salons reliés, crée une appli sur le [portail développeur Discord](https://discord.com/developers/applications) : active *Message Content Intent* (onglet Bot), ajoute la redirection `https://<projet>.supabase.co/functions/v1/discord` (onglet OAuth2), puis range `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` et `DISCORD_BOT_TOKEN` dans les secrets des fonctions.
5. Copie `.env.example` en `.env.local` et renseigne `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.

## Structure

- `src/lib/backend.ts` : l'interface des données. `demo.ts` (local) et `supabaseBackend.ts` (Supabase) l'implémentent.
- `src/lib/store.tsx` : état de l'app et temps réel.
- `src/lib/themes.ts` : les 5 thèmes et la couleur personnalisée.
- `src/pages/` : Accueil, Tableau (+ détail de tâche), Chat, Groupe, Réglages, Connexion.
- `supabase/` : schéma SQL avec RLS, et fonction `notify-discord`.

La suite est dans [ROADMAP.md](ROADMAP.md).

## Appli bureau (Windows, macOS, Linux)

L'appli bureau est faite avec Tauri (`src-tauri/`). Pour la lancer en local : `npm run tauri dev` (Rust requis).

### Publier une nouvelle version

1. Ajoute la version en haut de `src/changelog.json` (elle sert aux notes de version et à Réglages › À propos).
2. Mets le même numéro dans `package.json`, `src-tauri/tauri.conf.json` et `src-tauri/Cargo.toml`.
3. Fusionne sur `main`.

Quand le numéro de version est nouveau, GitHub Actions compile les installeurs et publie la release. Les applis déjà installées proposent la mise à jour d'elles-mêmes.

Les mises à jour sont signées. Le dépôt a besoin de deux secrets GitHub : `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Sans eux, les installeurs sont compilés mais l'appli ne peut pas se mettre à jour toute seule.

Pour voir la fenêtre de mise à jour sans publier : ouvre l'app avec `?apercu-mise-a-jour` à la fin de l'adresse.

## Emails

Tous les emails ont le même design (bandeau de couleur, encadré d'infos, un bouton) et partent par Resend.

- **Modèles** : `supabase/functions/_shared/email-templates.ts` (21 emails). Aperçus : `node scripts/emails.mjs` puis ouvre `emails-apercu/index.html`.
- **Envoi** : `sendEmail({ to, template, data, groupId, key })` dans `supabase/functions/_shared/email.ts`. Chaque envoi est noté dans la table `email_log` (`key` évite les doublons, ex. id d'événement Stripe).
- **Emails de compte** (activation, mot de passe, lien magique, changement d'email, code, alertes de sécurité) : fonction `send-email-hook`, branchée dans Supabase › Authentication › Hooks › Send Email. Elle remplace le SMTP et les modèles de Supabase.
- **Autres** : `welcome-email` (bienvenue), `invite-email` (invitations), `weekly-summary` (lundi), `notify-email` (« Pendant ton absence », toutes les 30 min), `delete-account` (confirmation), et le webhook Stripe (abonnements).

Réglages à faire une fois :
1. Resend › Domains : ajouter le domaine d'envoi et copier les enregistrements DNS (SPF, DKIM, DMARC).
2. Secrets des fonctions : `RESEND_API_KEY`, `MAIL_FROM` (« Kollab <bonjour@ton-domaine> »), `APP_URL`, `SEND_EMAIL_HOOK_SECRET`.
3. Supabase › Authentication › Hooks › Send Email : HTTPS, adresse de `send-email-hook`, et activer les notifications de sécurité (Authentication › Emails).
