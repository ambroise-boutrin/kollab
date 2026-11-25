import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { useToast } from './Toast'
import { useStore } from '../lib/store'
import { IS_DESKTOP } from '../lib/updates'
import { PLAN_LIMITS, type Billing, type Offer, type Plan } from '../lib/types'

/** Ouvre la fenêtre des offres (depuis n'importe où). */
export const openPlans = () => window.dispatchEvent(new Event('kollab:plans'))

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

const PLAN_NAME: Record<Plan, string> = { free: 'Gratuit', team: 'Équipe', founder: 'Fondateur' }

type Ctx = { billing: Billing | null; refresh: () => Promise<Billing | null> }
const BillingCtx = createContext<Ctx>({ billing: null, refresh: async () => null })

/** Offre du projet ouvert. null tant que la base ne connaît pas les abonnements : rien n'est alors bloqué. */
export const useBilling = () => useContext(BillingCtx).billing

/** Fonctions réservées aux offres payantes ; vrai tant que l'offre n'est pas connue. */
export function usePlanAllows(feature: 'discord' | 'groupCalls') {
  const b = useBilling()
  return !b || PLAN_LIMITS[b.plan][feature]
}

/** Ouvre Stripe dans une petite fenêtre (le navigateur sur l'ordi). Kollab reste ouvert derrière. */
async function openStripe(url: string) {
  if (IS_DESKTOP) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
    return
  }
  const w = 520, h = 760
  const popup = window.open(url, 'kollab-paiement', `popup,width=${w},height=${h},left=${Math.round(window.screenX + (window.outerWidth - w) / 2)},top=${Math.round(window.screenY + (window.outerHeight - h) / 2)}`)
  if (!popup) window.location.assign(url)
}

/** Garde l'offre à jour, et montre la fenêtre des offres, le blocage et le bandeau d'impayé. */
export function BillingProvider({ children }: { children: ReactNode }) {
  const { backend, workspace, user } = useStore()
  const toast = useToast()
  const gid = workspace?.group.id
  const [billing, setBilling] = useState<Billing | null>(null)
  const [plans, setPlans] = useState(false)
  const [lockOpen, setLockOpen] = useState(true)
  const watch = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const refresh = useCallback(async () => {
    const b = await backend.billingInfo().catch(() => null)
    setBilling(b)
    return b
  }, [backend])

  useEffect(() => {
    setBilling(null)
    setLockOpen(true)
    if (!gid) return
    void refresh()
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    // Retour de Stripe en pleine page : on prévient, puis on nettoie l'adresse.
    const q = new URLSearchParams(window.location.search)
    if (q.get('paiement') === 'ok') toast('Merci ! Ton offre s’active dans un instant.')
    if (q.has('paiement')) {
      q.delete('paiement')
      q.delete('groupe')
      window.history.replaceState(null, '', window.location.pathname + (q.size ? `?${q}` : '') + window.location.hash)
    }
    return () => window.removeEventListener('focus', onFocus)
  }, [gid, refresh, toast])

  useEffect(() => {
    const on = () => setPlans(true)
    window.addEventListener('kollab:plans', on)
    return () => window.removeEventListener('kollab:plans', on)
  }, [])
  useEffect(() => () => clearInterval(watch.current), [])

  /** Après l'ouverture de Stripe : on regarde l'offre toutes les 4 s pendant 10 min. */
  const waitForPayment = useCallback((before: Plan) => {
    clearInterval(watch.current)
    const started = Date.now()
    watch.current = setInterval(async () => {
      const b = await refresh()
      if (b && b.plan !== before) {
        clearInterval(watch.current)
        setPlans(false)
        toast(b.plan === 'free' ? 'Le projet est repassé en Gratuit' : `Offre ${PLAN_NAME[b.plan]} active. Merci !`)
      } else if (Date.now() - started > 10 * 60e3) clearInterval(watch.current)
    }, 4000)
  }, [refresh, toast])

  const pay = useCallback(async (offer: Offer) => {
    try {
      await openStripe(await backend.checkoutUrl(offer))
      waitForPayment(billing?.plan ?? 'free')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Paiement impossible')
    }
  }, [backend, billing?.plan, toast, waitForPayment])

  const portal = useCallback(async () => {
    try {
      await openStripe(await backend.billingPortalUrl())
      waitForPayment(billing?.plan ?? 'free')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ouverture impossible')
    }
  }, [backend, billing?.plan, toast, waitForPayment])

  const me = workspace?.members.find((m) => m.id === user?.id)
  const isAdmin = me?.role === 'admin' || backend.mode === 'demo'
  const late = billing?.status === 'past_due' && billing.plan !== 'free'

  return (
    <BillingCtx.Provider value={{ billing, refresh }}>
      {children}
      {billing?.locked && (
        <button className="plan-bar" onClick={() => setLockOpen(true)}>
          <Icon name="lock" size={16} />
          <span><b>Lecture seule :</b> ce groupe dépasse l'offre {PLAN_NAME[billing.plan]}</span>
        </button>
      )}
      {late && !billing.locked && (
        <button className="plan-bar" onClick={() => void (isAdmin ? portal() : undefined)}>
          <Icon name="lock" size={16} />
          <span><b>Paiement refusé.</b> Le groupe reste ouvert jusqu'au {new Date(billing.graceUntil ?? Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.{isAdmin ? ' Mettre à jour la carte' : ''}</span>
        </button>
      )}
      {plans && billing && workspace && (
        <PlansDialog billing={billing} groupName={workspace.group.name} isAdmin={isAdmin} onPay={pay} onPortal={portal} onClose={() => setPlans(false)} />
      )}
      {billing?.locked && lockOpen && !plans && (
        <LockDialog billing={billing} isAdmin={isAdmin} onPay={() => void pay('team_month')} onClose={() => setLockOpen(false)} />
      )}
    </BillingCtx.Provider>
  )
}

