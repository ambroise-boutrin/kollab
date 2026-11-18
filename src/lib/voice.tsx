import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Room, RoomEvent } from './backend'
import { useStore } from './store'

/**
 * Salon vocal du projet, en pair à pair (WebRTC) : la voix et la vidéo vont directement d'un membre à l'autre,
 * Supabase ne sert qu'à se trouver (signalisation). Idéal jusqu'à 5 ou 6 personnes.
 */

const ICE: RTCConfiguration = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] }

export interface VoicePeer {
  peer: string
  userId: string
  stream: MediaStream | null
  speaking: boolean
  hasVideo: boolean
}

interface VoiceState {
  /** Membres présents dans le vocal (même sans y être soi-même). */
  present: string[]
  joined: boolean
  joining: boolean
  muted: boolean
  video: 'off' | 'camera' | 'screen'
  peers: VoicePeer[]
  local: MediaStream | null
  speakingMe: boolean
  error: string | null
  join(): Promise<void>
  leave(): void
  toggleMute(): void
  toggleCamera(): Promise<void>
  toggleScreen(): Promise<void>
}

const Ctx = createContext<VoiceState | null>(null)
export const useVoice = () => useContext(Ctx)

type Conn = { pc: RTCPeerConnection; polite: boolean; makingOffer: boolean; ignoreOffer: boolean; userId: string; stream: MediaStream | null }

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { backend, user, workspace } = useStore()
  const groupId = workspace?.group.id
  const me = user?.id ?? 'me'
  const [present, setPresent] = useState<string[]>([])
  const [joined, setJoined] = useState(false)
  const [joining, setJoining] = useState(false)
  const [muted, setMuted] = useState(false)
  const [video, setVideo] = useState<'off' | 'camera' | 'screen'>('off')
  const [peers, setPeers] = useState<VoicePeer[]>([])
  const [local, setLocal] = useState<MediaStream | null>(null)
  const [speakingMe, setSpeakingMe] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const myPeer = useRef(crypto.randomUUID())
  const room = useRef<Room | null>(null)
  const conns = useRef(new Map<string, Conn>())
  const localStream = useRef<MediaStream | null>(null)
  const videoTrack = useRef<MediaStreamTrack | null>(null)
  const speaking = useRef(new Map<string, boolean>())

  const joinedRef = useRef(false)
  joinedRef.current = joined
  const onEventRef = useRef<(e: RoomEvent) => void>(() => {})

  // Une seule salle par projet : on y écoute toujours (pour voir qui est dans le vocal), on n'y apparaît qu'en rejoignant.
  useEffect(() => {
    if (!groupId) return
    const r = backend.joinRoom('voice', { onEvent: (e) => onEventRef.current(e), onPeers: setPresent }, { listen: true })
    room.current = r
    return () => {
      if (joinedRef.current) r.send({ type: 'bye', peer: myPeer.current })
      r.leave()
      room.current = null
    }
  }, [backend, groupId])

  const publish = useCallback(() => {
    setPeers(
      [...conns.current.entries()].map(([peer, c]) => ({
        peer,
        userId: c.userId,
        stream: c.stream,
        speaking: speaking.current.get(peer) ?? false,
        hasVideo: !!c.stream?.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted),
      })),
    )
  }, [])

  const send = (e: Omit<RoomEvent, 'from'>) => room.current?.send({ ...e, peer: myPeer.current })

  const connect = useCallback((peer: string, userId: string) => {
    if (conns.current.has(peer)) return conns.current.get(peer)!
    const pc = new RTCPeerConnection(ICE)
    const c: Conn = { pc, polite: myPeer.current > peer, makingOffer: false, ignoreOffer: false, userId, stream: null }
    conns.current.set(peer, c)
    for (const t of localStream.current?.getTracks() ?? []) pc.addTrack(t, localStream.current!)
    if (videoTrack.current) pc.addTrack(videoTrack.current, localStream.current!)
    pc.onnegotiationneeded = async () => {
      try {
        c.makingOffer = true
        await pc.setLocalDescription()
        send({ type: 'sig', to: peer, desc: pc.localDescription?.toJSON() })
      } catch {
        /* nouvelle tentative au prochain changement */
      } finally {
        c.makingOffer = false
      }
    }
    pc.onicecandidate = ({ candidate }) => candidate && send({ type: 'sig', to: peer, cand: candidate.toJSON() })
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
  }, [publish]) // eslint-disable-line react-hooks/exhaustive-deps

  const drop = useCallback((peer: string) => {
    const c = conns.current.get(peer)
    if (!c) return
    c.pc.close()
    conns.current.delete(peer)
    speaking.current.delete(peer)
    publish()
  }, [publish])

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
          send({ type: 'sig', to: peer, desc: pc.localDescription?.toJSON() })
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

  const join = useCallback(async () => {
    if (joined || joining || !groupId) return
    setJoining(true)
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
      localStream.current = stream
      setLocal(stream)
      setMuted(false)
      onEventRef.current = (e) => {
        if (!joinedRef.current && e.type !== 'bye') return
        if (e.peer === myPeer.current) return
        if (e.to && e.to !== myPeer.current) return
        if (e.type === 'hello') {
          connect(e.peer as string, e.from)
          if (!e.to) send({ type: 'hello', to: e.peer })
        } else if (e.type === 'sig') void onSignal(e)
        else if (e.type === 'bye') drop(e.peer as string)
      }
      joinedRef.current = true
      room.current?.setPresent(true)
      send({ type: 'hello' })
      setJoined(true)
    } catch (err) {
      setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'Micro refusé : autorise-le dans ton navigateur.' : 'Micro introuvable.')
    } finally {
      setJoining(false)
    }
  }, [joined, joining, groupId, backend, connect, drop]) // eslint-disable-line react-hooks/exhaustive-deps

  const leave = useCallback(() => {
    send({ type: 'bye' })
    for (const peer of [...conns.current.keys()]) drop(peer)
    room.current?.setPresent(false)
    joinedRef.current = false
    localStream.current?.getTracks().forEach((t) => t.stop())
    videoTrack.current?.stop()
    videoTrack.current = null
    localStream.current = null
    setLocal(null)
    setVideo('off')
    setJoined(false)
    setPeers([])
  }, [drop]) // eslint-disable-line react-hooks/exhaustive-deps

  // On quitte proprement si la page se ferme ou si l'on change de projet.
  useEffect(() => {
    const bye = () => joined && send({ type: 'bye' })
    window.addEventListener('pagehide', bye)
    return () => window.removeEventListener('pagehide', bye)
  }, [joined])
  useEffect(() => () => {
    if (joinedRef.current) leave()
  }, [groupId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (track) track.onended = () => void setVideoTrack(null, 'off')
  }

  const toggleCamera = useCallback(async () => {
    if (video === 'camera') return setVideoTrack(null, 'off')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 360 } } })
      await setVideoTrack(s.getVideoTracks()[0], 'camera')
    } catch {
      setError('Caméra indisponible.')
    }
  }, [video]) // eslint-disable-line react-hooks/exhaustive-deps

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
  useEffect(() => {
    if (!joined) return
    const ctx = new AudioContext()
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
  }, [joined, publish])

  const value = useMemo<VoiceState>(
    () => ({ present, joined, joining, muted, video, peers, local, speakingMe: speakingMe && !muted, error, join, leave, toggleMute, toggleCamera, toggleScreen }),
    [present, joined, joining, muted, video, peers, local, speakingMe, error, join, leave, toggleMute, toggleCamera, toggleScreen, me],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
