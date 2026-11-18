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
4. Déploie la fonction Discord : `supabase functions deploy notify-discord`.
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

- **Activation, mot de passe oublié, lien magique** : modèles dans `supabase/templates/`. À coller dans Supabase › Authentication › Emails › Templates (sujets : « Active ton compte Kollab », « Nouveau mot de passe Kollab », « Ton lien de connexion Kollab »).
- **Bienvenue** : fonction `welcome-email`, envoyée une fois après l'activation, via Resend. Secrets de fonction : `RESEND_API_KEY`, `MAIL_FROM` et `APP_URL`.
- Pour la production, configure aussi le SMTP de Resend dans Supabase › Authentication › SMTP : l'envoi par défaut de Supabase est limité à quelques emails par heure.
