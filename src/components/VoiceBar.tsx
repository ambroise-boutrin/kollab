import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../lib/store'
import type { Member } from '../lib/types'
import { useVoice, type VoicePeer } from '../lib/voice'
import { Avatar } from './Avatar'
import { Icon } from './Icon'

function Media({ stream, muted = false, video = false, className }: { stream: MediaStream | null; muted?: boolean; video?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])
  return video ? <video ref={ref} className={className} autoPlay playsInline muted={muted} /> : <audio ref={ref} autoPlay muted={muted} />
}

/** Barre du salon vocal : visible partout tant qu'on y est, avec micro, caméra, écran et la scène vidéo. */
export function VoiceBar() {
  const v = useVoice()
  const { workspace, user } = useStore()
  const [stage, setStage] = useState(false)
  if (!v || !workspace) return null
  const member = (id: string) => workspace.members.find((m) => m.id === id)
  const me = member(user?.id ?? 'me') ?? workspace.members[0]

  return (
    <>
      {/* Son des autres, toujours joué même si la scène est fermée. */}
      <div hidden>{v.peers.map((p) => <Media key={p.peer} stream={p.stream} />)}</div>

      {v.error && !v.joined && <div className="voice-error" role="alert">{v.error}</div>}

      {v.joined && (
        <div className="voice-bar" role="region" aria-label="Salon vocal">
          <button className="voice-who" onClick={() => setStage(true)} title="Voir la scène">
            <span className={`voice-ring${v.speakingMe ? ' on' : ''}`}>{me && <Avatar member={me} size={30} />}</span>
            {v.peers.map((p) => {
              const m = member(p.userId)
              return m ? <span key={p.peer} className={`voice-ring${p.speaking ? ' on' : ''}`}><Avatar member={m} size={30} /></span> : null
            })}
            <span className="voice-label">
              <strong>Vocal</strong>
              <span>{v.peers.length ? `${v.peers.length + 1} personnes` : 'Tu es seul pour l\'instant'}</span>
            </span>
          </button>
          <div className="voice-ctrls">
            <button className={`vbtn${v.muted ? ' off' : ''}`} aria-pressed={v.muted} aria-label={v.muted ? 'Activer le micro' : 'Couper le micro'} onClick={v.toggleMute}><Icon name={v.muted ? 'micOff' : 'mic'} size={18} /></button>
            <button className={`vbtn${v.video === 'camera' ? ' on' : ''}`} aria-pressed={v.video === 'camera'} aria-label="Caméra" onClick={() => void v.toggleCamera().then(() => setStage(true))}><Icon name="camera" size={18} /></button>
            {'getDisplayMedia' in (navigator.mediaDevices ?? {}) && (
              <button className={`vbtn${v.video === 'screen' ? ' on' : ''}`} aria-pressed={v.video === 'screen'} aria-label="Partager l'écran" onClick={() => void v.toggleScreen().then(() => setStage(true))}><Icon name="screen" size={18} /></button>
            )}
            <button className="vbtn leave" aria-label="Quitter le vocal" onClick={() => { setStage(false); v.leave() }}><Icon name="phoneOff" size={18} /></button>
          </div>
        </div>
      )}

      {v.joined && stage && <Stage onClose={() => setStage(false)} member={member} me={me} />}
    </>
  )
}

function Stage({ onClose, member, me }: { onClose: () => void; member: (id: string) => Member | undefined; me?: Member }) {
  const v = useVoice()!
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const tiles: (VoicePeer & { self?: boolean })[] = [
    { peer: 'me', userId: me?.id ?? '', stream: v.local, speaking: v.speakingMe, hasVideo: v.video !== 'off', self: true },
    ...v.peers,
  ]
  return createPortal(
    <div className="stage-back" role="dialog" aria-modal="true" aria-label="Vocal et visio">
      <header className="stage-top">
        <strong>Vocal</strong>
        <span>{tiles.length} personne{tiles.length > 1 ? 's' : ''}</span>
        <button className="viewer-btn icon" style={{ marginLeft: 'auto' }} aria-label="Réduire" onClick={onClose}><Icon name="close" size={20} /></button>
      </header>
      <div className={`stage-grid n${Math.min(tiles.length, 6)}`}>
        {tiles.map((t) => {
          const m = member(t.userId) ?? me
          return (
            <div key={t.peer} className={`stage-tile${t.speaking ? ' speaking' : ''}`}>
              {t.hasVideo ? (
                <Media stream={t.stream} video muted className={t.self && v.video === 'camera' ? 'mirror' : ''} />
              ) : (
                m && <span className="stage-avatar"><Avatar member={m} size={96} /></span>
              )}
              <span className="stage-name">
                {t.self && v.muted && <Icon name="micOff" size={14} />}
                {t.self ? 'Toi' : m?.name ?? 'Invité'}
                {t.self && v.video === 'screen' && ' · écran partagé'}
              </span>
            </div>
          )
        })}
      </div>
      <div className="stage-ctrls">
        <button className={`vbtn big${v.muted ? ' off' : ''}`} aria-label={v.muted ? 'Activer le micro' : 'Couper le micro'} onClick={v.toggleMute}><Icon name={v.muted ? 'micOff' : 'mic'} size={22} /></button>
        <button className={`vbtn big${v.video === 'camera' ? ' on' : ''}`} aria-label="Caméra" onClick={() => void v.toggleCamera()}><Icon name="camera" size={22} /></button>
        {'getDisplayMedia' in (navigator.mediaDevices ?? {}) && <button className={`vbtn big${v.video === 'screen' ? ' on' : ''}`} aria-label="Partager l'écran" onClick={() => void v.toggleScreen()}><Icon name="screen" size={22} /></button>}
        <button className="vbtn big leave" aria-label="Quitter le vocal" onClick={() => { onClose(); v.leave() }}><Icon name="phoneOff" size={22} /></button>
      </div>
    </div>,
    document.body,
  )
}

/** Bouton pour rejoindre le vocal, avec les personnes déjà dedans. */
export function VoiceJoin({ compact = false }: { compact?: boolean }) {
  const v = useVoice()
  const { workspace } = useStore()
  if (!v || !workspace) return null
  const inside = workspace.members.filter((m) => v.present.includes(m.id))
  if (v.joined) return null
  return (
    <button className={`voice-join${inside.length ? ' live' : ''}${compact ? ' compact' : ''}`} onClick={() => void v.join()} disabled={v.joining}>
      <Icon name="mic" size={16} />
      {v.joining ? 'Connexion…' : inside.length ? `Rejoindre le vocal · ${inside.length}` : 'Lancer le vocal'}
      {inside.length > 0 && !compact && <span className="voice-join-faces">{inside.slice(0, 3).map((m) => <Avatar key={m.id} member={m} size={20} />)}</span>}
    </button>
  )
}
