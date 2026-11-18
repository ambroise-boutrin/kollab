import { PRESENCE, type Member } from '../lib/types'

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
      title={`${member.name}${online ? ` · ${PRESENCE[member.status ?? 'available'].label}` : ''}`}
    >
      {member.avatarUrl ? <img src={member.avatarUrl} alt="" width={size} height={size} /> : initials(member.name)}
      {dot && <i className="dot" style={{ background: dot }} />}
    </span>
  )
}
