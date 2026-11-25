import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../lib/store'
import type { Member } from '../lib/types'
import { useCall, type CallPeer } from '../lib/calls'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { openPlans, usePlanAllows } from './Plans'

const canShare = () => typeof navigator !== 'undefined' && 'getDisplayMedia' in (navigator.mediaDevices ?? {})

function Media({ stream, muted = false, video = false, className }: { stream: MediaStream | null; muted?: boolean; video?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])
  return video ? <video ref={ref} className={className} autoPlay playsInline muted={muted} /> : <audio ref={ref} autoPlay muted={muted} />
}

function useTimer(from: number | null) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!from) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [from])
  if (!from) return ''
  const s = Math.max(0, Math.floor((now - from) / 1000))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')
  return `${h ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`
}

/** Icônes appel et vidéo (en-tête du chat, fiche d'un membre). */
export function CallButtons({ targets, channelId, label, size = 'md' }: { targets: string[] | null; channelId: string | null; label: string; size?: 'sm' | 'md' }) {
  const c = useCall()
  const groupCalls = usePlanAllows('groupCalls')
  if (!c) return null
  const live = channelId && !targets ? c.live[channelId] : undefined
  const busy = !!c.call
  if (live && !busy)
    return (
      <button className="call-join" onClick={() => void c.joinLive(channelId!, label)} title="Rejoindre l'appel en cours">
        <Icon name="phone" size={16} /> Rejoindre · {live.people.length}
      </button>
    )
  // Appel de groupe (un salon, ou plusieurs personnes) : réservé aux offres payantes.
  const group = targets === null || targets.length > 1
  const go = (video: boolean) => (group && !groupCalls ? openPlans() : void c.start({ targets, channelId, label, video }))
  return (
    <span className={`call-icons ${size}`}>
      <button className="call-ic" aria-label={`Appeler ${label}`} title="Appel" disabled={busy} onClick={() => go(false)}><Icon name="phone" size={size === 'sm' ? 16 : 19} /></button>
      <button className="call-ic" aria-label={`Appel vidéo ${label}`} title="Appel vidéo" disabled={busy} onClick={() => go(true)}><Icon name="video" size={size === 'sm' ? 16 : 19} /></button>
    </span>
  )
}

/** Tout l'affichage des appels : sonnerie au centre, appel plein écran, mini-fenêtre. */
export function CallLayer() {
  const c = useCall()
  const { workspace, user } = useStore()
  if (!c || !workspace) return null
  const member = (id: string) => workspace.members.find((m) => m.id === id)
  const me = member(user?.id ?? 'me') ?? workspace.members[0]

  return (
    <>
      {/* Son des autres, toujours joué, même réduit. */}
      <div hidden>{c.peers.map((p) => p.stream && <Media key={p.peer} stream={p.stream} />)}</div>
      {c.incoming && <Incoming member={member(c.incoming.from)} />}
      {c.call && (c.minimized ? <Mini member={member} me={me} /> : <Stage member={member} me={me} />)}
      {(c.error || c.notice) && !c.incoming && (
        <div className={`call-toast${c.error ? ' err' : ''}`} role="status">{c.error ?? c.notice}</div>
      )}
    </>
  )
}