/** Fenêtre au centre avec les trois offres (piste A). */
function PlansDialog({ billing, groupName, isAdmin, onPay, onPortal, onClose }: {
  billing: Billing; groupName: string; isAdmin: boolean
  onPay: (o: Offer) => Promise<void>; onPortal: () => Promise<void>; onClose: () => void
}) {
  const [yearly, setYearly] = useState(false)
  const [busy, setBusy] = useState<Offer | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const paid = billing.plan !== 'free'
  const founderOpen = billing.founderLeft > 0 && Date.now() < Date.UTC(2027, 4, 1)
  const go = async (o: Offer) => {
    setBusy(o)
    await onPay(o)
    setBusy(null)
  }

  return createPortal(
    <div className="modal-back sheet-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal plans" role="dialog" aria-modal="true" aria-labelledby="plans-title">
        <div className="plans-head">
          <div>
            <h2 id="plans-title">Choisis l'offre du groupe</h2>
            <p className="muted">{groupName} · {billing.members} membre{billing.members > 1 ? 's' : ''} · offre {PLAN_NAME[billing.plan]}</p>
          </div>
          <div className="plans-tools">
            <div className="plans-switch" role="group" aria-label="Paiement">
              <button className={yearly ? '' : 'on'} aria-pressed={!yearly} onClick={() => setYearly(false)}>Mensuel</button>
              <button className={yearly ? 'on' : ''} aria-pressed={yearly} onClick={() => setYearly(true)}>Annuel · 2 mois offerts</button>
            </div>
            <button className="icon-btn plans-close" aria-label="Fermer" onClick={onClose}><Icon name="close" size={18} /></button>
          </div>
        </div>

        <div className="plans-grid">
          <section className="plan-card">
            <div className="plan-top"><h3>Gratuit</h3>{billing.plan === 'free' && <span className="plan-tag">Actuelle</span>}</div>
            <div className="plan-price"><b>0 €</b></div>
            <ul>
              <li>5 membres</li>
              <li>1 Go de fichiers</li>
              <li>Tableau, sprints, chat, documents</li>
              <li className="muted">Sans Discord ni appels de groupe</li>
            </ul>
            <button className="btn soft" disabled>{billing.plan === 'free' ? 'Offre actuelle' : 'Inclus'}</button>
          </section>

          <section className="plan-card plan-team">
            <div className="plan-top"><h3>Équipe</h3><span className="plan-tag">{billing.plan === 'team' ? (billing.trialEnd ? `Essai · ${shortDate(billing.trialEnd)}` : 'Actuelle') : billing.trialUsed ? 'Conseillée' : '30 jours offerts'}</span></div>
            <div className="plan-price"><b>{yearly ? '100 €' : '10 €'}</b><span>{yearly ? 'par an' : 'par mois'}</span></div>
            <ul>
              <li>25 membres</li>
              <li>20 Go de fichiers</li>
              <li>Discord relié au chat</li>
              <li>Appels et visio à plusieurs</li>
            </ul>
            {paid ? (
              <button className="btn plan-btn-light" disabled={!isAdmin} onClick={() => void onPortal()}>Gérer l'abonnement</button>
            ) : (
              <button className="btn plan-btn-light" disabled={!isAdmin || busy !== null} onClick={() => void go(yearly ? 'team_year' : 'team_month')}>
                {busy === 'team_month' || busy === 'team_year' ? 'Ouverture…' : billing.trialUsed ? 'Passer à Équipe' : 'Essayer 30 jours'}
              </button>
            )}
          </section>

          <section className="plan-card plan-founder">
            <div className="plan-top"><h3>Fondateur</h3><span className="plan-tag">{billing.plan === 'founder' ? 'Actuelle' : `${billing.founderLeft} place${billing.founderLeft > 1 ? 's' : ''}`}</span></div>
            <div className="plan-price"><b>49 €</b><span>par an</span></div>
            <ul>
              <li>Tout ce qu'a Équipe</li>
              <li>Prix bloqué tant que tu restes</li>
              <li>Jusqu'au 30 avril 2027</li>
              <li>Ton avis compte pour la suite</li>
            </ul>
            <button className="btn dark" disabled={!isAdmin || paid || !founderOpen || busy !== null} onClick={() => void go('founder')}>
              {busy === 'founder' ? 'Ouverture…' : founderOpen ? 'Devenir fondateur' : 'Complet'}
            </button>
          </section>
        </div>

        <p className="plans-foot muted">
          {isAdmin ? (billing.trialUsed ? 'Renouvellement automatique. Résiliable en un clic, depuis Réglages.' : '30 jours offerts, puis renouvellement automatique. Résiliable en un clic, avant ou après l’essai.') : 'Seul un admin du groupe peut changer l’offre.'}
          {isAdmin && billing.hasCustomer && <> · <button className="link-btn" onClick={() => void onPortal()}>Factures et carte</button></>}
        </p>
      </div>
    </div>,
    document.body,
  )
}

