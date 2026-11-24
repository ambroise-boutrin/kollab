import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Room, RoomEvent } from './backend'
import { useStore } from './store'
import { presenceOf } from './types'

/**
 * Appels façon Skype, en pair à pair (WebRTC) : la voix et la vidéo vont directement d'un membre à l'autre,
 * Supabase ne sert qu'à sonner et à se trouver (signalisation). Idéal jusqu'à 5 ou 6 personnes.
 *
 * - Salle « calls » du projet, toujours écoutée : sonneries (ring), refus, annulations et appels en cours (live).
 * - Salle « call:<id> » par appel : la signalisation WebRTC, rejointe quand on appelle ou qu'on décroche.
 */

const ICE: RTCConfiguration = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] }
/** Durée de la sonnerie avant « Appel manqué ». */
export const RING_MS = 30_000

export interface CallPeer {
  peer: string
  userId: string
  stream: MediaStream | null
  speaking: boolean
  hasVideo: boolean
  /** Partage son écran. */
  screen?: boolean
}

export interface CurrentCall {
  id: string
  callerId: string
  /** Personnes appelées ; null = tout le salon. */
  targets: string[] | null
  channelId: string | null
  /** « # général » ou le nom de la personne. */
  label: string
  state: 'calling' | 'active'
  startedAt: number | null
}

export interface IncomingCall {
  id: string
  from: string
  video: boolean
  label: string
  channelId: string | null
  group: boolean
}

export interface CallState {
  call: CurrentCall | null
  incoming: IncomingCall | null
  /** Appels en cours dans les salons (pour « Rejoindre »). */
  live: Record<string, { callId: string; people: string[] }>
  muted: boolean
  video: 'off' | 'camera' | 'screen'
  peers: CallPeer[]
  local: MediaStream | null
  speakingMe: boolean
  minimized: boolean
  error: string | null
  notice: string | null
  /** Appeler des personnes (ou tout le salon avec targets null). */
  start(opts: { targets: string[] | null; channelId: string | null; label: string; video: boolean }): Promise<void>
  /** Rejoindre un appel de salon déjà en cours. */
  joinLive(channelId: string, label: string): Promise<void>
  accept(video: boolean): Promise<void>
  decline(): void
  hangUp(): void
  toggleMute(): void
  toggleCamera(): Promise<void>
  toggleScreen(): Promise<void>
  setMinimized(on: boolean): void
}

const Ctx = createContext<CallState | null>(null)
export const useCall = () => useContext(Ctx)

type Conn = { pc: RTCPeerConnection; polite: boolean; makingOffer: boolean; ignoreOffer: boolean; userId: string; stream: MediaStream | null }

