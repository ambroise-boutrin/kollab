import type { Workspace } from './backend'

/**
 * Accès à l'API GitHub. Le jeton ne vit jamais dans le navigateur : il est chiffré côté serveur
 * et les appels passent par la fonction « github » de Supabase (voir setGhProxy).
 * Sans connexion, seuls les dépôts publics répondent (appel direct, sans jeton).
 */
const LINKED_KEY = 'kollab-gh-linked'
/** Ancienne clé : le jeton en clair, gardé par les versions d'avant. On le range sur le compte puis on l'efface. */
export const LEGACY_TOKEN_KEY = 'kollab-gh-token'
const API = 'https://api.github.com'

/** Vrai quand GitHub est relié au compte (le jeton reste sur le serveur). */
export function ghLinked(): boolean {
  try {
    return localStorage.getItem(LINKED_KEY) === '1'
  } catch {
    return false
  }
}
export function setGhLinked(on: boolean) {
  try {
    if (on) localStorage.setItem(LINKED_KEY, '1')
    else localStorage.removeItem(LINKED_KEY)
  } catch {
    /* ignoré */
  }
}
/** @deprecated garder pour le code existant : vaut « relié », jamais un vrai jeton. */
export const ghToken = (): string | null => (ghLinked() ? 'linked' : null)

export type GhProxy = (req: { method: string; path: string; body?: unknown; accept: string }) => Promise<{ status: number; body: string; remaining: string | null }>
let proxy: GhProxy | null = null
/** Branche les appels GitHub sur le serveur (mode Supabase). */
export function setGhProxy(p: GhProxy | null) {
  proxy = p
}

export interface Repo { owner: string; repo: string }

export function parseRepo(url: string): Repo | null {
  const m = url.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)/)
  return m ? { owner: m[1], repo: m[2] } : null
}
export function parsePrUrl(url: string | null): (Repo & { number: number }) | null {
  const m = url?.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/)
  return m ? { owner: m[1], repo: m[2], number: Number(m[3]) } : null
}
const BARE_REPO = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/
/** Le lien du dépôt du projet : celui nommé « Dépôt GitHub », sinon le premier lien vers un dépôt (pas une PR ni un fichier). */
export function projectRepoLink<L extends { title: string; url: string }>(links: L[]): L | undefined {
  return links.find((l) => l.title === 'Dépôt GitHub' && parseRepo(l.url)) ?? links.find((l) => BARE_REPO.test(l.url)) ?? links.find((l) => parseRepo(l.url))
}
/** Le dépôt du projet. */
export function projectRepo(ws: Workspace | null): Repo | null {
  const l = projectRepoLink(ws?.links ?? [])
  return l ? parseRepo(l.url) : null
}
/** Nom de branche tapé à la main : « ma branche » → feature/ma-branche (préfixe gardé s'il est donné). */
export function typedBranch(input: string, kind: string): string | null {
  const parts = input.trim().split('/').map((p) => p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')).filter(Boolean)
  if (!parts.length) return null
  return parts.length === 1 ? `${PREFIX[kind] ?? 'feature'}/${parts[0]}` : parts.join('/')
}

export class GitHubError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type Answer = { status: number; ok: boolean; text: () => Promise<string>; remaining: string | null }

async function call(path: string, init: RequestInit, accept: string): Promise<Answer> {
  if (proxy && ghLinked()) {
    const r = await proxy({ method: init.method ?? 'GET', path, body: init.body ? JSON.parse(init.body as string) : undefined, accept })
    return { status: r.status, ok: r.status >= 200 && r.status < 300, text: async () => r.body, remaining: r.remaining }
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  })
  return { status: res.status, ok: res.ok, text: () => res.text(), remaining: res.headers.get('x-ratelimit-remaining') }
}