function Incoming({ member }: { member?: Member }) {
  const c = useCall()!
  const inc = c.incoming!
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && c.decline()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [c])
  const name = member?.name ?? 'Quelqu\'un'
  return createPortal(
    <div className="ring-back" role="alertdialog" aria-modal="true" aria-label={`${name} t'appelle`}>
      <div className="ring-card">
        <div className="ring-who">
          <span className="ring-pulse">{member && <Avatar member={member} size={112} />}</span>
          <h2>{name} t'appelle</h2>
          <p>{inc.video ? 'Appel vidéo' : 'Appel'}{inc.group && inc.label ? ` · ${inc.label}` : ''}</p>
        </div>
        <div className="ring-acts">
          <button className="ring-btn" onClick={c.decline}><i className="red"><Icon name="phoneOff" size={26} /></i>Refuser</button>
          <button className="ring-btn" onClick={() => void c.accept(false)}><i className="green"><Icon name="phone" size={26} /></i>Décrocher</button>
          <button className="ring-btn video" onClick={() => void c.accept(true)}><i className="indigo"><Icon name="video" size={26} /></i>En vidéo</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

type Tile = CallPeer & { self?: boolean; screen?: boolean }

function Controls({ big = false }: { big?: boolean }) {
  const c = useCall()!
  const s = big ? 24 : 18
  return (
    <div className={`call-ctrls${big ? ' big' : ''}`}>
      <button className={`cb${c.muted ? ' off' : ''}`} aria-pressed={c.muted} aria-label={c.muted ? 'Activer le micro' : 'Couper le micro'} title={c.muted ? 'Activer le micro' : 'Couper le micro'} onClick={c.toggleMute}><Icon name={c.muted ? 'micOff' : 'mic'} size={s} /></button>
      <button className={`cb${c.video === 'camera' ? ' on' : ''}`} aria-pressed={c.video === 'camera'} aria-label="Caméra" title="Caméra" onClick={() => void c.toggleCamera()}><Icon name="video" size={s} /></button>
      {big && canShare() && <button className={`cb desk${c.video === 'screen' ? ' on' : ''}`} aria-pressed={c.video === 'screen'} aria-label="Partager l'écran" title="Partager l'écran" onClick={() => void c.toggleScreen()}><Icon name="screen" size={s} /></button>}
      {!big && <button className="cb" aria-label="Agrandir" title="Agrandir" onClick={() => c.setMinimized(false)}><Icon name="grow" size={s} /></button>}
      <button className="cb end" aria-label="Raccrocher" title="Raccrocher" onClick={c.hangUp}><Icon name="phoneOff" size={s} /></button>
    </div>
  )
}

function TileView({ t, member, me, size }: { t: Tile; member: (id: string) => Member | undefined; me?: Member; size: number }) {
  const c = useCall()!
  const m = t.self ? me : member(t.userId)
  return (
    <div className={`call-tile${t.speaking ? ' speaking' : ''}${t.hasVideo ? ' has-video' : ''}`}>
      {t.hasVideo ? (
        <Media stream={t.stream} video muted className={t.self && c.video === 'camera' ? 'mirror' : ''} />
      ) : (
        m && <Avatar member={m} size={size} />
      )}
      <span className="call-name">
        {t.self && c.muted && <Icon name="micOff" size={14} />}
        {t.self ? 'Toi' : m?.name.split(' ')[0] ?? 'Invité'}
        {(t.self ? c.video === 'screen' : t.screen) && ' · écran partagé'}
      </span>
    </div>
  )
}

function Stage({ member, me }: { member: (id: string) => Member | undefined; me?: Member }) {
  const c = useCall()!
  const call = c.call!
  const timer = useTimer(call.startedAt)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && c.setMinimized(true)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [c])

  const self: Tile = { peer: 'me', userId: me?.id ?? '', stream: c.local, speaking: c.speakingMe, hasVideo: c.video !== 'off', self: true, screen: c.video === 'screen' }
  const others = c.peers as Tile[]
  // Un écran partagé (le sien ou celui d'un autre) prend la grande place, les visages passent à droite.
  const featured = c.video === 'screen' ? self : others.find((p) => p.hasVideo && p.screen)
  const rest = [self, ...others].filter((t) => t !== featured)
  const calling = call.state === 'calling'
  const names = calling ? call.label : [me?.name.split(' ')[0] ?? 'Toi', ...others.map((p) => member(p.userId)?.name.split(' ')[0] ?? 'Invité')].join(', ')
  const target = call.targets?.length === 1 ? member(call.targets[0]) : undefined

  return createPortal(
    <div className="call-stage" role="dialog" aria-modal="true" aria-label="Appel en cours">
      <header className="call-top">
        <strong>{names}</strong>
        <span className="call-time">{calling ? 'Ça sonne…' : timer}</span>
        <button className="call-ghost" aria-label="Réduire" title="Réduire" onClick={() => c.setMinimized(true)}><Icon name="shrink" size={19} /></button>
      </header>

      {calling ? (
        <div className="call-calling">
          <span className="ring-pulse">{target ? <Avatar member={target} size={132} /> : <span className="call-hash">#</span>}</span>
          <p>{target ? `On appelle ${target.name}…` : `On appelle ${call.label}…`}</p>
          {c.video === 'camera' && <div className="call-selfview"><Media stream={c.local} video muted className="mirror" /></div>}
        </div>
      ) : featured ? (
        <div className="call-grid featured">
          <TileView t={featured} member={member} me={me} size={120} />
          <div className="call-side">{rest.map((t) => <TileView key={t.peer} t={t} member={member} me={me} size={72} />)}</div>
        </div>
      ) : (
        <div className={`call-grid n${Math.min(rest.length, 6)}`}>{rest.map((t) => <TileView key={t.peer} t={t} member={member} me={me} size={110} />)}</div>
      )}

      <Controls big />
    </div>,
    document.body,
  )
}

function Mini({ member, me }: { member: (id: string) => Member | undefined; me?: Member }) {
  const c = useCall()!
  const call = c.call!
  const timer = useTimer(call.startedAt)
  const main: Tile = (c.peers.find((p) => p.speaking) ?? c.peers[0] ?? { peer: 'me', userId: me?.id ?? '', stream: c.local, speaking: c.speakingMe, hasVideo: c.video !== 'off', self: true }) as Tile
  const m = main.self ? me : member(main.userId)
  return createPortal(
    <div className="call-mini" role="region" aria-label="Appel en cours">
      <button className={`call-mini-view${main.speaking ? ' speaking' : ''}`} onClick={() => c.setMinimized(false)} title="Agrandir">
        {main.hasVideo ? <Media stream={main.stream} video muted /> : m && <Avatar member={m} size={60} />}
        <span className="call-name">{call.state === 'calling' ? 'Ça sonne…' : `${call.label} · ${timer}`}</span>
      </button>
      <Controls />
    </div>,
    document.body,
  )
}
