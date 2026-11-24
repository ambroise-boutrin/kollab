import { PRESENCE, liveStatus, type Member } from '../lib/types'

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

/** Photo ou initiales ; la pastille montre le statut quand la personne est en ligne. */
export function Avatar({ member, size = 32, online = false }: { member: Member | undefined; size?: number; online?: boolean }) {
  if (!member) return null
  const dot = online ? PRESENCE[member.status ?? 'available'].color : null
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: member.color, fontSize: Math.round(size * 0.4) }}
      title={`${member.name}${liveStatus(member) ? ` · ${liveStatus(member)}` : online ? ` · ${PRESENCE[member.status ?? 'available'].label}` : ''}`}
    >
      {member.avatarUrl ? <img src={member.avatarUrl} alt="" width={size} height={size} /> : initials(member.name)}
      {dot && <i className="dot" style={{ background: dot }} />}
    </span>
  )
}

/** Plusieurs personnes : avatars superposés, puis « +N ». */
export function AvatarGroup({ members, size = 24, max = 3, online = [] }: { members: Member[]; size?: number; max?: number; online?: string[] }) {
  if (!members.length) return null
  const extra = members.length - max
  return (
    <span className="avatar-group" title={members.map((m) => m.name).join(', ')}>
      {members.slice(0, extra > 0 ? max - 1 : max).map((m) => <Avatar key={m.id} member={m} size={size} online={online.includes(m.id)} />)}
      {extra > 0 && <span className="avatar more" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>+{extra + 1}</span>}
    </span>
  )
}