async function gh<T>(path: string, init: RequestInit = {}, accept = 'application/vnd.github+json'): Promise<T> {
  const linked = ghLinked()
  const res = await call(path, init, accept)
  if (res.status === 401) {
    setGhLinked(false)
    window.dispatchEvent(new Event('kollab:gh-expired'))
    throw new GitHubError('Connexion GitHub expirée : reconnecte GitHub', 401)
  }
  if (res.status === 403 && res.remaining === '0') throw new GitHubError('Limite GitHub atteinte : connecte GitHub pour continuer', 403)
  if (res.status === 404) throw new GitHubError(linked ? 'Introuvable sur GitHub : vérifie que Kollab a accès à ce dépôt' : 'Dépôt privé ou introuvable : connecte GitHub', 404)
  const text = await res.text()
  if (!res.ok) {
    const j = (() => { try { return JSON.parse(text) } catch { return {} } })() as { message?: string; errors?: { message?: string }[] }
    const detail = (j.errors ?? []).map((e) => e.message).filter(Boolean).join(' ')
    throw new GitHubError([j.message ?? `Erreur GitHub ${res.status}`, detail].filter(Boolean).join(' : '), res.status)
  }
  if (res.status === 204 || !text) return undefined as T
  return (accept.includes('json') ? JSON.parse(text) : text) as T
}

const base = (r: Repo) => `/repos/${r.owner}/${r.repo}`

export interface Pull {
  number: number
  title: string
  state: 'open' | 'closed'
  merged: boolean
  draft: boolean
  author: string
  avatar: string
  url: string
  sha: string
  branch: string
  updatedAt: string
  body: string
}
type RawPull = {
  number: number; title: string; state: 'open' | 'closed'; merged_at: string | null; merged?: boolean; draft: boolean
  user: { login: string; avatar_url: string }; html_url: string; head: { sha: string; ref: string }; updated_at: string; body: string | null
}
const toPull = (p: RawPull): Pull => ({
  number: p.number, title: p.title, state: p.state, merged: !!(p.merged ?? p.merged_at), draft: p.draft,
  author: p.user.login, avatar: p.user.avatar_url, url: p.html_url, sha: p.head.sha, branch: p.head.ref, updatedAt: p.updated_at, body: p.body ?? '',
})

export async function listPulls(r: Repo, state: 'open' | 'closed' | 'all' = 'open'): Promise<Pull[]> {
  return (await gh<RawPull[]>(`${base(r)}/pulls?state=${state}&per_page=50&sort=updated&direction=desc`)).map(toPull)
}
export async function getPull(r: Repo, n: number): Promise<Pull> {
  return toPull(await gh<RawPull>(`${base(r)}/pulls/${n}`))
}

export interface PrFile { filename: string; status: string; additions: number; deletions: number; patch?: string }
export const pullFiles = (r: Repo, n: number) => gh<PrFile[]>(`${base(r)}/pulls/${n}/files?per_page=100`)

export interface ReviewComment { id: number; path: string; line: number | null; original_line: number | null; side: 'LEFT' | 'RIGHT'; body: string; user: { login: string; avatar_url: string }; created_at: string }
export const reviewComments = (r: Repo, n: number) => gh<ReviewComment[]>(`${base(r)}/pulls/${n}/comments?per_page=100`)