/** Sonnerie douce en deux notes, jouée sans fichier son. */
function ringer(kind: 'in' | 'out') {
  let ctx: AudioContext | null = null
  try {
    ctx = new AudioContext()
  } catch {
    return () => {}
  }
  const c = ctx
  const beep = (at: number, f: number, len: number) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.frequency.value = f
    o.type = 'sine'
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(kind === 'in' ? 0.16 : 0.06, at + 0.03)
    g.gain.setValueAtTime(kind === 'in' ? 0.16 : 0.06, at + len - 0.05)
    g.gain.linearRampToValueAtTime(0, at + len)
    o.connect(g).connect(c.destination)
    o.start(at)
    o.stop(at + len)
  }
  const play = () => {
    void c.resume().catch(() => {})
    const t = c.currentTime + 0.05
    if (kind === 'in') {
      beep(t, 660, 0.35)
      beep(t + 0.4, 880, 0.5)
    } else beep(t, 440, 0.9)
  }
  play()
  const id = setInterval(play, kind === 'in' ? 2200 : 3500)
  return () => {
    clearInterval(id)
    void c.close().catch(() => {})
  }
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { backend, user, workspace } = useStore()
  const groupId = workspace?.group.id
  const demo = backend.mode === 'demo'
  const me = user?.id ?? 'me'
  const meRef = useRef(me)
  meRef.current = me
  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace

  const [call, setCall] = useState<CurrentCall | null>(null)
  const [incoming, setIncoming] = useState<IncomingCall | null>(null)
  const [live, setLive] = useState<Record<string, { callId: string; people: string[]; at: number }>>({})
  const [muted, setMuted] = useState(false)
  const [video, setVideo] = useState<'off' | 'camera' | 'screen'>('off')
  const [peers, setPeers] = useState<CallPeer[]>([])
  const [local, setLocal] = useState<MediaStream | null>(null)
  const [speakingMe, setSpeakingMe] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [botPeers, setBotPeers] = useState<CallPeer[]>([])

  const myPeer = useRef(crypto.randomUUID())
  const signal = useRef<Room | null>(null)
  const media = useRef<Room | null>(null)
  const conns = useRef(new Map<string, Conn>())
  const localStream = useRef<MediaStream | null>(null)
  const videoTrack = useRef<MediaStreamTrack | null>(null)
  const speaking = useRef(new Map<string, boolean>())
  const sharing = useRef(new Map<string, boolean>())
  const videoKind = useRef<'off' | 'camera' | 'screen'>('off')
  const callRef = useRef<CurrentCall | null>(null)
  callRef.current = call
  const incomingRef = useRef<IncomingCall | null>(null)
  incomingRef.current = incoming
  const declined = useRef(new Set<string>())
  const lastRing = useRef(0)
  const hadPeer = useRef(false)

  const flash = useCallback((text: string) => {
    setNotice(text)
    setTimeout(() => setNotice((n) => (n === text ? null : n)), 4000)
  }, [])

  const nameOf = useCallback((id: string) => workspace?.members.find((m) => m.id === id)?.name ?? 'Quelqu\'un', [workspace])

  // --- Moteur WebRTC (une salle par appel) ---------------------------------------------------

  const publish = useCallback(() => {
    setPeers(
      [...conns.current.entries()].map(([peer, c]) => ({
        peer,
        userId: c.userId,
        stream: c.stream,
        speaking: speaking.current.get(peer) ?? false,
        screen: sharing.current.get(peer) ?? false,
        hasVideo: !!c.stream?.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted),
      })),
    )
  }, [])

  const sendMedia = (e: Omit<RoomEvent, 'from'>) => media.current?.send({ ...e, peer: myPeer.current })
  const sendSignal = (e: Omit<RoomEvent, 'from'>) => signal.current?.send({ ...e, peer: myPeer.current })

  const drop = useCallback((peer: string) => {
    const c = conns.current.get(peer)
    if (!c) return
    c.pc.close()
    conns.current.delete(peer)
    speaking.current.delete(peer)
    sharing.current.delete(peer)
    publish()
  }, [publish])

  const connect = useCallback((peer: string, userId: string) => {
    if (conns.current.has(peer)) return conns.current.get(peer)!
    const pc = new RTCPeerConnection(ICE)
    const c: Conn = { pc, polite: myPeer.current > peer, makingOffer: false, ignoreOffer: false, userId, stream: null }
    conns.current.set(peer, c)
    for (const t of localStream.current?.getTracks() ?? []) pc.addTrack(t, localStream.current!)
    pc.onnegotiationneeded = async () => {
      try {
        c.makingOffer = true
        await pc.setLocalDescription()
        sendMedia({ type: 'sig', to: peer, desc: pc.localDescription?.toJSON() })
      } catch {
        /* nouvelle tentative au prochain changement */
      } finally {
        c.makingOffer = false
      }
    }
    pc.onicecandidate = ({ candidate }) => candidate && sendMedia({ type: 'sig', to: peer, cand: candidate.toJSON() })
    pc.ontrack = ({ track, streams }) => {
      c.stream = streams[0] ?? c.stream ?? new MediaStream()
      if (!c.stream.getTracks().includes(track)) c.stream.addTrack(track)
      track.onunmute = publish
      track.onmute = publish
      track.onended = publish
      publish()
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') drop(peer)
    }
    publish()
    return c
  }, [publish, drop]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onSignal(e: RoomEvent) {
    const peer = e.peer as string
    const c = conns.current.get(peer) ?? connect(peer, e.from)
    const { pc } = c
    try {
      if (e.desc) {
        const desc = e.desc as RTCSessionDescriptionInit
        const collision = desc.type === 'offer' && (c.makingOffer || pc.signalingState !== 'stable')
        c.ignoreOffer = !c.polite && collision
        if (c.ignoreOffer) return
        await pc.setRemoteDescription(desc)
        if (desc.type === 'offer') {
          await pc.setLocalDescription()
          sendMedia({ type: 'sig', to: peer, desc: pc.localDescription?.toJSON() })
        }
      } else if (e.cand) {
        try {
          await pc.addIceCandidate(e.cand as RTCIceCandidateInit)
        } catch {
          if (!c.ignoreOffer) throw new Error('ice')
        }
      }
    } catch {
      /* signal hors séquence : la négociation suivante rattrape */
    }
  }

  /** Micro (et caméra si demandé), puis entrée dans la salle de l'appel. */
  async function enterMedia(callId: string, withVideo: boolean) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
    localStream.current = stream
    setLocal(stream)
    setMuted(false)
    const r = backend.joinRoom(`call:${callId}`, {
      onEvent: (e) => {
        if (e.peer === myPeer.current) return
        if (e.to && e.to !== myPeer.current) return
        if (e.type === 'hello') {
          connect(e.peer as string, e.from)
          if (!e.to) sendMedia({ type: 'hello', to: e.peer })
          if (videoKind.current === 'screen') sendMedia({ type: 'state', screen: true })
        } else if (e.type === 'state') {
          sharing.current.set(e.peer as string, !!e.screen)
          publish()
        } else if (e.type === 'sig') void onSignal(e)
        else if (e.type === 'bye') drop(e.peer as string)
      },
      onPeers: () => {},
    })
    media.current = r
    sendMedia({ type: 'hello' })
    if (withVideo) await toggleCameraInner(true)
  }

  function exitMedia() {
    sendMedia({ type: 'bye' })
    for (const peer of [...conns.current.keys()]) drop(peer)
    media.current?.leave()
    media.current = null
    localStream.current?.getTracks().forEach((t) => t.stop())
    videoTrack.current?.stop()
    videoTrack.current = null
    localStream.current = null
    setLocal(null)
    setVideo('off')
    videoKind.current = 'off'
    setPeers([])
    setBotPeers([])
  }

  const micError = (err: unknown) =>
    setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'Micro refusé : autorise-le dans ton navigateur.' : 'Micro introuvable.')

  // --- Fin d'appel ------------------------------------------------------------------------

  const endCall = useCallback((why?: 'missed' | 'declined' | 'ended') => {
    const c = callRef.current
    if (!c) return
    if (c.state === 'calling') sendSignal({ type: 'cancel', callId: c.id })
    exitMedia()
    callRef.current = null
    setCall(null)
    setMinimized(false)
    hadPeer.current = false
    // Personne n'a décroché : un message dans le chat prévient les absents (mention = notification + téléphone).
    if (why === 'missed' && c.callerId === meRef.current) {
      const ch = c.channelId ?? workspace?.channels[0]?.id
      const who = c.targets?.length ? c.targets.map((id) => `@${nameOf(id)}`).join(' ') : ''
      if (ch && !demo) void backend.sendMessage(ch, `Appel manqué${who ? ` : ${who}` : ''}. Rappelle quand tu peux.`).catch(() => {})
      flash(c.targets?.length === 1 ? `${nameOf(c.targets[0])} n'a pas répondu` : 'Personne n\'a répondu')
    } else if (why === 'declined') flash(c.targets?.length === 1 ? `${nameOf(c.targets[0])} a refusé l'appel` : 'Appel refusé')
    else if (why === 'ended') flash('Appel terminé')
  }, [backend, demo, flash, nameOf, workspace]) // eslint-disable-line react-hooks/exhaustive-deps

  const hangUp = useCallback(() => endCall(), [endCall])

  // --- Salle « calls » : sonneries et appels en cours ---------------------------------------

  const onCallsEvent = useRef<(e: RoomEvent) => void>(() => {})
  onCallsEvent.current = (e) => {
    if (e.peer === myPeer.current) return
    const callId = e.callId as string
    if (e.type === 'ring') {
      const to = e.to as string[] | null
      // En démo, tous les onglets sont « moi » : on sonne quand même pour pouvoir essayer.
      const forMe = demo || (to ? to.includes(meRef.current) : e.from !== meRef.current)
      if (!forMe || declined.current.has(callId) || callRef.current?.id === callId) return
      // Ne pas déranger : pas de sonnerie, l'appelant laissera « Appel manqué » dans le chat.
      if (!demo && presenceOf(workspaceRef.current?.members.find((m) => m.id === meRef.current)) === 'dnd') return
      lastRing.current = Date.now()
      if (incomingRef.current?.id !== callId)
        setIncoming({ id: callId, from: e.from, video: !!e.video, label: (e.label as string) ?? '', channelId: (e.channelId as string) ?? null, group: !to })
    } else if (e.type === 'cancel') {
      if (incomingRef.current?.id === callId) setIncoming(null)
    } else if (e.type === 'decline') {
      const c = callRef.current
      if (!c || c.id !== callId || c.callerId !== meRef.current) return
      declined.current.add(`${callId}:${e.from}`)
      const all = c.targets?.every((t) => declined.current.has(`${callId}:${t}`))
      if (c.state === 'calling' && all) endCall('declined')
      else if (c.targets?.length === 1 && c.state === 'calling') endCall('declined')
    } else if (e.type === 'live') {
      const ch = e.channelId as string
      if (!ch) return
      setLive((l) => ({ ...l, [ch]: { callId, people: (e.people as string[]) ?? [], at: Date.now() } }))
    }
  }

  useEffect(() => {
    if (!groupId) return
    const r = backend.joinRoom('calls', { onEvent: (e) => onCallsEvent.current(e), onPeers: () => {} }, { listen: true })
    signal.current = r
    return () => {
      r.leave()
      signal.current = null
    }
  }, [backend, groupId])

  // Changement de projet : on raccroche.
  useEffect(() => () => {
    if (callRef.current) endCall()
    setIncoming(null)
  }, [groupId]) // eslint-disable-line react-hooks/exhaustive-deps

  // La sonnerie s'arrête si l'appelant ne sonne plus (parti, coupé).
  useEffect(() => {
    if (!incoming) return
    const id = setInterval(() => {
      if (Date.now() - lastRing.current > 9000) setIncoming(null)
    }, 1500)
    return () => clearInterval(id)
  }, [incoming])

  // Sonnerie entrante, et notification système si la fenêtre est cachée.
  useEffect(() => {
    if (!incoming) return
    const stop = ringer('in')
    let n: Notification | null = null
    try {
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted')
        n = new Notification(`${nameOf(incoming.from)} t'appelle`, { body: incoming.video ? 'Appel vidéo Kollab' : 'Appel Kollab', tag: incoming.id })
    } catch {
      /* pas de notification système */
    }
    return () => {
      stop()
      n?.close()
    }
  }, [incoming, nameOf])

  // Appelant : on resonne toutes les 3 s pendant 30 s ; tonalité d'attente tant que personne n'a décroché.
  useEffect(() => {
    if (!call || call.callerId !== me) return
    const ring = () => sendSignal({ type: 'ring', callId: call.id, to: call.targets, video: video === 'camera', label: call.label, channelId: call.channelId })
    ring()
    const id = setInterval(ring, 3000)
    const stopAt = setTimeout(() => {
      clearInterval(id)
      if (callRef.current?.id === call.id && callRef.current.state === 'calling') endCall('missed')
    }, RING_MS)
    return () => {
      clearInterval(id)
      clearTimeout(stopAt)
    }
  }, [call?.id, call?.callerId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (call?.state !== 'calling' || call.callerId !== me) return
    return ringer('out')
  }, [call?.state, call?.callerId, me])

  // Appel de salon : chacun annonce l'appel en cours pour que les autres puissent le rejoindre.
  useEffect(() => {
    if (!call?.channelId || call.state !== 'active') return
    const say = () => sendSignal({ type: 'live', callId: call.id, channelId: call.channelId, people: [meRef.current, ...peers.map((p) => p.userId)] })
    say()
    const id = setInterval(say, 5000)
    return () => clearInterval(id)
  }, [call?.id, call?.channelId, call?.state, peers.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Les annonces trop anciennes disparaissent.
  useEffect(() => {
    const id = setInterval(() => setLive((l) => {
      const now = Date.now()
      const keep = Object.fromEntries(Object.entries(l).filter(([, v]) => now - v.at < 12000))
      return Object.keys(keep).length === Object.keys(l).length ? l : keep
    }), 4000)
    return () => clearInterval(id)
  }, [])

  // Quelqu'un a décroché : l'appel passe « en cours ». Tout le monde est parti : il se termine.
  const allPeers = useMemo(() => (demo && botPeers.length ? [...peers, ...botPeers] : peers), [demo, botPeers, peers])
  useEffect(() => {
    if (!call) return
    if (allPeers.length > 0) {
      hadPeer.current = true
      if (call.state === 'calling') setCall({ ...call, state: 'active', startedAt: Date.now() })
    } else if (hadPeer.current && call.state === 'active') {
      const t = setTimeout(() => {
        if (conns.current.size === 0 && callRef.current?.id === call.id) endCall('ended')
      }, 2500)
      return () => clearTimeout(t)
    }
  }, [allPeers.length, call?.state]) // eslint-disable-line react-hooks/exhaustive-deps

  // Démo : des collègues fictifs décrochent pour qu'on voie l'appel vivre.
  useEffect(() => {
    if (!demo || !call || call.callerId !== me || call.state !== 'calling') return
    const who = (call.targets ?? workspace?.members.filter((m) => m.id !== me).slice(0, 2).map((m) => m.id) ?? []).slice(0, 3)
    const t = setTimeout(() => {
      if (conns.current.size) return
      setBotPeers(who.map((id) => ({ peer: `bot-${id}`, userId: id, stream: null, speaking: false, hasVideo: false })))
    }, 2600)
    return () => clearTimeout(t)
  }, [demo, call?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!botPeers.length) return
    const id = setInterval(() => setBotPeers((b) => b.map((p, i) => ({ ...p, speaking: Math.random() < (i === 0 ? 0.55 : 0.25) }))), 1400)
    return () => clearInterval(id)
  }, [botPeers.length])

  // --- Actions ------------------------------------------------------------------------------

  const start = useCallback<CallState['start']>(async ({ targets, channelId, label, video: withVideo }) => {
    if (callRef.current || !groupId) return
    setError(null)
    // La personne est en Ne pas déranger : on ne sonne pas, on laisse directement un appel manqué.
    const target = targets?.length === 1 ? workspace?.members.find((m) => m.id === targets[0]) : undefined
    if (target && presenceOf(target) === 'dnd') {
      const ch = channelId ?? workspace?.channels[0]?.id
      if (ch && !demo) void backend.sendMessage(ch, `Appel manqué : @${target.name}. Rappelle quand tu peux.`).catch(() => {})
      flash(`${target.name.split(' ')[0]} est en Ne pas déranger : appel manqué laissé dans le chat`)
      return
    }
    const id = crypto.randomUUID()
    try {
      await enterMedia(id, withVideo)
    } catch (err) {
      micError(err)
      exitMedia()
      return
    }
    const c: CurrentCall = { id, callerId: meRef.current, targets, channelId, label, state: 'calling', startedAt: null }
    callRef.current = c
    setCall(c)
    setMinimized(false)
  }, [groupId, workspace, demo, backend, flash]) // eslint-disable-line react-hooks/exhaustive-deps

  const joinLive = useCallback(async (channelId: string, label: string) => {
    const l = live[channelId]
    if (!l || callRef.current) return
    setError(null)
    try {
      await enterMedia(l.callId, false)
    } catch (err) {
      micError(err)
      exitMedia()
      return
    }
    const c: CurrentCall = { id: l.callId, callerId: l.people[0] ?? '', targets: null, channelId, label, state: 'calling', startedAt: null }
    callRef.current = c
    setCall(c)
  }, [live]) // eslint-disable-line react-hooks/exhaustive-deps

  const accept = useCallback(async (withVideo: boolean) => {
    const inc = incomingRef.current
    if (!inc) return
    setIncoming(null)
    if (callRef.current) endCall()
    setError(null)
    try {
      await enterMedia(inc.id, withVideo)
    } catch (err) {
      micError(err)
      exitMedia()
      sendSignal({ type: 'decline', callId: inc.id })
      return
    }
    const label = inc.group ? inc.label : nameOf(inc.from)
    const c: CurrentCall = { id: inc.id, callerId: inc.from, targets: null, channelId: inc.channelId, label, state: 'calling', startedAt: null }
    callRef.current = c
    setCall(c)
    setMinimized(false)
  }, [endCall, nameOf]) // eslint-disable-line react-hooks/exhaustive-deps

  const decline = useCallback(() => {
    const inc = incomingRef.current
    if (!inc) return
    declined.current.add(inc.id)
    sendSignal({ type: 'decline', callId: inc.id })
    setIncoming(null)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // On prévient les autres si la page se ferme.
  useEffect(() => {
    const bye = () => {
      if (callRef.current) {
        sendMedia({ type: 'bye' })
        if (callRef.current.state === 'calling') sendSignal({ type: 'cancel', callId: callRef.current.id })
      }
    }
    window.addEventListener('pagehide', bye)
    return () => window.removeEventListener('pagehide', bye)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = useCallback(() => {
    const next = !muted
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = !next))
    setMuted(next)
  }, [muted])

  async function setVideoTrack(track: MediaStreamTrack | null, kind: 'off' | 'camera' | 'screen') {
    const old = videoTrack.current
    videoTrack.current = track
    for (const c of conns.current.values()) {
      const sender = c.pc.getSenders().find((s) => s.track === old || (s.track === null && old))
      if (sender && track) await sender.replaceTrack(track)
      else if (sender && !track) c.pc.removeTrack(sender)
      else if (track && localStream.current) c.pc.addTrack(track, localStream.current)
    }
    old?.stop()
    if (localStream.current) {
      if (old) localStream.current.removeTrack(old)
      if (track) localStream.current.addTrack(track)
      setLocal(new MediaStream(localStream.current.getTracks()))
    }
    setVideo(kind)
    videoKind.current = kind
    sendMedia({ type: 'state', screen: kind === 'screen' })
    if (track) track.onended = () => void setVideoTrack(null, 'off')
  }

  async function toggleCameraInner(on: boolean) {
    if (!on) return setVideoTrack(null, 'off')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
      await setVideoTrack(s.getVideoTracks()[0], 'camera')
    } catch {
      setError('Caméra indisponible.')
    }
  }

  const toggleCamera = useCallback(() => toggleCameraInner(video !== 'camera'), [video]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleScreen = useCallback(async () => {
    if (video === 'screen') return setVideoTrack(null, 'off')
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      await setVideoTrack(s.getVideoTracks()[0], 'screen')
    } catch {
      /* partage annulé */
    }
  }, [video]) // eslint-disable-line react-hooks/exhaustive-deps

  // Qui parle : niveau sonore de chaque flux, mesuré quelques fois par seconde.
  const inCall = !!call
  useEffect(() => {
    if (!inCall) return
    let ctx: AudioContext
    try {
      ctx = new AudioContext()
    } catch {
      return
    }
    const meters = new Map<string, AnalyserNode>()
    const data = new Uint8Array(512)
    const level = (a: AnalyserNode) => {
      a.getByteTimeDomainData(data)
      let sum = 0
      for (const v of data) sum += (v - 128) ** 2
      return Math.sqrt(sum / data.length)
    }
    const id = setInterval(() => {
      const streams: [string, MediaStream | null][] = [['me', localStream.current], ...[...conns.current.entries()].map(([k, c]) => [k, c.stream] as [string, MediaStream | null])]
      let changed = false
      for (const [k, s] of streams) {
        if (!s || !s.getAudioTracks().length) continue
        let a = meters.get(k)
        if (!a) {
          a = ctx.createAnalyser()
          a.fftSize = 512
          try {
            ctx.createMediaStreamSource(s).connect(a)
          } catch {
            continue
          }
          meters.set(k, a)
        }
        const on = level(a) > 6
        if (k === 'me') setSpeakingMe(on)
        else if (speaking.current.get(k) !== on) {
          speaking.current.set(k, on)
          changed = true
        }
      }
      if (changed) publish()
    }, 180)
    return () => {
      clearInterval(id)
      void ctx.close()
    }
  }, [inCall, publish])

  const liveOut = useMemo(() => Object.fromEntries(Object.entries(live).map(([k, v]) => [k, { callId: v.callId, people: v.people }])), [live])

  const value = useMemo<CallState>(
    () => ({
      call, incoming, live: liveOut, muted, video, peers: allPeers, local, speakingMe: speakingMe && !muted, minimized, error, notice,
      start, joinLive, accept, decline, hangUp, toggleMute, toggleCamera, toggleScreen, setMinimized,
    }),
    [call, incoming, liveOut, muted, video, allPeers, local, speakingMe, minimized, error, notice, start, joinLive, accept, decline, hangUp, toggleMute, toggleCamera, toggleScreen],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
