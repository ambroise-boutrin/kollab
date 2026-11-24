import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { disablePush, enablePush, pushEnabled, pushSupport } from '../lib/push'
import { useStore } from '../lib/store'

/** Notifications sur cet appareil : attribution, mention, invitation, même appli fermée. */
export function PushCard() {
  const { backend, workspace, user, reload } = useStore()
  const me = workspace?.members.find((m) => m.id === user?.id)
  const weekly = me?.weeklyEmail !== false
  const toast = useToast()
  const support = pushSupport()
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void pushEnabled().then(setOn)
  }, [])

  async function toggle() {
    if (!backend.push) return toast('Pas de notifications en démo')
    setBusy(true)
    try {
      if (on) {
        await disablePush(backend.push)
        setOn(false)
        toast('Notifications coupées sur cet appareil')
      } else {
        await enablePush(backend.push)
        setOn(true)
        toast('Notifications activées')
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action impossible')
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    if (!backend.push) return
    try {
      const n = await backend.push.test()
      toast(n ? 'Notification envoyée' : 'Aucun appareil joignable')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Envoi impossible')
    }
  }

  return (
    <section className="card push-card">
      <div className="setting-row">
        <span className="push-ico"><Icon name="bell" size={22} /></span>
        <div className="pop-grow">
          <strong>Sur cet appareil</strong>
          <span className="muted">Tâche attribuée, mention, invitation : même quand Kollab est fermé.</span>
        </div>
        {support === 'ok' && (
          <button type="button" role="switch" aria-checked={on} aria-label="Notifications sur cet appareil" className="switch" disabled={busy} onClick={() => void toggle()}>
            <span />
          </button>
        )}
      </div>
      {support === 'ios-install' && (
        <p className="push-hint">
          Sur iPhone, ajoute d'abord Kollab à l'écran d'accueil : bouton <Icon name="share" size={15} /> Partager, puis « Sur l'écran d'accueil ». Ouvre Kollab depuis l'icône et reviens ici.
        </p>
      )}
      {support === 'no' && <p className="push-hint">Pas disponible ici. Ouvre Kollab dans Chrome, Edge, Firefox ou Safari sur ton téléphone.</p>}
      {support === 'ok' && on && (
        <button className="btn small soft" style={{ alignSelf: 'flex-start' }} onClick={() => void test()}>Envoyer un essai</button>
      )}
      {me && (
        <div className="setting-row">
          <span className="push-ico"><Icon name="sprint" size={22} /></span>
          <div className="pop-grow">
            <strong>Résumé du lundi</strong>
            <span className="muted">Par email à 8 h : tâches finies, PR fusionnées, ce qui traîne.</span>
          </div>
          <button
            type="button" role="switch" aria-checked={weekly} aria-label="Résumé du lundi par email" className="switch"
            onClick={async () => {
              try {
                await backend.updateProfile({ weeklyEmail: !weekly })
                await reload()
                toast(weekly ? 'Résumé du lundi coupé' : 'Résumé du lundi activé')
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Enregistrement impossible')
              }
            }}
          >
            <span />
          </button>
        </div>
      )}
    </section>
  )
}