export interface IssueComment { id: number; body: string; user: { login: string; avatar_url: string }; created_at: string }
export const issueComments = (r: Repo, n: number) => gh<IssueComment[]>(`${base(r)}/issues/${n}/comments?per_page=100`)
/** Relecture : approuver ou demander des changements (le commentaire est obligatoire pour « changements »). */
export const submitReview = (r: Repo, n: number, event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', body = '') =>
  gh<{ id: number; state: string }>(`${base(r)}/pulls/${n}/reviews`, { method: 'POST', body: JSON.stringify({ event, ...(body ? { body } : {}) }) })
export interface Review { id: number; state: string; user: { login: string; avatar_url: string } | null; submitted_at: string }
export const listReviews = (r: Repo, n: number) => gh<Review[]>(`${base(r)}/pulls/${n}/reviews?per_page=100`)
/** Fusionner la PR (squash par défaut, comme dans Kollab). */
export const mergePull = (r: Repo, n: number, method: 'squash' | 'merge' | 'rebase' = 'squash', title?: string) =>
  gh<{ merged: boolean; message: string }>(`${base(r)}/pulls/${n}/merge`, { method: 'PUT', body: JSON.stringify({ merge_method: method, ...(title ? { commit_title: title } : {}) }) })
export const deleteBranch = (r: Repo, branch: string) => gh<void>(`${base(r)}/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'DELETE' })
/** Mergeabilité : GitHub la calcule en différé (null le temps du calcul). */
export const pullMergeable = async (r: Repo, n: number) => {
  const p = await gh<{ mergeable: boolean | null; mergeable_state: string }>(`${base(r)}/pulls/${n}`)
  return { mergeable: p.mergeable, state: p.mergeable_state }
}
export const postComment = (r: Repo, n: number, body: string) => gh<IssueComment>(`${base(r)}/issues/${n}/comments`, { method: 'POST', body: JSON.stringify({ body }) })

export interface CheckRun {
  id: number; name: string; status: 'queued' | 'in_progress' | 'completed'; conclusion: string | null; html_url: string
  started_at: string | null; completed_at: string | null
  output: { title: string | null; summary: string | null; annotations_count: number }
}
export async function checkRuns(r: Repo, sha: string): Promise<CheckRun[]> {
  return (await gh<{ check_runs: CheckRun[] }>(`${base(r)}/commits/${sha}/check-runs?per_page=100`)).check_runs
}
export interface Annotation { path: string; start_line: number; annotation_level: 'notice' | 'warning' | 'failure'; message: string; title: string | null }
export const annotations = (r: Repo, id: number) => gh<Annotation[]>(`${base(r)}/check-runs/${id}/annotations`)

export interface WorkflowRun { id: number; name: string; status: string; conclusion: string | null; html_url: string; run_number: number }
export async function workflowRuns(r: Repo, sha: string): Promise<WorkflowRun[]> {
  return (await gh<{ workflow_runs: WorkflowRun[] }>(`${base(r)}/actions/runs?head_sha=${sha}&per_page=20`)).workflow_runs
}
/** Relance un pipeline (tous les jobs, ou seulement ceux en échec). */
export const rerunWorkflow = (r: Repo, id: number, failedOnly: boolean) =>
  gh<void>(`${base(r)}/actions/runs/${id}/${failedOnly ? 'rerun-failed-jobs' : 'rerun'}`, { method: 'POST' })

/** Résumé des checks : réussis, en échec, en cours. */
export function summarize(runs: CheckRun[]) {
  const done = runs.filter((c) => c.status === 'completed')
  const failed = done.filter((c) => c.conclusion && !['success', 'skipped', 'neutral'].includes(c.conclusion))
  return { total: runs.length, passed: done.length - failed.length, failed: failed.length, running: runs.length - done.length }
}

/* --- Créer la branche et la PR d'une tâche --- */

const PREFIX: Record<string, string> = { feature: 'feature', bug: 'fix', research: 'research' }

/** « Page de connexion GitHub » → feature/page-de-connexion-github */
export function branchName(kind: string, title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')
  return `${PREFIX[kind] ?? 'feature'}/${slug || 'tache'}`
}

export interface Branch { name: string; sha: string }
export async function listBranches(r: Repo): Promise<Branch[]> {
  const rows = await gh<{ name: string; commit: { sha: string } }[]>(`${base(r)}/branches?per_page=100`)
  return rows.map((b) => ({ name: b.name, sha: b.commit.sha }))
}
export const defaultBranch = async (r: Repo) => (await gh<{ default_branch: string }>(base(r))).default_branch

/** Ajoute un commit vide au bout d'une branche (une PR a besoin d'au moins un commit d'écart). */
async function emptyCommit(r: Repo, branch: string, message: string, create: boolean, from?: string): Promise<void> {
  const head = await gh<{ object: { sha: string } }>(`${base(r)}/git/ref/heads/${encodeURIComponent(from ?? branch)}`)
  const parent = await gh<{ tree: { sha: string } }>(`${base(r)}/git/commits/${head.object.sha}`)
  const commit = await gh<{ sha: string }>(`${base(r)}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: parent.tree.sha, parents: [head.object.sha] }),
  })
  if (create) await gh(`${base(r)}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }) })
  else await gh(`${base(r)}/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) })
}