/** Groupe au-delà de son offre : lecture seule, rien n'est supprimé (piste A). */
function LockDialog({ billing, isAdmin, onPay, onClose }: { billing: Billing; isAdmin: boolean; onPay: () => void; onClose: () => void }) {
  const { workspace } = useStore()
  const navigate = useNavigate()
  const members = workspace?.members ?? []
  const extra = members.length - 4
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="modal-back sheet-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal lock-card" role="dialog" aria-modal="true" aria-labelledby="lock-title">
        <button className="icon-btn plans-close" aria-label="Voir en lecture seule" onClick={onClose}><Icon name="close" size={18} /></button>
        <div className="lock-faces" aria-hidden="true">
          {members.slice(0, 4).map((m) => <Avatar key={m.id} member={m} size={44} />)}
          {extra > 0 && <span className="lock-more">+{extra}</span>}
        </div>
        <div>
          <h2 id="lock-title">{billing.members} membres, l'offre {PLAN_NAME[billing.plan]} en permet {billing.memberLimit}</h2>
          <p className="muted">Le groupe est en lecture seule. Rien n'est supprimé : tout revient dès le passage à Équipe.</p>
        </div>
        <div className="lock-meter">
          <div><span>Membres</span><b>{billing.members} / {billing.memberLimit}</b></div>
          <i><span style={{ width: '100%' }} /></i>
        </div>
        {isAdmin ? (
          <div className="lock-actions">
            <button className="btn big" onClick={onPay}>Passer à Équipe · 10 €/mois</button>
            <button className="btn soft" onClick={() => { onClose(); navigate('/equipe') }}>Retirer des membres</button>
            <button className="link-btn" onClick={() => { onClose(); openPlans() }}>Voir toutes les offres</button>
          </div>
        ) : (
          <p className="lock-note">Seul un admin du groupe peut payer. Préviens-le pour rouvrir le groupe.</p>
        )}
      </div>
    </div>,
    document.body,
  )
}
