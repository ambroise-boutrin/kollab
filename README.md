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