type TaskInfo = { title: string; kind: string; description: string }

async function openPr(r: Repo, branch: string, main: string, task: TaskInfo): Promise<string> {
  const body = `${task.description || ''}\n\n_Créée depuis Kollab._`.trim()
  const open = (draft: boolean) =>
    gh<{ html_url: string }>(`${base(r)}/pulls`, { method: 'POST', body: JSON.stringify({ title: task.title, head: branch, base: main, body, draft }) })
  try {
    return (await open(true)).html_url
  } catch (e) {
    if (!(e instanceof GitHubError) || e.status !== 422) throw e
    if (/no commits/i.test(e.message)) {
      await emptyCommit(r, branch, `Démarre : ${task.title}`, false)
      return (await open(true).catch(() => open(false))).html_url
    }
    // Les brouillons ne sont pas disponibles sur tous les dépôts privés.
    return (await open(false)).html_url
  }
}

/** Ouvre une PR depuis une branche existante (ou renvoie celle déjà ouverte). */
export async function prFromBranch(r: Repo, branch: string, task: TaskInfo): Promise<string> {
  if (!ghLinked()) throw new GitHubError('Connecte GitHub pour créer la PR', 401)
  const existing = await gh<RawPull[]>(`${base(r)}/pulls?state=open&head=${encodeURIComponent(`${r.owner}:${branch}`)}`)
  if (existing[0]) return existing[0].html_url
  return openPr(r, branch, await defaultBranch(r), task)
}

/**
 * Crée une branche depuis la branche principale, avec un premier commit vide
 * (GitHub refuse une PR sans différence), puis ouvre la PR en brouillon. Renvoie l'adresse de la PR.
 */
export async function createTaskPr(r: Repo, task: TaskInfo, wanted?: string): Promise<string> {
  if (!ghLinked()) throw new GitHubError('Connecte GitHub pour créer la PR', 401)
  const main = await defaultBranch(r)
  const taken = new Set((await listBranches(r)).map((b) => b.name))
  const first = wanted || branchName(task.kind, task.title)
  let branch = first
  for (let i = 2; taken.has(branch); i++) branch = `${first}-${i}`
  await emptyCommit(r, branch, `Démarre : ${task.title}`, true, main)
  return openPr(r, branch, main, task)
}

/* --- Dépôt du projet --- */

export interface RepoInfo {
  fullName: string; description: string | null; private: boolean; stars: number; defaultBranch: string
  pushedAt: string; openIssues: number; ownerAvatar: string; url: string; language: string | null
}
type RawRepo = {
  full_name: string; description: string | null; private: boolean; stargazers_count: number; default_branch: string
  pushed_at: string; open_issues_count: number; owner: { avatar_url: string }; html_url: string; language: string | null
}
const toRepo = (r: RawRepo): RepoInfo => ({
  fullName: r.full_name, description: r.description, private: r.private, stars: r.stargazers_count, defaultBranch: r.default_branch,
  pushedAt: r.pushed_at, openIssues: r.open_issues_count, ownerAvatar: r.owner.avatar_url, url: r.html_url, language: r.language,
})
export const getRepo = async (r: Repo) => toRepo(await gh<RawRepo>(base(r)))
/** Dépôts accessibles avec la connexion GitHub, les plus récents d'abord. */
export async function myRepos(): Promise<RepoInfo[]> {
  return (await gh<RawRepo[]>('/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator,organization_member')).map(toRepo)
}
